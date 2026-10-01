import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import { safeSetTableStatus, safeFreeTableByNumber } from "@/lib/tables/table-status";

const isUuid = (val: unknown): val is string =>
  typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const staffContext = await resolveStaffContext(user);
    if (!user && !staffContext) {
      return NextResponse.json({ message: "Staff authentication required" }, { status: 401 });
    }

    if (!staffContext) return NextResponse.json({ message: "Staff access required" }, { status: 403 });
    const restaurantId = staffContext.restaurantId;

    const body = await request.json().catch(() => ({}));
    const { tableNumber, tableId, orderId, paymentMode = "cash", extraTableNumbers } = body;

    const admin = createAdminClient();

    let targetOrderId = orderId || null;
    let targetTableId = tableId || null;
    let activeOrderSessionId: string | null = null;
    let orderStatus: string | null = null;

    // 1. If direct orderId provided, fetch order details directly
    if (targetOrderId) {
      const { data: directOrd } = await admin
        .from("orders")
        .select("id, table_id, table_session_id, status")
        .eq("id", targetOrderId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (directOrd) {
        targetTableId = targetTableId || directOrd.table_id;
        activeOrderSessionId = directOrd.table_session_id || null;
        orderStatus = directOrd.status;
      }
    }

    // 2. If tableId not known yet, resolve from tableNumber scoped by restaurant
    if (!targetTableId && tableNumber) {
      let tableQuery = admin
        .from("restaurant_tables")
        .select("id, table_number")
        .eq("table_number", String(tableNumber).trim());

      if (restaurantId) {
        tableQuery = tableQuery.eq("restaurant_id", restaurantId);
      }

      const { data: tableData } = await tableQuery.maybeSingle();
      if (tableData) {
        targetTableId = tableData.id;
      } else {
        const raw = String(tableNumber).trim();
        const digits = raw.replace(/\D/g, "");
        const num = digits ? parseInt(digits, 10).toString() : raw;
        const variants = Array.from(
          new Set([raw, `T${num}`, `T0${num}`, `Table ${num}`, `Table T${num}`, num])
        );

        let altQuery = admin.from("restaurant_tables").select("id, table_number").in("table_number", variants);

        if (restaurantId) {
          altQuery = altQuery.eq("restaurant_id", restaurantId);
        }

        const { data: altList } = await altQuery.limit(1);
        if (altList && altList.length > 0) {
          targetTableId = altList[0].id;
        }
      }
    }

    // 3. If targetOrderId still not known, find the open order on this table
    if (!targetOrderId && targetTableId) {
      const { data: activeOrder } = await admin
        .from("orders")
        .select("id, table_id, table_session_id, restaurant_id, status")
        .eq("table_id", targetTableId)
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeOrder) {
        targetOrderId = activeOrder.id;
        activeOrderSessionId = activeOrder.table_session_id || null;
        orderStatus = activeOrder.status;
      } else {
        // Table has no open order, ensure it is safely transitioned to empty
        await safeSetTableStatus(admin, targetTableId, "empty", restaurantId);

        return NextResponse.json({
          ok: true,
          message: "No active order on table. Table status reset to available.",
        });
      }
    }

    if (!targetOrderId) {
      if (targetTableId) {
        await safeSetTableStatus(admin, targetTableId, "empty", restaurantId);
        return NextResponse.json({
          ok: true,
          message: "No active order found. Table freed successfully.",
        });
      }

      return NextResponse.json({ message: "Unable to locate table or active order for settlement." }, { status: 400 });
    }

    const validPaymentMode = ["cash", "upi", "card"].includes(paymentMode) ? paymentMode : "cash";
    const recordedByUuid = isUuid(staffContext?.staffId) ? staffContext.staffId : null;

    // Determine all tables that should be freed
    let allJoinedTables: string[] = [];
    if (activeOrderSessionId?.startsWith("joined:")) {
      allJoinedTables = activeOrderSessionId.replace("joined:", "").split(",").map((s: string) => s.trim());
    } else if (targetOrderId) {
      const { data: ord } = await admin
        .from("orders")
        .select("table_session_id")
        .eq("id", targetOrderId)
        .maybeSingle();
      if (ord?.table_session_id?.startsWith("joined:")) {
        allJoinedTables = ord.table_session_id.replace("joined:", "").split(",").map((s: string) => s.trim());
      }
    }

    const tablesToFree = Array.from(
      new Set([...(Array.isArray(extraTableNumbers) ? extraTableNumbers : []), ...allJoinedTables])
    ).filter(Boolean);

    // If order was ALREADY closed (e.g. earlier failed table transition), ensure table is now freed
    if (orderStatus === "closed") {
      if (targetTableId) {
        await safeSetTableStatus(admin, targetTableId, "empty", restaurantId);
      }
      for (const tblNum of tablesToFree) {
        await safeFreeTableByNumber(admin, tblNum, restaurantId);
      }

      const { data: existingBill } = await admin
        .from("bills")
        .select("*")
        .eq("order_id", targetOrderId)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        message: "Order was already closed. Table has been freed.",
        bill: existingBill,
      });
    }

    // Try atomic settlement RPC if installed and valid UUID available
    if (recordedByUuid) {
      const { data: atomicSettlement, error: atomicSettlementError } = await admin.rpc("settle_order_atomic", {
        p_order_id: targetOrderId,
        p_payment_mode: validPaymentMode,
        p_recorded_by: recordedByUuid,
        p_extra_table_numbers: tablesToFree,
      });

      if (!atomicSettlementError && atomicSettlement) {
        return NextResponse.json({
          ok: true,
          message: "Order successfully settled. Table is now available.",
          bill: atomicSettlement,
        });
      }
    }

    // Fetch order items to compute totals
    const { data: orderItems, error: itemsErr } = await admin
      .from("order_items")
      .select(`
        id,
        qty,
        unit_price,
        menu_items (price)
      `)
      .eq("order_id", targetOrderId);

    if (itemsErr) {
      return NextResponse.json({ message: "Failed to retrieve order items" }, { status: 500 });
    }

    type MenuItemJoin = { price: number } | null;
    const items = orderItems || [];
    const subtotal = items.reduce((sum, item) => {
      const menuData = item.menu_items as unknown as MenuItemJoin;
      const rate = Number(item.unit_price) || Number(menuData?.price) || 0;
      return sum + Number(item.qty) * rate;
    }, 0);

    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    // Check existing bill
    const { data: existingBill } = await admin
      .from("bills")
      .select("id, subtotal, tax_amount, total, payment_mode, payment_status, paid_at")
      .eq("order_id", targetOrderId)
      .maybeSingle();

    let billRecord = existingBill;

    if (!billRecord) {
      const { data: newBill, error: billErr } = await admin
        .from("bills")
        .insert({
          order_id: targetOrderId,
          subtotal,
          tax_amount: taxAmount,
          total,
          payment_mode: validPaymentMode,
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (billErr) {
        const { data: racedBill } = await admin
          .from("bills")
          .select("id, subtotal, tax_amount, total, payment_mode, payment_status, paid_at")
          .eq("order_id", targetOrderId)
          .maybeSingle();

        if (racedBill) {
          billRecord = racedBill;
        } else {
          return NextResponse.json({ message: billErr.message }, { status: 500 });
        }
      } else {
        billRecord = newBill;
      }
    } else if (billRecord.payment_status !== "paid") {
      const { data: updatedBill } = await admin
        .from("bills")
        .update({
          payment_status: "paid",
          payment_mode: validPaymentMode,
          paid_at: new Date().toISOString(),
        })
        .eq("id", billRecord.id)
        .select()
        .single();

      if (updatedBill) {
        billRecord = updatedBill;
      }
    }

    // Record transaction in ledger if bill exists
    if (billRecord?.id) {
      try {
        await admin.from("payment_transactions").insert({
          bill_id: billRecord.id,
          amount: total,
          mode: validPaymentMode,
          type: "payment",
          reference_number: `settle:${targetOrderId}`,
          ...(recordedByUuid ? { recorded_by: recordedByUuid } : {}),
        });
      } catch (ptErr) {
        console.warn("Payment ledger insert non-fatal warning:", ptErr);
      }
    }

    // Mark Order as Closed
    const { error: closeError } = await admin
      .from("orders")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", targetOrderId)
      .eq("restaurant_id", restaurantId);

    if (closeError) {
      console.warn("Order close update warning:", closeError);
    }

    // Safely free the primary table
    if (targetTableId) {
      const freeRes = await safeSetTableStatus(admin, targetTableId, "empty", restaurantId);
      if (!freeRes.success) {
        console.warn("Failed to free table:", freeRes.error);
      }
    }

    // Safely free any joined extra tables
    for (const tblNum of tablesToFree) {
      await safeFreeTableByNumber(admin, tblNum, restaurantId);
    }

    return NextResponse.json({
      ok: true,
      message: "Order successfully settled. Table is now available.",
      bill: billRecord,
    });
  } catch (error: any) {
    console.error("Settlement error:", error);
    const msg = error?.message || error?.details || (typeof error === "string" ? error : "Settlement failed");
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
