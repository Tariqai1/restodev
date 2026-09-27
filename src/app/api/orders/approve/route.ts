import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getActivePendingApprovals,
  approveOrderBatch,
  rejectOrderBatch,
  removeItemFromPendingBatch,
  getPlatformState,
} from "@/lib/platform/state";

async function getCallerStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const staff = await resolveStaffContext(user);
  if (!staff) return null;

  return {
    user: staff.user,
    staffId: staff.staffId,
    role: staff.role,
    restaurantId: staff.restaurantId,
    isSuper: staff.isSuperAdmin,
  };
}

async function recordCancelledDishes(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
  cancelledItems: Array<{
    id?: string;
    orderId: string;
    tableId: string;
    tableNumber: string;
    dishName: string;
    qty: number;
    price: number;
    reason?: string;
  }>,
  orderCancelledNotice?: {
    orderId: string;
    tableId: string;
    tableNumber: string;
    reason: string;
  }
) {
  try {
    if (!restaurantId) return;
    const { data: resto } = await admin
      .from("restaurants")
      .select("gstin")
      .eq("id", restaurantId)
      .maybeSingle();

    let meta: Record<string, unknown> = {};
    const rawGstin = resto?.gstin || "";
    if (rawGstin.startsWith("{") && rawGstin.endsWith("}")) {
      try {
        meta = JSON.parse(rawGstin);
      } catch {}
    } else if (rawGstin) {
      meta.gstin_number = rawGstin;
    }

    const existingCancelledItems = (meta.cancelled_items as Array<{
      id: string;
      orderId: string;
      tableId: string;
      tableNumber: string;
      dishName: string;
      qty: number;
      price: number;
      reason: string;
      cancelledAt: string;
    }>) || [];
    const nowIso = new Date().toISOString();
    const newItems = cancelledItems.map((c) => ({
      id: c.id || `canc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId: c.orderId,
      tableId: c.tableId,
      tableNumber: c.tableNumber,
      dishName: c.dishName,
      qty: c.qty,
      price: c.price,
      reason: c.reason || "Item unavailable / cancelled by floor staff",
      cancelledAt: nowIso,
    }));

    // Keep last 40 cancelled items
    meta.cancelled_items = [...newItems, ...existingCancelledItems].slice(0, 40);

    if (orderCancelledNotice) {
      const existingCancelledOrders = (meta.cancelled_orders as Array<{
        id: string;
        orderId: string;
        tableId: string;
        tableNumber: string;
        reason: string;
        cancelledAt: string;
      }>) || [];
      const newOrderNotice = {
        id: `cancord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: orderCancelledNotice.orderId,
        tableId: orderCancelledNotice.tableId,
        tableNumber: orderCancelledNotice.tableNumber,
        reason: orderCancelledNotice.reason || "Order cancelled by floor captain",
        cancelledAt: nowIso,
      };
      meta.cancelled_orders = [newOrderNotice, ...existingCancelledOrders].slice(0, 20);
    }

    await admin
      .from("restaurants")
      .update({ gstin: JSON.stringify(meta) })
      .eq("id", restaurantId);
  } catch (err) {
    console.error("Failed to record cancelled dishes in database metadata:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerStaff();
    if (!caller) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ message: "Missing restaurantId" }, { status: 400 });
    }

    const batches = getActivePendingApprovals(restaurantId);
    return NextResponse.json({ ok: true, batches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerStaff();
    if (!caller) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { batchId, tableNumber, itemId, action, reason } = body as {
      batchId?: string;
      tableNumber?: string;
      itemId?: string;
      action?: "approve" | "reject" | "approve_item" | "reject_item";
      reason?: string;
    };

    const isApprove = action === "approve" || action === "approve_item";
    const isReject = action === "reject" || action === "reject_item";

    if (!isApprove && !isReject) {
      return NextResponse.json(
        { message: "Invalid action. Expected 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    if (!batchId && !tableNumber && !itemId) {
      return NextResponse.json(
        { message: "Missing target. Please specify 'itemId', 'tableNumber', or 'batchId'." },
        { status: 400 }
      );
    }

    const state = getPlatformState();
    const admin = createAdminClient();

    // ─────────────────────────────────────────────────────────────
    // CASE 1: SINGLE ITEM APPROVAL / REJECTION
    // ─────────────────────────────────────────────────────────────
    if (itemId) {
      const { data: itemData, error: itemErr } = await admin
        .from("order_items")
        .select(`
          id,
          order_id,
          unit_price,
          qty,
          item_status,
          menu_items (
            id,
            name,
            is_veg
          ),
          orders (
            id,
            restaurant_id,
            table_id,
            restaurant_tables (
              id,
              table_number
            )
          )
        `)
        .eq("id", itemId)
        .maybeSingle();

      if (itemErr || !itemData) {
        return NextResponse.json({ message: "Order dish not found." }, { status: 404 });
      }

      const tableInfo = (itemData.orders as unknown as {
        id: string;
        restaurant_id: string;
        table_id: string;
        restaurant_tables: { id: string; table_number: string } | null;
      } | null);
      const tableId = tableInfo?.table_id;
      const orderId = itemData.order_id;
      const dishName = (itemData.menu_items as unknown as { name: string } | null)?.name || "Dish";
      const resolvedTableNum = tableInfo?.restaurant_tables?.table_number || "T--";
      const targetRestoId = tableInfo?.restaurant_id || caller.restaurantId;

      if (isApprove) {
        // Mark item as 'preparing' (Dispatched to Kitchen)
        const { error: updateErr } = await admin
          .from("order_items")
          .update({ item_status: "preparing" })
          .eq("id", itemId);

        if (updateErr) throw updateErr;

        // Clean up from pending memory batch
        removeItemFromPendingBatch(
          itemId,
          Number(itemData.unit_price) || 0,
          Number(itemData.qty) || 1
        );

        if (tableId) {
          await admin
            .from("restaurant_tables")
            .update({ status: "pending" })
            .eq("id", tableId);
        }

        return NextResponse.json({
          ok: true,
          action: "item_approved",
          message: `Dish "${dishName}" approved and dispatched to Kitchen KOT!`,
        });
      }

      if (isReject) {
        // Delete rejected dish from order_items
        const { error: deleteErr } = await admin
          .from("order_items")
          .delete()
          .eq("id", itemId);

        if (deleteErr) throw deleteErr;

        // Clean up from pending memory batch
        removeItemFromPendingBatch(
          itemId,
          Number(itemData.unit_price) || 0,
          Number(itemData.qty) || 1
        );

        // Check if any items remain in this order
        const { data: remainingItems } = await admin
          .from("order_items")
          .select("id")
          .eq("order_id", orderId);

        let orderNotice: { orderId: string; tableId: string; tableNumber: string; reason: string } | undefined;

        if (!remainingItems || remainingItems.length === 0) {
          // No items left, cancel the order and free table
          await admin
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", orderId);

          if (tableId) {
            await admin
              .from("restaurant_tables")
              .update({ status: "empty" })
              .eq("id", tableId);
          }

          orderNotice = {
            orderId,
            tableId: tableId || "",
            tableNumber: resolvedTableNum,
            reason: reason || "All dishes in order cancelled by floor staff",
          };
        }

        // Record cancelled dish in Supabase database metadata so customer is notified
        await recordCancelledDishes(
          admin,
          targetRestoId,
          [
            {
              orderId,
              tableId: tableId || "",
              tableNumber: resolvedTableNum,
              dishName,
              qty: Number(itemData.qty) || 1,
              price: Number(itemData.unit_price) || 0,
              reason: reason || "Dish out of stock / cancelled by floor staff",
            },
          ],
          orderNotice
        );

        return NextResponse.json({
          ok: true,
          action: "item_rejected",
          message: `Dish "${dishName}" cancelled and removed from order.`,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASE 2: TABLE-WIDE APPROVAL / REJECTION (ALL PENDING FOR TABLE)
    // ─────────────────────────────────────────────────────────────
    if (tableNumber && (!batchId || batchId === "all")) {
      const { data: tableData } = await admin
        .from("restaurant_tables")
        .select("id, restaurant_id")
        .eq("table_number", tableNumber)
        .eq("restaurant_id", caller.restaurantId)
        .maybeSingle();

      if (!tableData) {
        return NextResponse.json({ message: "Table not found in the active restaurant" }, { status: 404 });
      }

      if (tableData) {
        const { data: openOrders } = await admin
          .from("orders")
          .select("id")
          .eq("table_id", tableData.id)
          .eq("restaurant_id", caller.restaurantId)
          .eq("status", "open");

        const orderIds = (openOrders || []).map((o) => o.id);

        if (orderIds.length > 0) {
          if (isApprove) {
            // Promote ALL 'pending' items in database to 'preparing'
            const { error: itemUpdateError } = await admin
              .from("order_items")
              .update({ item_status: "preparing" })
              .in("order_id", orderIds)
              .eq("item_status", "pending");
            if (itemUpdateError) throw itemUpdateError;

            const { error: tableUpdateError } = await admin
              .from("restaurant_tables")
              .update({ status: "pending" })
              .eq("id", tableData.id);
            if (tableUpdateError) throw tableUpdateError;
          } else if (isReject) {
            // First fetch names and quantities of pending items
            const { data: pendingItemsToReject } = await admin
              .from("order_items")
              .select(`
                id,
                order_id,
                unit_price,
                qty,
                menu_items (name)
              `)
              .in("order_id", orderIds)
              .eq("item_status", "pending");

            // Delete all 'pending' items in database
            await admin
              .from("order_items")
              .delete()
              .in("order_id", orderIds)
              .eq("item_status", "pending");

            // Check if any served/preparing items remain
            const { data: anyRemaining } = await admin
              .from("order_items")
              .select("id")
              .in("order_id", orderIds);

            let orderNotice: { orderId: string; tableId: string; tableNumber: string; reason: string } | undefined;

            if (!anyRemaining || anyRemaining.length === 0) {
              await admin
                .from("orders")
                .update({ status: "cancelled" })
                .in("id", orderIds);

              await admin
                .from("restaurant_tables")
                .update({ status: "empty" })
                .eq("id", tableData.id);

              orderNotice = {
                orderId: orderIds[0] || "",
                tableId: tableData.id,
                tableNumber,
                reason: reason || "Order cancelled by floor captain",
              };
            }

            // Record cancellation in database
            if (pendingItemsToReject && pendingItemsToReject.length > 0) {
              await recordCancelledDishes(
                admin,
                tableData.restaurant_id || caller.restaurantId,
                pendingItemsToReject.map((it) => ({
                  orderId: it.order_id,
                  tableId: tableData.id,
                  tableNumber,
                  dishName: (it.menu_items as unknown as { name: string } | null)?.name || "Dish",
                  qty: Number(it.qty) || 1,
                  price: Number(it.unit_price) || 0,
                  reason: reason || "Order rejected by floor captain",
                })),
                orderNotice
              );
            }
          }
        }
      }

      // Also mark in-memory batches accordingly
      const matchingBatches = Object.values(state.pendingOrderApprovals || {}).filter(
        (b) => b.tableNumber === tableNumber && b.status === "awaiting_approval"
      );

      for (const b of matchingBatches) {
        if (isApprove) {
          approveOrderBatch(b.id, caller.role);
        } else {
          rejectOrderBatch(b.id, reason || "Rejected by floor captain");
        }
      }

      return NextResponse.json({
        ok: true,
        action: isApprove ? "approved" : "rejected",
        message: isApprove
          ? `All pending dishes for Table ${tableNumber} approved and dispatched to Kitchen KOT.`
          : `All pending dishes for Table ${tableNumber} rejected.`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // CASE 3: BATCH APPROVAL / REJECTION
    // ─────────────────────────────────────────────────────────────
    const batch = state.pendingOrderApprovals?.[batchId!];

    // If batch is in memory
    if (batch) {
      if (batch.status !== "awaiting_approval") {
        return NextResponse.json(
          { message: `Batch has already been ${batch.status}.` },
          { status: 400 }
        );
      }

      if (isApprove) {
        const updatedBatch = approveOrderBatch(batchId!, caller.role);

        if (batch.itemIds && batch.itemIds.length > 0) {
          await admin
            .from("order_items")
            .update({ item_status: "preparing" })
            .in("id", batch.itemIds);
        }

        await admin
          .from("restaurant_tables")
          .update({ status: "pending" })
          .eq("id", batch.tableId);

        return NextResponse.json({
          ok: true,
          action: "approved",
          message: `Order for Table ${batch.tableNumber} approved and dispatched to Kitchen KOT.`,
          batch: updatedBatch,
        });
      }

      if (isReject) {
        const updatedBatch = rejectOrderBatch(batch.id, reason || "Rejected by floor captain");

        if (batch.itemIds && batch.itemIds.length > 0) {
          const { data: batchItemsToReject } = await admin
            .from("order_items")
            .select(`
              id,
              order_id,
              unit_price,
              qty,
              menu_items (name)
            `)
            .in("id", batch.itemIds);

          await admin
            .from("order_items")
            .delete()
            .in("id", batch.itemIds);

          const { data: remainingItems } = await admin
            .from("order_items")
            .select("id")
            .eq("order_id", batch.orderId);

          let orderNotice: { orderId: string; tableId: string; tableNumber: string; reason: string } | undefined;

          if (!remainingItems || remainingItems.length === 0) {
            await admin
              .from("orders")
              .update({ status: "cancelled" })
              .eq("id", batch.orderId);

            await admin
              .from("restaurant_tables")
              .update({ status: "empty" })
              .eq("id", batch.tableId);

            orderNotice = {
              orderId: batch.orderId,
              tableId: batch.tableId,
              tableNumber: batch.tableNumber,
              reason: reason || "Order cancelled by floor captain",
            };
          }

          if (batchItemsToReject && batchItemsToReject.length > 0) {
            await recordCancelledDishes(
              admin,
              batch.restaurantId,
              batchItemsToReject.map((it) => ({
                orderId: it.order_id,
                tableId: batch.tableId,
                tableNumber: batch.tableNumber,
                dishName: (it.menu_items as unknown as { name: string } | null)?.name || "Dish",
                qty: Number(it.qty) || 1,
                price: Number(it.unit_price) || 0,
                reason: reason || "Rejected by floor captain",
              })),
              orderNotice
            );
          }
        }

        return NextResponse.json({
          ok: true,
          action: "rejected",
          message: `Order for Table ${batch.tableNumber} rejected and discarded.`,
          batch: updatedBatch,
        });
      }
    } else if (batchId?.startsWith("batch_")) {
      // Direct DB batch fallback
      const orderId = batchId.replace("batch_", "");
      const { data: orderData } = await admin
        .from("orders")
        .select(`
          id,
          restaurant_id,
          table_id,
          restaurant_tables (id, table_number)
        `)
        .eq("id", orderId)
        .maybeSingle();

      if (orderData) {
        const tableNumber = (orderData.restaurant_tables as unknown as { table_number: string } | null)?.table_number || "T--";
        if (isApprove) {
          await admin
            .from("order_items")
            .update({ item_status: "preparing" })
            .eq("order_id", orderId)
            .eq("item_status", "pending");

          await admin
            .from("restaurant_tables")
            .update({ status: "pending" })
            .eq("id", orderData.table_id);

          return NextResponse.json({
            ok: true,
            action: "approved",
            message: `Order for Table ${tableNumber} approved and dispatched to Kitchen KOT.`,
          });
        } else if (isReject) {
          const { data: pendingItemsToReject } = await admin
            .from("order_items")
            .select(`
              id,
              order_id,
              unit_price,
              qty,
              menu_items (name)
            `)
            .eq("order_id", orderId)
            .eq("item_status", "pending");

          await admin
            .from("order_items")
            .delete()
            .eq("order_id", orderId)
            .eq("item_status", "pending");

          const { data: remainingItems } = await admin
            .from("order_items")
            .select("id")
            .eq("order_id", orderId);

          let orderNotice: { orderId: string; tableId: string; tableNumber: string; reason: string } | undefined;

          if (!remainingItems || remainingItems.length === 0) {
            await admin
              .from("orders")
              .update({ status: "cancelled" })
              .eq("id", orderId);

            await admin
              .from("restaurant_tables")
              .update({ status: "empty" })
              .eq("id", orderData.table_id);

            orderNotice = {
              orderId,
              tableId: orderData.table_id,
              tableNumber,
              reason: reason || "Order cancelled by floor captain",
            };
          }

          if (pendingItemsToReject && pendingItemsToReject.length > 0) {
            await recordCancelledDishes(
              admin,
              orderData.restaurant_id,
              pendingItemsToReject.map((it) => ({
                orderId: it.order_id,
                tableId: orderData.table_id,
                tableNumber,
                dishName: (it.menu_items as unknown as { name: string } | null)?.name || "Dish",
                qty: Number(it.qty) || 1,
                price: Number(it.unit_price) || 0,
                reason: reason || "Rejected by floor captain",
              })),
              orderNotice
            );
          }

          return NextResponse.json({
            ok: true,
            action: "rejected",
            message: `Order for Table ${tableNumber} rejected.`,
          });
        }
      }
    }

    return NextResponse.json({ message: "Invalid action or target." }, { status: 400 });
  } catch (err: unknown) {
    console.error("Order approval error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
