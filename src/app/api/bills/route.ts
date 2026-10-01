import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import { getCashRegisterState, setCashRegisterState } from "@/lib/platform/state";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ message: "Staff context required" }, { status: 403 });
    }

    const targetRestaurantId = staffContext.restaurantId;
    if (!targetRestaurantId) {
      return NextResponse.json({ message: "Restaurant ID not found" }, { status: 404 });
    }

    const admin = createAdminClient();

    // Query orders with bills and tables scoped by this restaurant
    const { data: ordersWithBills, error } = await admin
      .from("orders")
      .select(`
        id,
        restaurant_id,
        status,
        opened_at,
        closed_at,
        restaurant_tables (
          id,
          table_number
        ),
        bills (
          id,
          bill_number,
          subtotal,
          tax_amount,
          total,
          payment_mode,
          payment_status,
          paid_at,
          updated_at
        )
      `)
      .eq("restaurant_id", targetRestaurantId)
      .order("opened_at", { ascending: false });

    if (error) {
      console.error("[/api/bills GET] Error fetching orders with bills:", error);
      return NextResponse.json({ message: "Failed to query bills", details: error.message }, { status: 500 });
    }

    const allBills: Array<{
      id: string;
      order_id: string;
      table_number: string;
      bill_number: string;
      subtotal: number;
      tax_amount: number;
      total: number;
      payment_mode: string;
      payment_status: "paid" | "unpaid";
      created_at: string;
    }> = [];

    for (const ord of ordersWithBills || []) {
      const tblData = ord.restaurant_tables as unknown as { table_number: string } | null;
      const tblNumber = tblData?.table_number || "T--";
      const rawBills = Array.isArray(ord.bills) ? ord.bills : ord.bills ? [ord.bills] : [];

      for (const b of rawBills) {
        if (b && b.id) {
          allBills.push({
            id: b.id,
            order_id: ord.id,
            table_number: tblNumber,
            bill_number: b.bill_number || `INV-${b.id.slice(0, 6).toUpperCase()}`,
            subtotal: Number(b.subtotal) || 0,
            tax_amount: Number(b.tax_amount) || 0,
            total: Number(b.total) || 0,
            payment_mode: (b.payment_mode || "cash").toLowerCase(),
            payment_status: b.payment_status === "paid" ? "paid" : "unpaid",
            created_at: b.paid_at || b.updated_at || ord.opened_at,
          });
        }
      }
    }

    // Filter today's settled bills
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySettledBills = allBills.filter(
      (b) => b.payment_status === "paid" && new Date(b.created_at) >= todayStart
    );

    const cashSales = todaySettledBills
      .filter((b) => b.payment_mode === "cash")
      .reduce((sum, b) => sum + b.total, 0);

    const upiSales = todaySettledBills
      .filter((b) => b.payment_mode === "upi" || b.payment_mode === "online" || b.payment_mode === "qr")
      .reduce((sum, b) => sum + b.total, 0);

    const cardSales = todaySettledBills
      .filter((b) => b.payment_mode === "card" || b.payment_mode === "pos")
      .reduce((sum, b) => sum + b.total, 0);

    const totalSales = cashSales + upiSales + cardSales;
    const registerState = getCashRegisterState(targetRestaurantId);

    return NextResponse.json({
      ok: true,
      bills: allBills,
      todaySettledBills,
      metrics: {
        totalSales,
        cashSales,
        upiSales,
        cardSales,
        settledCount: todaySettledBills.length,
      },
      registerState,
    });
  } catch (err: any) {
    console.error("[/api/bills GET] Unhandled error:", err);
    return NextResponse.json({ message: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ message: "Staff context required" }, { status: 403 });
    }

    const targetRestaurantId = staffContext.restaurantId;
    if (!targetRestaurantId) {
      return NextResponse.json({ message: "Restaurant ID not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { openingFloat, isClosed, closedAt, denominations, notes } = body;

    const updatedState = setCashRegisterState(targetRestaurantId, {
      openingFloat: openingFloat !== undefined ? Number(openingFloat) : undefined,
      isClosed: isClosed !== undefined ? Boolean(isClosed) : undefined,
      closedAt: closedAt !== undefined ? closedAt : isClosed ? new Date().toISOString() : null,
      closedBy: staffContext.name || user.email,
      denominations,
      notes,
    });

    return NextResponse.json({
      ok: true,
      registerState: updatedState,
    });
  } catch (err: any) {
    console.error("[/api/bills POST] Unhandled error:", err);
    return NextResponse.json({ message: err?.message || "Internal server error" }, { status: 500 });
  }
}
