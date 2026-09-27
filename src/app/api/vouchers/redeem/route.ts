import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const staff = await resolveStaffContext(user);
    if (!staff) return NextResponse.json({ message: "Staff authentication required" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!code || !orderId) return NextResponse.json({ message: "Voucher code and orderId are required" }, { status: 400 });

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, restaurant_id")
      .eq("id", orderId)
      .eq("restaurant_id", staff.restaurantId)
      .eq("status", "open")
      .maybeSingle();
    if (!order) return NextResponse.json({ message: "Open order not found" }, { status: 404 });

    const { data: result, error } = await admin.rpc("redeem_voucher_atomic", {
      p_code: code,
      p_order_id: orderId,
      p_restaurant_id: staff.restaurantId,
      p_staff_id: staff.staffId,
    });
    if (error || !result) {
      const message = error?.message || "Voucher redemption failed";
      const status = /expired/i.test(message) ? 410 : /minimum/i.test(message) ? 422 : /already/i.test(message) ? 409 : 404;
      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Voucher redemption failed" }, { status: 500 });
  }
}
