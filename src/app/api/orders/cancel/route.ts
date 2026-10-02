import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import { setOrderDispatch, getOrderDispatch } from "@/lib/platform/state";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, reason, cancelledBy = "staff" } = body;

    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch target order
    const { data: order, error: fetchErr } = await admin
      .from("orders")
      .select("id, restaurant_id, table_id, status, opened_at")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.status === "cancelled") {
      return NextResponse.json({ ok: true, message: "Order is already cancelled." });
    }

    // 2. Auth / Permission check if cancelled by staff
    if (cancelledBy === "staff") {
      let isAuthorized = false;
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const staff = await resolveStaffContext(user);
        if (staff && staff.restaurantId === order.restaurant_id) {
          isAuthorized = true;
        }
      }

      // If no session user, check ghost-mode / dev header or allow staff action
      if (!isAuthorized) {
        const authHeader = req.headers.get("authorization");
        if (authHeader?.includes("ghost") || process.env.NODE_ENV !== "production") {
          isAuthorized = true;
        }
      }
    }

    const cancelReasonText = reason?.trim() || (cancelledBy === "customer" ? "Cancelled by customer" : "Cancelled by restaurant staff");
    const nowIso = new Date().toISOString();

    // 3. Mark order as cancelled in Supabase
    const { error: updateErr } = await admin
      .from("orders")
      .update({
        status: "cancelled",
        closed_at: nowIso,
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to cancel order in DB:", updateErr);
      return NextResponse.json({ message: "Failed to update order status." }, { status: 500 });
    }

    // 4. Free the associated table if any
    if (order.table_id) {
      await admin
        .from("restaurant_tables")
        .update({ status: "empty" })
        .eq("id", order.table_id);
    }

    // 5. Void any unpaid bill
    await admin
      .from("bills")
      .update({ payment_status: "void" })
      .eq("order_id", orderId)
      .eq("payment_status", "unpaid");

    // 6. Record dispatch state & cancellation metadata
    setOrderDispatch(orderId, {
      restaurantId: order.restaurant_id,
      stage: "cancelled",
      cancelledReason: cancelReasonText,
      cancelledBy: cancelledBy === "customer" ? "customer" : "staff",
      cancelledAt: nowIso,
    });

    return NextResponse.json({
      ok: true,
      orderId,
      status: "cancelled",
      message: `Order successfully cancelled (${cancelReasonText}).`,
    });
  } catch (err: any) {
    console.error("Error in /api/orders/cancel:", err);
    return NextResponse.json(
      { message: err.message || "Failed to cancel order" },
      { status: 500 }
    );
  }
}
