import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getGstFilingStatuses,
  setGstFilingStatus,
  GstFilingStatusValue,
} from "@/lib/platform/state";

interface MonthlyTaxRecord {
  monthKey: string;
  month: string;
  year: number;
  monthIndex: number; // 0-11
  taxableSales: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  billCount: number;
  status: GstFilingStatusValue;
  isCurrentOrFuture: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

    // 1. Fetch restaurant info
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name, gstin")
      .eq("id", targetRestaurantId)
      .maybeSingle();

    // 2. Fetch all orders with bills
    const { data: ordersWithBills, error: billsErr } = await admin
      .from("orders")
      .select(`
        id,
        restaurant_id,
        opened_at,
        bills (
          id,
          bill_number,
          subtotal,
          tax_amount,
          cgst_amount,
          sgst_amount,
          total,
          payment_status,
          paid_at,
          created_at
        )
      `)
      .eq("restaurant_id", targetRestaurantId);

    if (billsErr) {
      console.error("[/api/taxes GET] Error fetching bills:", billsErr);
      return NextResponse.json({ message: "Failed to query bills" }, { status: 500 });
    }

    // 3. Extract paid bills with date
    interface PaidBill {
      id: string;
      subtotal: number;
      tax_amount: number;
      cgst_amount: number;
      sgst_amount: number;
      total: number;
      date: Date;
    }

    const paidBills: PaidBill[] = [];

    for (const ord of ordersWithBills || []) {
      const rawBills = Array.isArray(ord.bills) ? ord.bills : ord.bills ? [ord.bills] : [];
      for (const b of rawBills) {
        if (b && b.id && b.payment_status === "paid") {
          const dateStr = b.paid_at || b.created_at || ord.opened_at;
          const billDate = dateStr ? new Date(dateStr) : new Date();
          const subtotal = Number(b.subtotal) || (Number(b.total) ? Math.round((Number(b.total) / 1.05) * 100) / 100 : 0);
          const tax = Number(b.tax_amount) || Math.round(subtotal * 0.05 * 100) / 100;
          const cgst = Number(b.cgst_amount) || Math.round((tax / 2) * 100) / 100;
          const sgst = Number(b.sgst_amount) || Math.round((tax / 2) * 100) / 100;

          paidBills.push({
            id: b.id,
            subtotal,
            tax_amount: tax,
            cgst_amount: cgst,
            sgst_amount: sgst,
            total: Number(b.total) || subtotal + tax,
            date: billDate,
          });
        }
      }
    }

    // 4. Calculate available Financial Years
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentFyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const currentFy = `${currentFyStartYear}-${currentFyStartYear + 1}`;

    const fySet = new Set<string>();
    fySet.add(currentFy);
    fySet.add(`${currentFyStartYear - 1}-${currentFyStartYear}`);
    fySet.add(`${currentFyStartYear - 2}-${currentFyStartYear - 1}`);

    for (const b of paidBills) {
      const y = b.date.getFullYear();
      const m = b.date.getMonth();
      const fyStart = m >= 3 ? y : y - 1;
      fySet.add(`${fyStart}-${fyStart + 1}`);
    }

    const availableFYs = Array.from(fySet).sort().reverse();

    // 5. Selected FY
    const { searchParams } = new URL(req.url);
    const requestedFY = searchParams.get("fy");
    const selectedFY = requestedFY && availableFYs.includes(requestedFY) ? requestedFY : currentFy;

    const [startYearStr, endYearStr] = selectedFY.split("-");
    const fyStartYear = parseInt(startYearStr, 10);
    const fyEndYear = parseInt(endYearStr, 10);

    // 6. Indian FY Month Sequence: April (3) to Dec (11) of startYear, then Jan (0) to March (2) of endYear
    const monthConfigs = [
      { monthIndex: 3, year: fyStartYear, name: "April" },
      { monthIndex: 4, year: fyStartYear, name: "May" },
      { monthIndex: 5, year: fyStartYear, name: "June" },
      { monthIndex: 6, year: fyStartYear, name: "July" },
      { monthIndex: 7, year: fyStartYear, name: "August" },
      { monthIndex: 8, year: fyStartYear, name: "September" },
      { monthIndex: 9, year: fyStartYear, name: "October" },
      { monthIndex: 10, year: fyStartYear, name: "November" },
      { monthIndex: 11, year: fyStartYear, name: "December" },
      { monthIndex: 0, year: fyEndYear, name: "January" },
      { monthIndex: 1, year: fyEndYear, name: "February" },
      { monthIndex: 2, year: fyEndYear, name: "March" },
    ];

