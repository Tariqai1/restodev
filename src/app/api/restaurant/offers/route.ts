import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getRestaurantOfferConfig,
  setRestaurantOfferConfig,
  DEFAULT_OFFER_CONFIG,
} from "@/lib/platform/state";
import type { RestaurantOfferConfig } from "@/lib/types/offers";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ ok: false, message: "Staff record not found" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: resto } = await admin
      .from("restaurants")
      .select("gstin, name")
      .eq("id", staffContext.restaurantId)
      .maybeSingle();

    if (resto?.gstin?.startsWith("{")) {
      try {
        const meta = JSON.parse(resto.gstin);
        if (meta.offerConfig) {
          return NextResponse.json({
            ok: true,
            offerConfig: { ...DEFAULT_OFFER_CONFIG, ...meta.offerConfig },
            restaurantName: resto.name,
          });
        }
      } catch {}
    }

    const offerConfig = getRestaurantOfferConfig(staffContext.restaurantId);
    return NextResponse.json({
      ok: true,
      offerConfig: { ...DEFAULT_OFFER_CONFIG, ...offerConfig },
      restaurantName: resto?.name || "Order Desk",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ ok: false, message: "Staff record not found" }, { status: 403 });
    }

    const allowedRoles = ["owner", "manager", "admin"];
    if (staffContext.role && !allowedRoles.includes(staffContext.role.toLowerCase()) && !staffContext.isSuperAdmin) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized. Owner or Admin role required." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const incomingOffer: Partial<RestaurantOfferConfig> = body.offerConfig || body;

    const currentOffer = getRestaurantOfferConfig(staffContext.restaurantId);
    const updatedOffer: RestaurantOfferConfig = {
      ...DEFAULT_OFFER_CONFIG,
      ...currentOffer,
      ...incomingOffer,
      active: Boolean(incomingOffer.active ?? currentOffer.active),
      discountPercent: Math.max(0, Math.min(100, Number(incomingOffer.discountPercent) || 0)),
      minOrderValue: Math.max(0, Number(incomingOffer.minOrderValue) || 0),
    };

    // Save to local platform-state
    setRestaurantOfferConfig(staffContext.restaurantId, updatedOffer);

    // Save to Supabase restaurants.gstin metadata for cloud persistence
    const admin = createAdminClient();
    const { data: currentResto } = await admin
      .from("restaurants")
      .select("gstin")
      .eq("id", staffContext.restaurantId)
      .maybeSingle();

    let meta: Record<string, unknown> = {};
    const rawGstin = currentResto?.gstin || "";
    if (rawGstin.startsWith("{") && rawGstin.endsWith("}")) {
      try {
        meta = JSON.parse(rawGstin);
      } catch {}
    } else if (rawGstin) {
      meta.gstin_number = rawGstin;
    }

    meta.offerConfig = updatedOffer;

    await admin
      .from("restaurants")
      .update({ gstin: JSON.stringify(meta) })
      .eq("id", staffContext.restaurantId);

    return NextResponse.json({
      ok: true,
      message: "Offer & Popup settings updated successfully",
      offerConfig: updatedOffer,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
