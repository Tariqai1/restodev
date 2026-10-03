import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Staff authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext || (!staffContext.isSuperAdmin && !["admin", "owner", "manager"].includes(staffContext.role))) {
      return NextResponse.json({ message: "Owner or manager access required for bulk pricing" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode = "percent",
      direction = "increase",
      value = 0,
      roundTo = 0,
      itemIds,
      categoryId,
    } = body as {
      mode: "percent" | "flat";
      direction: "increase" | "decrease";
      value: number;
      roundTo?: number;
      itemIds?: string[];
      categoryId?: string;
    };

    const numVal = Math.abs(Number(value) || 0);
    if (numVal <= 0) {
      return NextResponse.json({ message: "Adjustment value must be greater than 0" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Query dishes belonging to this restaurant
    let query = admin
      .from("menu_items")
      .select("id, name, price, category_id")
      .eq("restaurant_id", staffContext.restaurantId);

    if (Array.isArray(itemIds) && itemIds.length > 0) {
      query = query.in("id", itemIds);
    } else if (categoryId && categoryId !== "all") {
      query = query.eq("category_id", categoryId);
    }

    const { data: dishes, error: fetchErr } = await query;
    if (fetchErr || !dishes || dishes.length === 0) {
      return NextResponse.json({ message: "No dishes found matching selection" }, { status: 404 });
    }

    // Calculate updated prices
    const updates: Array<{ id: string; name: string; oldPrice: number; newPrice: number }> = [];

    for (const dish of dishes) {
      const currentPrice = Number(dish.price) || 0;
      let newPrice = currentPrice;

      if (mode === "percent") {
        const delta = Math.round((currentPrice * numVal) / 100);
        newPrice = direction === "increase" ? currentPrice + delta : Math.max(0, currentPrice - delta);
      } else {
        newPrice = direction === "increase" ? currentPrice + numVal : Math.max(0, currentPrice - numVal);
      }

      // Apply rounding if requested (e.g. round to nearest 5 or 10)
      if (roundTo && roundTo > 1) {
        newPrice = Math.round(newPrice / roundTo) * roundTo;
        if (newPrice <= 0 && currentPrice > 0) {
          newPrice = roundTo;
        }
      }

      updates.push({
        id: dish.id,
        name: dish.name,
        oldPrice: currentPrice,
        newPrice,
      });
    }

    // Execute updates in parallel batches of 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((u) =>
          admin
            .from("menu_items")
            .update({ price: u.newPrice })
            .eq("id", u.id)
            .eq("restaurant_id", staffContext.restaurantId)
        )
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully updated rates for ${updates.length} dishes`,
      updatedCount: updates.length,
      updates,
    });
  } catch (error: any) {
    console.error("[Bulk Price Error]:", error);
    return NextResponse.json(
      { message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
