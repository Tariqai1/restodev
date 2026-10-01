import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import { safeSetTableStatus } from "@/lib/tables/table-status";

async function getCallerPermissions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const staff = await resolveStaffContext(user);
  if (!user && !staff) return null;
  if (!staff) return null;

  const isOwnerOrManager = staff.isSuperAdmin || ["owner", "manager", "admin"].includes(staff.role);
  const perms = staff.permissions;

  return {
    user,
    staffId: staff.staffId,
    role: staff.role,
    isSuper: staff.isSuperAdmin,
    restaurantId: staff.restaurantId,
    isOwnerOrManager,
    canEdit: isOwnerOrManager || perms.canEditOrders || ["waiter", "captain"].includes(staff.role),
    canDelete: isOwnerOrManager || perms.canDeleteOrders,
  };
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerPermissions();
    if (!caller) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: order, error } = await admin
      .from("orders")
      .select(`
        id,
        table_id,
        status,
        opened_at,
        restaurant_tables (id, table_number),
        order_items (
          id,
          menu_item_id,
          qty,
          unit_price,
          notes,
          item_status,
          created_at,
          menu_items (id, name, is_veg, price)
        )
      `)
      .eq("id", orderId)
      .eq("restaurant_id", caller.restaurantId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerPermissions();
    if (!caller) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, orderId, itemId, qty } = body;

    const admin = createAdminClient();

    // 1. VOID / CANCEL ORDER
    if (action === "void_order" || action === "cancel_order") {
      if (!caller.canDelete) {
        return NextResponse.json(
          {
            message:
              "Permission Denied: Order deletion / voiding permission has not been granted to your staff profile by the restaurant owner.",
          },
          { status: 403 }
        );
      }

      if (!orderId) {
        return NextResponse.json({ message: "orderId is required" }, { status: 400 });
      }

      const { data: order } = await admin
        .from("orders")
        .select("id, table_id")
        .eq("id", orderId)
        .eq("restaurant_id", caller.restaurantId)
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ message: "Order not found" }, { status: 404 });
      }

      const { error: cancelError } = await admin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("restaurant_id", caller.restaurantId);
      if (cancelError) throw cancelError;

      if (order.table_id) {
        await safeSetTableStatus(admin, order.table_id, "empty", caller.restaurantId);
      }

      return NextResponse.json({ ok: true, message: "Order has been successfully voided and table freed." });
    }

    // 2. EDIT ORDER (Add items, modify quantity, remove item, restore item for Undo)
    if (action === "update_qty" || action === "remove_item" || action === "add_items" || action === "restore_item") {
      if (!caller.canEdit) {
        return NextResponse.json(
          {
            message:
              "Permission Denied: Order editing permission has not been granted to your staff profile by the restaurant owner.",
          },
          { status: 403 }
        );
      }

      // ADD ITEMS TO RUNNING ORDER
      if (action === "add_items") {
        const { orderId, items } = body as {
          orderId: string;
          items: Array<{ menuItemId: string; qty: number; portion?: "half" | "full"; notes?: string }>;
        };

        if (!orderId || !Array.isArray(items) || items.length === 0) {
          return NextResponse.json({ message: "orderId and items array required" }, { status: 400 });
        }

        const { data: order } = await admin
          .from("orders")
          .select("id, restaurant_id, table_id")
          .eq("id", orderId)
          .eq("restaurant_id", caller.restaurantId)
          .maybeSingle();

        if (!order) {
          return NextResponse.json({ message: "Order not found" }, { status: 404 });
        }

        const itemIds = items.map((i) => i.menuItemId);
        const { data: menuItems } = await admin
          .from("menu_items")
          .select("id, name, price, is_available")
          .eq("restaurant_id", caller.restaurantId)
          .in("id", itemIds);

        const priceMap = new Map<string, number>();
        for (const mi of menuItems || []) {
          priceMap.set(mi.id, Number(mi.price) || 0);
        }

        const itemsToInsert = items
          .filter((i) => priceMap.has(i.menuItemId))
          .map((i) => {
            const cleanQty = Math.max(1, Math.min(30, Math.floor(Number(i.qty)) || 1));
            const basePrice = priceMap.get(i.menuItemId) || 0;
            const portion = i.portion === "half" ? "half" : "full";
            const unitPrice = portion === "half" ? Math.round(basePrice * 0.6) : basePrice;
            const portionLabel = portion === "half" ? "Half Portion" : "";
            const cleanNotes = i.notes
              ? (portionLabel && !i.notes.includes("Half") ? `${portionLabel} • ${i.notes}` : i.notes).trim().slice(0, 200)
              : (portionLabel || null);

            return {
              order_id: orderId,
              menu_item_id: i.menuItemId,
              qty: cleanQty,
              unit_price: unitPrice,
              notes: cleanNotes,
              item_status: "preparing" as const, // Floor additions fire directly to kitchen
            };
          });

        if (itemsToInsert.length === 0) {
          return NextResponse.json({ message: "No valid menu items to add" }, { status: 400 });
        }

        const { data: inserted, error: insertError } = await admin
          .from("order_items")
          .insert(itemsToInsert)
          .select("id, menu_item_id, qty, unit_price, notes, item_status");

        if (insertError) throw insertError;

        return NextResponse.json({
          ok: true,
          message: `${inserted.length} item(s) added and fired to kitchen.`,
          inserted,
        });
      }

      // RESTORE ITEM (5s Undo)
      if (action === "restore_item") {
        const { orderId, menuItemId, qty, unitPrice, notes } = body;
        if (!orderId || !menuItemId) {
          return NextResponse.json({ message: "orderId and menuItemId required" }, { status: 400 });
        }

        const { data: restored, error: restoreError } = await admin
          .from("order_items")
          .insert({
            order_id: orderId,
            menu_item_id: menuItemId,
            qty: Math.max(1, Number(qty) || 1),
            unit_price: Number(unitPrice) || 0,
            notes: notes || null,
            item_status: "preparing",
          })
          .select("id, menu_item_id, qty, unit_price, notes, item_status")
          .single();

        if (restoreError) throw restoreError;

        return NextResponse.json({
          ok: true,
          message: "Item restored to order.",
          item: restored,
        });
      }

      // UPDATE QUANTITY
      if (action === "update_qty") {
        if (!itemId || qty === undefined) {
          return NextResponse.json({ message: "itemId and qty required" }, { status: 400 });
        }

        const { data: scopedItem } = await admin
          .from("order_items")
          .select("id, orders!inner(restaurant_id)")
          .eq("id", itemId)
          .eq("orders.restaurant_id", caller.restaurantId)
          .maybeSingle();
        if (!scopedItem) return NextResponse.json({ message: "Order item not found" }, { status: 404 });

        if (Number(qty) <= 0) {
          await admin.from("order_items").delete().eq("id", itemId);
        } else {
          await admin
            .from("order_items")
            .update({ qty: Number(qty) })
            .eq("id", itemId);
        }

        return NextResponse.json({ ok: true, message: "Order item updated." });
      }

      // REMOVE ITEM (With item details returned for Undo toast)
      if (action === "remove_item") {
        const { reason } = body;
        if (!itemId) {
          return NextResponse.json({ message: "itemId required" }, { status: 400 });
        }
        const { data: scopedItem } = await admin
          .from("order_items")
          .select("id, order_id, menu_item_id, qty, unit_price, notes, menu_items(name), orders!inner(restaurant_id, table_id)")
          .eq("id", itemId)
          .eq("orders.restaurant_id", caller.restaurantId)
          .maybeSingle();

        if (!scopedItem) return NextResponse.json({ message: "Order item not found" }, { status: 404 });

        await admin.from("order_items").delete().eq("id", itemId);

        return NextResponse.json({
          ok: true,
          message: "Item removed from order.",
          removedItem: {
            id: scopedItem.id,
            orderId: scopedItem.order_id,
            menuItemId: scopedItem.menu_item_id,
            dishName: (scopedItem.menu_items as unknown as { name: string } | null)?.name || "Dish",
            qty: scopedItem.qty,
            unitPrice: scopedItem.unit_price,
            notes: scopedItem.notes,
            reason: reason || null,
          },
        });
      }
    }

    // 3. MERGE / JOIN TABLES (e.g. Table T02 joined with Table T01)
    if (action === "merge_tables") {
      const { sourceTableNumber, targetTableNumber } = body;
      if (!sourceTableNumber || !targetTableNumber) {
        return NextResponse.json(
          { message: "sourceTableNumber and targetTableNumber required" },
          { status: 400 }
        );
      }
      if (sourceTableNumber === targetTableNumber) {
        return NextResponse.json(
          { message: "Cannot merge table into itself" },
          { status: 400 }
        );
      }

      // Find both tables
      const { data: tables } = await admin
        .from("restaurant_tables")
        .select("id, table_number, status, restaurant_id")
        .in("table_number", [sourceTableNumber, targetTableNumber]);

      const scopedTables = caller.isSuper ? tables : tables?.filter((table) => table.restaurant_id === caller.restaurantId);
      const sourceTable = scopedTables?.find((t) => t.table_number === sourceTableNumber);
      const targetTable = scopedTables?.find((t) => t.table_number === targetTableNumber);

      if (!sourceTable || !targetTable) {
        return NextResponse.json(
          { message: "One or both tables not found" },
          { status: 404 }
        );
      }

      // Find or create active order for target table
      let { data: targetOrder } = await admin
        .from("orders")
        .select("id, status, table_session_id")
        .eq("table_id", targetTable.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!targetOrder) {
        const { data: newOrder, error: createErr } = await admin
          .from("orders")
          .insert({
            restaurant_id: targetTable.restaurant_id,
            table_id: targetTable.id,
            status: "open",
            opened_at: new Date().toISOString(),
          })
          .select("id, status, table_session_id")
          .single();

        if (createErr) throw createErr;
        targetOrder = newOrder;
      }

      // Find active order for source table
      const { data: sourceOrder } = await admin
        .from("orders")
        .select("id, status, table_session_id")
        .eq("table_id", sourceTable.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let movedItemsCount = 0;
      if (sourceOrder && sourceOrder.id !== targetOrder.id) {
        // Move all items from sourceOrder to targetOrder
        const { data: movedItems } = await admin
          .from("order_items")
          .update({ order_id: targetOrder.id })
          .eq("order_id", sourceOrder.id)
          .select("id");

        movedItemsCount = movedItems?.length || 0;
      }

      // Update targetOrder table_session_id to record all joined tables
      const existingJoinedStr = targetOrder.table_session_id || "";
      const currentJoined = existingJoinedStr.startsWith("joined:")
        ? existingJoinedStr.replace("joined:", "").split(",").map((s: string) => s.trim())
        : [targetTableNumber];

      if (!currentJoined.includes(sourceTableNumber)) {
        currentJoined.push(sourceTableNumber);
      }
      if (!currentJoined.includes(targetTableNumber)) {
        currentJoined.unshift(targetTableNumber);
      }
      const newJoinedStr = `joined:${currentJoined.join(",")}`;

      await admin
        .from("orders")
        .update({ table_session_id: newJoinedStr })
        .eq("id", targetOrder.id);

      // In sourceTable, keep/create open order with table_session_id: "merged_into:T01"
      if (sourceOrder) {
        await admin
          .from("orders")
          .update({
            status: "open",
            table_session_id: `merged_into:${targetTableNumber}`,
          })
          .eq("id", sourceOrder.id);
      } else {
        await admin
          .from("orders")
          .insert({
            restaurant_id: sourceTable.restaurant_id,
            table_id: sourceTable.id,
            status: "open",
            opened_at: new Date().toISOString(),
            table_session_id: `merged_into:${targetTableNumber}`,
          });
      }

      // Mark source table as occupied (linked with targetTable)
      await safeSetTableStatus(admin, sourceTable.id, "served", caller.restaurantId);

      // Ensure target table is also served/occupied
      await safeSetTableStatus(admin, targetTable.id, "served", caller.restaurantId);

      return NextResponse.json({
        ok: true,
        message: `Table ${sourceTableNumber} successfully joined with Table ${targetTableNumber}. ${movedItemsCount > 0 ? `${movedItemsCount} active dishes merged into group bill.` : "Tables linked."}`,
        targetOrderId: targetOrder.id,
        joinedTables: currentJoined,
      });
    }

    // 4. TRANSFER / MOVE TABLE (e.g. Move party from Table T01 to Table T05)
    if (action === "transfer_table") {
      const { currentTableNumber, newTableNumber, orderId } = body;
      if (!currentTableNumber || !newTableNumber) {
        return NextResponse.json(
          { message: "currentTableNumber and newTableNumber required" },
          { status: 400 }
        );
      }

      const { data: tables } = await admin
        .from("restaurant_tables")
        .select("id, table_number, restaurant_id")
        .in("table_number", [currentTableNumber, newTableNumber]);

      const scopedTables = caller.isSuper ? tables : tables?.filter((table) => table.restaurant_id === caller.restaurantId);
      const curTable = scopedTables?.find((t) => t.table_number === currentTableNumber);
      const nxtTable = scopedTables?.find((t) => t.table_number === newTableNumber);

      if (!curTable || !nxtTable) {
        return NextResponse.json({ message: "Table records not found" }, { status: 404 });
      }

      // Locate active order
      let ordId = orderId;
      if (!ordId) {
        const { data: activeOrder } = await admin
          .from("orders")
          .select("id")
          .eq("table_id", curTable.id)
          .eq("restaurant_id", caller.restaurantId)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activeOrder) {
          return NextResponse.json(
            { message: `No active order found on Table ${currentTableNumber}` },
            { status: 404 }
          );
        }
        ordId = activeOrder.id;
      }

      // Shift order to new table
      const { error: transferError } = await admin
        .from("orders")
        .update({ table_id: nxtTable.id })
        .eq("id", ordId)
        .eq("restaurant_id", caller.restaurantId);
      if (transferError) throw transferError;

      // Free previous table, mark new table occupied
      await safeSetTableStatus(admin, curTable.id, "empty", caller.restaurantId);
      await safeSetTableStatus(admin, nxtTable.id, "served", caller.restaurantId);

      return NextResponse.json({
        ok: true,
        message: `Order on Table ${currentTableNumber} transferred to Table ${newTableNumber}.`,
      });
    }

    return NextResponse.json({ message: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("Manage order error:", err);
    const msg = err?.message || err?.details || (typeof err === "string" ? err : "Order operation failed");
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