    const savedStatuses = getGstFilingStatuses(targetRestaurantId);

    const records: MonthlyTaxRecord[] = monthConfigs.map((cfg) => {
      const monthKey = `${cfg.year}-${String(cfg.monthIndex + 1).padStart(2, "0")}`;
      const monthLabel = `${cfg.name} ${cfg.year}`;

      // Check if month is current or future relative to now
      const isFuture =
        cfg.year > currentYear ||
        (cfg.year === currentYear && cfg.monthIndex > currentMonth);
      const isCurrent =
        cfg.year === currentYear && cfg.monthIndex === currentMonth;

      // Filter bills falling into this month
      const matchingBills = paidBills.filter((b) => {
        return (
          b.date.getFullYear() === cfg.year &&
          b.date.getMonth() === cfg.monthIndex
        );
      });

      const taxableSales = Math.round(
        matchingBills.reduce((s, b) => s + b.subtotal, 0) * 100
      ) / 100;
      const cgst = Math.round(
        matchingBills.reduce((s, b) => s + b.cgst_amount, 0) * 100
      ) / 100;
      const sgst = Math.round(
        matchingBills.reduce((s, b) => s + b.sgst_amount, 0) * 100
      ) / 100;
      const totalGst = Math.round((cgst + sgst) * 100) / 100;
      const billCount = matchingBills.length;

      // Status resolution
      let status: GstFilingStatusValue;
      if (savedStatuses[monthKey]) {
        status = savedStatuses[monthKey];
      } else if (isFuture || isCurrent) {
        status = "upcoming";
      } else if (taxableSales === 0) {
        status = "no_liability";
      } else {
        status = "due";
      }

      return {
        monthKey,
        month: monthLabel,
        year: cfg.year,
        monthIndex: cfg.monthIndex,
        taxableSales,
        cgst,
        sgst,
        totalGst,
        billCount,
        status,
        isCurrentOrFuture: isFuture || isCurrent,
      };
    });

    const totalTaxable = Math.round(
      records.reduce((s, r) => s + r.taxableSales, 0) * 100
    ) / 100;
    const totalCgst = Math.round(
      records.reduce((s, r) => s + r.cgst, 0) * 100
    ) / 100;
    const totalSgst = Math.round(
      records.reduce((s, r) => s + r.sgst, 0) * 100
    ) / 100;
    const totalGst = Math.round(
      records.reduce((s, r) => s + r.totalGst, 0) * 100
    ) / 100;
    const totalBills = records.reduce((s, r) => s + r.billCount, 0);

    return NextResponse.json({
      ok: true,
      selectedFY,
      availableFYs,
      gstin: restaurant?.gstin || null,
      restaurantName: restaurant?.name || "Restaurant",
      totals: {
        totalTaxable,
        totalCgst,
        totalSgst,
        totalGst,
        totalBills,
      },
      records,
    });
  } catch (err: any) {
    console.error("[/api/taxes GET] Unhandled error:", err);
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
    const { monthKey, status } = body;

    if (!monthKey || !status) {
      return NextResponse.json({ message: "monthKey and status required" }, { status: 400 });
    }

    const validStatuses: GstFilingStatusValue[] = ["filed", "due", "upcoming", "no_liability"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status value" }, { status: 400 });
    }

    const updated = setGstFilingStatus(targetRestaurantId, monthKey, status);

    return NextResponse.json({
      ok: true,
      message: `Filing status for ${monthKey} updated to ${status}`,
      statuses: updated,
    });
  } catch (err: any) {
    console.error("[/api/taxes POST] Error:", err);
    return NextResponse.json({ message: err?.message || "Internal server error" }, { status: 500 });
  }
}
