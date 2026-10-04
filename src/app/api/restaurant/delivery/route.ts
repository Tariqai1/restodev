import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getDeliverySettings,
  setDeliverySettings,
  DeliverySettings,
  DEFAULT_DELIVERY_SETTINGS,
} from "@/lib/platform/state";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryRestaurantId = searchParams.get("restaurantId");
    const querySlug = searchParams.get("slug");

    const admin = createAdminClient();

    let targetRestaurantId: string | null = queryRestaurantId;

    // If query by slug, find restaurant ID
    if (!targetRestaurantId && querySlug) {
      const { data: bySlug } = await admin
        .from("restaurants")
        .select("id, name, gstin")
        .eq("id", querySlug)
        .maybeSingle();

      if (bySlug) {
        targetRestaurantId = bySlug.id;
      }
    }

    // If no public param provided, try authenticated staff user
    if (!targetRestaurantId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const staffContext = await resolveStaffContext(user);
        if (staffContext) {
          targetRestaurantId = staffContext.restaurantId;
        }
      }
    }

    if (!targetRestaurantId) {
      return NextResponse.json({ message: "Restaurant identifier required" }, { status: 400 });
    }

    // Query restaurant table
    const { data: resto } = await admin
      .from("restaurants")
      .select("id, name, gstin")
      .eq("id", targetRestaurantId)
      .maybeSingle();

    // Query delivery_settings table
    const { data: dbSettings } = await admin
      .from("delivery_settings")
      .select("*")
      .eq("restaurant_id", targetRestaurantId)
      .maybeSingle();

    const fallback = getDeliverySettings(targetRestaurantId);

    const merged: DeliverySettings = {
      restaurantId: targetRestaurantId,
      onlineOrderingEnabled: fallback.onlineOrderingEnabled,
      pickupEnabled:
        typeof dbSettings?.pickup_enabled === "boolean"
          ? dbSettings.pickup_enabled
          : fallback.pickupEnabled,
      deliveryEnabled:
        typeof dbSettings?.delivery_enabled === "boolean"
          ? dbSettings.delivery_enabled
          : fallback.deliveryEnabled,
      deliveryRadiusKm:
        Number(dbSettings?.delivery_radius_km) || fallback.deliveryRadiusKm || 5,
      deliveryFee: Number(dbSettings?.delivery_fee) ?? fallback.deliveryFee ?? 0,
      minimumOrderAmount:
        Number(dbSettings?.minimum_order_amount) ?? fallback.minimumOrderAmount ?? 0,
      estimatedPrepMinutes:
        Number(dbSettings?.estimated_prep_minutes) || fallback.estimatedPrepMinutes || 25,
      latitude: Number(dbSettings?.latitude) || fallback.latitude || 19.1918,
      longitude: Number(dbSettings?.longitude) || fallback.longitude || 73.0229,
      slug: fallback.slug || "",
    };

    return NextResponse.json({
      ok: true,
      restaurant: {
        id: targetRestaurantId,
        name: resto?.name || "Restaurant",
        slug: fallback.slug || "",
        onlineOrderingEnabled: merged.onlineOrderingEnabled,
      },
      settings: merged,
    });
  } catch (err: any) {
    console.error("[/api/restaurant/delivery GET] Error:", err);
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
    const body = await req.json().catch(() => ({}));

    // Allow super admin to pass restaurantId explicitly or staff context
    const targetRestaurantId = body.restaurantId || staffContext?.restaurantId;

    if (!targetRestaurantId) {
      return NextResponse.json({ message: "Restaurant ID not found" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Update restaurant name if provided
    const restoUpdates: Record<string, any> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      restoUpdates.name = body.name.trim();
    }

    if (Object.keys(restoUpdates).length > 0) {
      try {
        await admin
          .from("restaurants")
          .update(restoUpdates)
          .eq("id", targetRestaurantId);
      } catch (e) {
        console.warn("restaurants name update warning:", e);
      }
    }

    // 2. Upsert into delivery_settings table
    const deliveryUpdates: Record<string, any> = {
      restaurant_id: targetRestaurantId,
      pickup_enabled:
        typeof body.pickupEnabled === "boolean" ? body.pickupEnabled : true,
      delivery_enabled:
        typeof body.deliveryEnabled === "boolean" ? body.deliveryEnabled : false,
      delivery_radius_km: Number(body.deliveryRadiusKm) || 5,
      delivery_fee: Number(body.deliveryFee) || 0,
      minimum_order_amount: Number(body.minimumOrderAmount) || 0,
      estimated_prep_minutes: Number(body.estimatedPrepMinutes) || 25,
      latitude: body.latitude !== undefined ? Number(body.latitude) : 19.1918,
      longitude: body.longitude !== undefined ? Number(body.longitude) : 73.0229,
      updated_at: new Date().toISOString(),
    };

    try {
      await admin
        .from("delivery_settings")
        .upsert(deliveryUpdates, { onConflict: "restaurant_id" });
    } catch (dbErr) {
      console.warn("delivery_settings table upsert warning (using platform state fallback):", dbErr);
    }

    // 3. Update platform-state storage
    const updated = setDeliverySettings(targetRestaurantId, {
      onlineOrderingEnabled: body.onlineOrderingEnabled,
      pickupEnabled: deliveryUpdates.pickup_enabled,
      deliveryEnabled: deliveryUpdates.delivery_enabled,
      deliveryRadiusKm: deliveryUpdates.delivery_radius_km,
      deliveryFee: deliveryUpdates.delivery_fee,
      minimumOrderAmount: deliveryUpdates.minimum_order_amount,
      estimatedPrepMinutes: deliveryUpdates.estimated_prep_minutes,
      latitude: deliveryUpdates.latitude,
      longitude: deliveryUpdates.longitude,
      slug: restoUpdates.slug || body.slug,
    });

    return NextResponse.json({
      ok: true,
      message: "Online ordering & delivery settings updated successfully",
      settings: updated,
    });
  } catch (err: any) {
    console.error("[/api/restaurant/delivery POST] Error:", err);
    return NextResponse.json({ message: err?.message || "Internal server error" }, { status: 500 });
  }
}
