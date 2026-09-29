import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDeliverySettings,
  getRestaurantTheme,
  getRestaurantBranding,
  getRestaurantFeatures,
  getRestaurantOfferConfig,
  getPlatformState,
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

    const cleanSlug = slug.trim().toLowerCase();
    const admin = createAdminClient();

    // 1. Resolve restaurant by slug OR by id
    let targetRestoId: string | null = null;
    const platformState = getPlatformState();

    if (platformState.deliverySettings) {
      for (const [rId, dSet] of Object.entries(platformState.deliverySettings)) {
        if (
          rId.toLowerCase() === cleanSlug ||
          (dSet.slug && dSet.slug.toLowerCase() === cleanSlug)
        ) {
          targetRestoId = rId;
          break;
        }
      }
    }

    let restaurant: any = null;

    // A. If targetRestoId resolved or cleanSlug looks like a UUID
    const idToTry = targetRestoId || (cleanSlug.includes("-") && cleanSlug.length >= 32 ? cleanSlug : null);
    if (idToTry) {
      const { data: byId } = await admin
        .from("restaurants")
        .select("id, name, owner_email, gstin")
        .eq("id", idToTry)
        .maybeSingle();

      if (byId) restaurant = byId;
    }

    // B. Try searching by name match if not found
    if (!restaurant) {
      const { data: byName } = await admin
        .from("restaurants")
        .select("id, name, owner_email, gstin")
        .ilike("name", cleanSlug.replace(/-/g, " "))
        .maybeSingle();

      if (byName) restaurant = byName;
    }

    // C. Fallback: if only 1 restaurant exists, resolve it
    if (!restaurant) {
      const { data: allRestos } = await admin
        .from("restaurants")
        .select("id, name, owner_email, gstin")
        .limit(2);

      if (allRestos && allRestos.length === 1) {
        restaurant = allRestos[0];
      }
    }

    if (!restaurant) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const restaurantId = restaurant.id;
    const fallbackSettings = getDeliverySettings(restaurantId);

    const isOnlineOrderingEnabled =
      typeof fallbackSettings.onlineOrderingEnabled === "boolean"
        ? fallbackSettings.onlineOrderingEnabled
        : true;

    // 2. Fetch delivery_settings table (with fallback)
    let dbDelivery: any = null;
    try {
      const { data } = await admin
        .from("delivery_settings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      dbDelivery = data;
    } catch {
      // fallback
    }

    const deliverySettings = {
      pickupEnabled: dbDelivery?.pickup_enabled ?? fallbackSettings.pickupEnabled ?? true,
      deliveryEnabled: dbDelivery?.delivery_enabled ?? fallbackSettings.deliveryEnabled ?? true,
      deliveryRadiusKm: Number(dbDelivery?.delivery_radius_km) || fallbackSettings.deliveryRadiusKm || 8,
      deliveryFee: Number(dbDelivery?.delivery_fee) ?? fallbackSettings.deliveryFee ?? 40,
      minimumOrderAmount: Number(dbDelivery?.minimum_order_amount) ?? fallbackSettings.minimumOrderAmount ?? 0,
      estimatedPrepMinutes: Number(dbDelivery?.estimated_prep_minutes) || fallbackSettings.estimatedPrepMinutes || 25,
      slug: fallbackSettings.slug || cleanSlug,
    };

    // 3. Fetch menu categories and available items
    const [categoriesRes, itemsRes] = await Promise.all([
      admin
        .from("menu_categories")
        .select("id, name, sort_order")
        .eq("restaurant_id", restaurantId)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true }),
      admin
        .from("menu_items")
        .select("id, category_id, name, description, price, is_veg, is_available, is_bestseller, has_half_portion, photo_url")
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("name", { ascending: true }),
    ]);

    const categories = categoriesRes.data || [];
    const rawItems = itemsRes.data || [];
    const formattedItems = rawItems.map((m: any) => ({
      id: m.id,
      category_id: m.category_id,
      name: m.name,
      price: Number(m.price) || 0,
      description: m.description,
      is_veg: Boolean(m.is_veg),
      photo_url: m.photo_url || null,
      has_half_portion: Boolean(m.has_half_portion),
      half_price: m.half_price ? Number(m.half_price) : Math.round((Number(m.price) || 0) * 0.6),
      is_available: Boolean(m.is_available),
      is_bestseller: Boolean(m.is_bestseller),
    }));

    // 4. Fetch Theme and Branding
    const theme = getRestaurantTheme(restaurantId);
    const branding = getRestaurantBranding(restaurantId);
    const features = getRestaurantFeatures(restaurantId);
    const offers = getRestaurantOfferConfig(restaurantId);

    return NextResponse.json({
      ok: true,
      onlineOrderingEnabled: isOnlineOrderingEnabled,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: cleanSlug,
        onlineOrderingEnabled: isOnlineOrderingEnabled,
        deliverySettings,
      },
      deliverySettings,
      categories,
      items: formattedItems,
      menuItems: formattedItems,
      theme,
      branding,
      features,
      offers,
    });
  } catch (error: any) {
    console.error("[Public Restaurant Slug Error]:", error);
    return NextResponse.json(
      { message: error?.message || "Failed to load restaurant storefront." },
      { status: 500 }
    );
  }
}
