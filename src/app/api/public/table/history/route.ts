import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: table, error: tableError } = await supabase
      .from("restaurant_tables")
      .select("id")
      .eq("qr_token", token)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        opened_at,
        closed_at,
        order_items (
          id,
          menu_item_id,
          qty,
          unit_price,
          notes,
          item_status,
          created_at,
          menu_items (
            name,
            is_veg
          )
        ),
        bills (
          id,
          subtotal,
          tax_amount,
          cgst_amount,
          sgst_amount,
          total,
          payment_mode,
          payment_status,
          paid_at,
          bill_number
        )
      `)
      .eq("table_id", table.id)
      .gte("opened_at", twoDaysAgo)
      .order("opened_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ ok: false, error: "Error fetching orders" }, { status: 500 });
    }

    // Format response to ensure bill is correctly mapped
    const formattedOrders = orders?.map(order => {
      // bills is usually an array from supabase relations, so take first element or null
      const bill = Array.isArray(order.bills) ? order.bills[0] || null : order.bills || null;
      
      return {
        ...order,
        bill
      };
    }) || [];

    return NextResponse.json({ ok: true, orders: formattedOrders });

  } catch (err: any) {
    console.error("Table history error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
