import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurantOfferConfig } from "@/lib/platform/state";

function makeVoucherCode(prefix: string) {
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16) || "DINE";
  return `${cleanPrefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return NextResponse.json({ message: "Table token required" }, { status: 400 });

    const admin = createAdminClient();
    const { data: table, error: tableError } = await admin
      .from("restaurant_tables")
      .select("id, restaurant_id, table_number, qr_token_expires_at, qr_token_revoked_at")
      .eq("qr_token", token)
      .maybeSingle();
    if (
      tableError ||
      !table ||
      table.qr_token_revoked_at ||
      (table.qr_token_expires_at && new Date(table.qr_token_expires_at).getTime() <= Date.now())
    ) {
      return NextResponse.json({ message: "Invalid or expired table QR code" }, { status: 404 });
    }

    const config = getRestaurantOfferConfig(table.restaurant_id);
    if (!config.active || config.validityDays === 0) {
      return NextResponse.json({ message: "Voucher offer is not active" }, { status: 409 });
    }

    const { data: existing } = await admin
      .from("vouchers")
      .select("id, code, reward_title, reward_subtitle, discount_amount, min_order_value, expires_at")
      .eq("restaurant_id", table.restaurant_id)
      .eq("issued_table_id", table.id)
      .eq("status", "issued")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, voucher: existing });

    const discountMatch = (config.bounceBackReward || "").match(/₹\s*([\d,]+)/i);
    const discountAmount = discountMatch ? Number(discountMatch[1].replace(/,/g, "")) : 0;
    const expiresAt = new Date(Date.now() + (config.validityDays || 15) * 86400000).toISOString();
    const rewardTitle = config.bounceBackReward || "Dining voucher";
    const rewardSubtitle = `Valid on orders above ₹${config.minOrderValue || 0} on your next visit`;

    const { data: voucher, error } = await admin
      .from("vouchers")
      .insert({
        restaurant_id: table.restaurant_id,
        issued_table_id: table.id,
        code: makeVoucherCode(config.bounceBackCode || "DINE"),
        reward_title: rewardTitle,
        reward_subtitle: rewardSubtitle,
        discount_amount: discountAmount,
        min_order_value: config.minOrderValue || 0,
        expires_at: expiresAt,
      })
      .select("id, code, reward_title, reward_subtitle, discount_amount, min_order_value, expires_at")
      .single();

    if (error || !voucher) {
      const { data: racedVoucher } = await admin
        .from("vouchers")
        .select("id, code, reward_title, reward_subtitle, discount_amount, min_order_value, expires_at")
        .eq("restaurant_id", table.restaurant_id)
        .eq("issued_table_id", table.id)
        .eq("status", "issued")
        .maybeSingle();
      if (racedVoucher) return NextResponse.json({ ok: true, voucher: racedVoucher });
      return NextResponse.json({ message: error?.message || "Unable to issue voucher" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, voucher });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Voucher issuance failed" }, { status: 500 });
  }
}
