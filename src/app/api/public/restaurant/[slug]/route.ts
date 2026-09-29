import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDeliverySettings,
  getRestaurantTheme,
  getRestaurantBranding,
  getRestaurantFeatures,
  getRestaurantOfferConfig,
} from "@/lib/platform/state";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ message: "Restaurant slug is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Resolve restaurant by slug OR by id
    let restaurant = null;
    const { data: bySlug } = await admin
      .from("restaurants")
      .select("id, name, owner_email, gstin, slug, online_ordering_enabled")
      .eq("slug", slug.trim().toLowerCase())
      .maybeSingle();

    if (bySlug) {
      restaurant = bySlug;
    } else {
      const { data: byId } = await admin
        .from("restaurants")
        .select("id, name, owner_email, gstin, slug, online_ordering_enabled")
        .eq("id", slug.trim())
        .maybeSingle();

      if (byId) {
        restaurant = byId;
      }
    }

    if (!restaurant) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const restaurantId = restaurant.id;
    const fallbackSettings = getDeliverySettings(restaurantId);

    const isOnlineOrderingEnabled =
      typeof restaurant.online_ordering_enabled === "boolean"
        ? restaurant.online_ordering_enabled
        : fallbackSettings.onlineOrderingEnabled;

    // 2. Fetch delivery_settings table
    const { data: dbDelivery } = await admin
      .from("delivery_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    const deliverySettings = {
      pickupEnabled:
        typeof dbDelivery?.pickup_enabled === "boolean"
          ? dbDelivery.pickup_enabled
          : fallbackSettings.pickupEnabled,
      deliveryEnabled:
        typeof dbDelivery?.delivery_enabled === "boolean"
          ? dbDelivery.delivery_enabled
          : fallbackSettings.deliveryEnabled,
      deliveryRadiusKm:
        Number(dbDelivery?.delivery_radius_km) || fallbackSettings.deliveryRadiusKm || 5,
      deliveryFee: Number(dbDelivery?.delivery_fee) ?? fallbackSettings.deliveryFee ?? 0,
      minimumOrderAmount:
        Number(dbDelivery?.minimum_order_amount) ?? fallbackSettings.minimumOrderAmount ?? 0,
      estimatedPrepMinutes:
        Number(dbDelivery?.estimated_prep_minutes) || fallbackSettings.estimatedPrepMinutes || 25,
    };

    // If online ordering is not enabled, return gracefully
    if (!isOnlineOrderingEnabled) {
      return NextResponse.json({
        ok: true,
        onlineOrderingEnabled: false,
        restaurant: {
          id: restaurantId,
          name: restaurant.name,
          slug: restaurant.slug || slug,
        },
        message: "Online ordering is not currently enabled for this restaurant.",
      });
    }

    // 3. Fetch active menu categories
    const { data: categories } = await admin
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true });

    // 4. Fetch available menu items
    const { data: menuItems } = await admin
      .from("menu_items")
      .select("id, category_id, name, price, description, is_veg, photo_url, is_available, has_half_portion, half_price")
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true)
      .order("name", { ascending: true });

    const theme = getRestaurantTheme(restaurantId);
    const branding = getRestaurantBranding(restaurantId);
    const features = getRestaurantFeatures(restaurantId);
    const offerConfig = getRestaurantOfferConfig(restaurantId);

    return NextResponse.json({
      ok: true,
      onlineOrderingEnabled: true,
      restaurant: {
        id: restaurantId,
        name: restaurant.name,
        slug: restaurant.slug || slug,
      },
      deliverySettings,
      categories: categories || [],
      menuItems: (menuItems || []).map((m) => ({
        id: m.id,
        category_id: m.category_id,
        name: m.name,
        price: Number(m.price) || 0,
        description: m.description,
        is_veg: Boolean(m.is_veg),
        photo_url: m.photo_url || null,
        has_half_portion: Boolean(m.has_half_portion),
        half_price: m.half_price ? Number(m.half_price) : Math.round((Number(m.price) || 0) * 0.6),
      })),
      theme,
      branding,
      features,
      offerConfig,
    });
  } catch (err: any) {
    console.error("[/api/public/restaurant/[slug] GET] Error:", err);
    return NextResponse.json({ message: err?.message || "Internal server error" }, { status: 500 });
  }
}
