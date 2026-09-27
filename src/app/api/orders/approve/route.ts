import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminUser } from "@/lib/auth/super-admin";
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

  const isSuper = await isSuperAdminUser(user);
  const cookieStore = await cookies();
  const activeStaffRaw = cookieStore.get("od_active_staff")?.value;

  let staffId = user.id;
  let role = "staff";

  if (activeStaffRaw) {
    try {
      const parsed = JSON.parse(activeStaffRaw);
      staffId = parsed.staffId || user.id;
      role = parsed.role || "staff";
    } catch {
      // ignore
    }
  } else {
    const admin = createAdminClient();
    const { data: dbStaff } = await admin
      .from("staff_users")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (dbStaff) {
      staffId = dbStaff.id;
      role = dbStaff.role;
    }
  }

  return {
    user,
    staffId,
    role,
    isSuper,
  };
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
          orders (
            id,
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
        table_id: string;
        restaurant_tables: { id: string; table_number: string } | null;
      } | null);
      const tableId = tableInfo?.table_id;
      const orderId = itemData.order_id;

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
          message: "Dish approved and dispatched to Kitchen KOT!",
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
        }

        return NextResponse.json({
          ok: true,
          action: "item_rejected",
          message: "Dish cancelled and removed from order.",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASE 2: TABLE-WIDE APPROVAL / REJECTION (ALL PENDING FOR TABLE)
    // ─────────────────────────────────────────────────────────────
    if (tableNumber && (!batchId || batchId === "all")) {
      // Direct database lookup for all open orders and pending items on this table
      const { data: tableData } = await admin
        .from("restaurant_tables")
        .select("id")
        .eq("table_number", tableNumber)
        .maybeSingle();

      if (tableData) {
        const { data: openOrders } = await admin
          .from("orders")
          .select("id")
          .eq("table_id", tableData.id)
          .eq("status", "open");

        const orderIds = (openOrders || []).map((o) => o.id);

        if (orderIds.length > 0) {
          if (isApprove) {
            // Promote ALL 'pending' items in database to 'preparing'
            await admin
              .from("order_items")
              .update({ item_status: "preparing" })
              .in("order_id", orderIds)
              .eq("item_status", "pending");

            await admin
              .from("restaurant_tables")
              .update({ status: "pending" })
              .eq("id", tableData.id);
          } else if (isReject) {
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

            if (!anyRemaining || anyRemaining.length === 0) {
              await admin
                .from("orders")
                .update({ status: "cancelled" })
                .in("id", orderIds);

              await admin
                .from("restaurant_tables")
                .update({ status: "empty" })
                .eq("id", tableData.id);
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

    if (!batch) {
      return NextResponse.json({ message: "Order verification batch not found." }, { status: 404 });
    }

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
        await admin
          .from("order_items")
          .delete()
          .in("id", batch.itemIds);
      }

      const { data: remainingItems } = await admin
        .from("order_items")
        .select("id")
        .eq("order_id", batch.orderId);

      if (!remainingItems || remainingItems.length === 0) {
        await admin
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", batch.orderId);

        await admin
          .from("restaurant_tables")
          .update({ status: "empty" })
          .eq("id", batch.tableId);
      }

      return NextResponse.json({
        ok: true,
        action: "rejected",
        message: `Order for Table ${batch.tableNumber} rejected and discarded.`,
        batch: updatedBatch,
      });
    }

    return NextResponse.json({ message: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    console.error("Order approval error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
