import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDeliverySettings, getDishHalfPrice } from "@/lib/platform/state";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  checkDeliveryServiceability,
  DEFAULT_RESTO_COORDINATES,
} from "@/lib/geo/geo-utils";

type OrderItemPayload = {
  menuItemId: string;
  portion?: "half" | "full";
  qty: number;
  notes?: string;
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown-client";
    const body = await req.json().catch(() => ({}));

    const {
      restaurantId,
      orderType = "pickup",
      customerName,
      customerPhone,
      deliveryAddress,
      customerLat,
      customerLng,
      items,
      notes,
      paymentMode = "cash",
    } = body as {
      restaurantId: string;
      orderType: "delivery" | "pickup";
      customerName: string;
      customerPhone: string;
      deliveryAddress?: string;
      customerLat?: number;
      customerLng?: number;
      items: OrderItemPayload[];
      notes?: string;
      paymentMode?: "cash" | "upi" | "card";
    };

    if (!restaurantId || typeof restaurantId !== "string") {
      return NextResponse.json({ message: "Restaurant ID is required." }, { status: 400 });
    }

    if (!["delivery", "pickup"].includes(orderType)) {
      return NextResponse.json({ message: "orderType must be 'delivery' or 'pickup'." }, { status: 400 });
    }

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ message: "Customer name is required." }, { status: 400 });
    }

    if (!customerPhone || !customerPhone.trim()) {
      return NextResponse.json({ message: "Valid contact phone number is required." }, { status: 400 });
    }

    if (orderType === "delivery" && (!deliveryAddress || !deliveryAddress.trim())) {
      return NextResponse.json({ message: "Delivery address is required for home delivery." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "Cart cannot be empty." }, { status: 400 });
    }

    // Rate Limiting: Max 5 online orders per IP per 5 minutes
    const rateCheck = checkRateLimit(`online-order:${restaurantId}:${ip}`, 5, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: "Order limit reached. Please wait a few minutes before placing another order." },
        { status: 429 }
      );
    }

    const admin = createAdminClient();

    // 1. Verify Restaurant & Online Ordering Status
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .maybeSingle();

    if (!restaurant) {
      return NextResponse.json({ message: "Restaurant not found." }, { status: 404 });
    }

    const fallbackSettings = getDeliverySettings(restaurantId);
    const isOnlineEnabled =
      typeof fallbackSettings.onlineOrderingEnabled === "boolean"
        ? fallbackSettings.onlineOrderingEnabled
        : true;

    if (!isOnlineEnabled) {
      return NextResponse.json(
        { message: "Online ordering is currently disabled for this restaurant." },
        { status: 403 }
      );
    }

    // 2. Fetch delivery settings
    const { data: dbDelivery } = await admin
      .from("delivery_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    const pickupEnabled =
      typeof dbDelivery?.pickup_enabled === "boolean"
        ? dbDelivery.pickup_enabled
        : fallbackSettings.pickupEnabled;

    const deliveryEnabled =
      typeof dbDelivery?.delivery_enabled === "boolean"
        ? dbDelivery.delivery_enabled
        : fallbackSettings.deliveryEnabled;

    const minAmount =
      Number(dbDelivery?.minimum_order_amount) ?? fallbackSettings.minimumOrderAmount ?? 0;

    const deliveryFee =
      orderType === "delivery"
        ? Number(dbDelivery?.delivery_fee) ?? fallbackSettings.deliveryFee ?? 0
        : 0;

    const estimatedPrepMinutes =
      Number(dbDelivery?.estimated_prep_minutes) || fallbackSettings.estimatedPrepMinutes || 25;

    if (orderType === "pickup" && !pickupEnabled) {
      return NextResponse.json({ message: "Takeaway pickup is not offered at this time." }, { status: 400 });
    }

    if (orderType === "delivery" && !deliveryEnabled) {
      return NextResponse.json({ message: "Home delivery is not offered at this time." }, { status: 400 });
    }

    // Geofencing & Delivery Radius Validation (Zepto/Swiggy Style)
    if (
      orderType === "delivery" &&
      typeof customerLat === "number" &&
      typeof customerLng === "number"
    ) {
      const restoCoords = {
        lat: Number(dbDelivery?.latitude) || fallbackSettings.latitude || DEFAULT_RESTO_COORDINATES.lat,
        lng: Number(dbDelivery?.longitude) || fallbackSettings.longitude || DEFAULT_RESTO_COORDINATES.lng,
      };
      const deliveryRadiusKm =
        Number(dbDelivery?.delivery_radius_km) || fallbackSettings.deliveryRadiusKm || 5;

      const serviceCheck = checkDeliveryServiceability(
        restoCoords,
        { lat: customerLat, lng: customerLng },
        deliveryRadiusKm
      );

      if (!serviceCheck.isServiceable) {
        return NextResponse.json({ message: serviceCheck.message }, { status: 400 });
      }
    }

    // 3. Price resolution from database
    const itemIds = items.map((i) => i.menuItemId).filter(Boolean);
    const { data: menuItems, error: menuErr } = await admin
      .from("menu_items")
      .select("id, name, price, is_available")
      .eq("restaurant_id", restaurantId)
      .in("id", itemIds);

    if (menuErr || !menuItems || menuItems.length === 0) {
      return NextResponse.json({ message: "Selected items not found in menu." }, { status: 400 });
    }

    const itemCatalog = new Map<string, { price: number; halfPrice: number; isAvailable: boolean; name: string }>();
    for (const m of menuItems) {
      if (!m.is_available) {
        return NextResponse.json(
          { message: `"${m.name}" is currently sold out. Please remove it from your cart.` },
          { status: 400 }
        );
      }
      const halfPriceConfig = getDishHalfPrice(m.id);
      const full = Number(m.price) || 0;
      const half = halfPriceConfig ? Number(halfPriceConfig) : Math.round(full * 0.6);
      itemCatalog.set(m.id, {
        price: full,
        halfPrice: half,
        isAvailable: true,
        name: m.name,
      });
    }

    // 4. Calculate Subtotal
    let subtotal = 0;
    const preparedItems: Array<{
      menu_item_id: string;
      qty: number;
      unit_price: number;
      notes: string | null;
      customer_name: string;
    }> = [];

    for (const it of items) {
      const cat = itemCatalog.get(it.menuItemId);
      if (!cat) continue;

      const rate = it.portion === "half" ? cat.halfPrice : cat.price;
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      subtotal += rate * qty;

      const portionLabel = it.portion === "half" ? "(Half)" : "";
      const itemNote = [portionLabel, it.notes?.trim()].filter(Boolean).join(" - ") || null;

      preparedItems.push({
        menu_item_id: it.menuItemId,
        qty,
        unit_price: rate,
        notes: itemNote,
        customer_name: customerName.trim(),
      });
    }

    if (preparedItems.length === 0) {
      return NextResponse.json({ message: "No valid items to order." }, { status: 400 });
    }

    // Check minimum order amount
    if (minAmount > 0 && subtotal < minAmount) {
      return NextResponse.json(
        {
          message: `Minimum order amount is ₹${minAmount}. Your current subtotal is ₹${subtotal}.`,
        },
        { status: 400 }
      );
    }

    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const totalAmount = Math.round((subtotal + taxAmount + deliveryFee) * 100) / 100;

    // 5. Create Order in Database (with graceful virtual table fallback)
    let newOrder = null;
    let orderCreationError: any = null;

    // Try primary insert (with new online columns & table_id: null)
    const { data: ord1, error: err1 } = await admin
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: null,
        order_type: orderType,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: orderType === "delivery" ? deliveryAddress?.trim() : null,
        status: "open",
        opened_at: new Date().toISOString(),
      })
      .select("id, opened_at")
      .single();

    if (!err1 && ord1) {
      newOrder = ord1;
    } else {
      // Fallback: If DB enforces check_order_table_restaurant_match or one_open_order_per_table,
      // create a unique session virtual slot for this takeaway/delivery order
      const prefix = orderType === "delivery" ? "DEL" : "PU";
      const slotCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: vTable, error: vTableErr } = await admin
        .from("restaurant_tables")
        .insert({
          restaurant_id: restaurantId,
          table_number: slotCode,
          qr_token: `online_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        })
        .select("id")
        .single();

      if (vTable) {
        const { data: ord2, error: err2 } = await admin
          .from("orders")
          .insert({
            restaurant_id: restaurantId,
            table_id: vTable.id,
            status: "open",
            opened_at: new Date().toISOString(),
          })
          .select("id, opened_at")
          .single();

        if (err2 || !ord2) {
          orderCreationError = err2 || err1;
        } else {
          newOrder = ord2;
        }
      } else {
        orderCreationError = vTableErr || err1;
      }
    }

    if (!newOrder) {
      console.error("Failed to create online order:", orderCreationError);
      return NextResponse.json(
        { message: orderCreationError?.message || "Failed to place order." },
        { status: 500 }
      );
    }

    // 6. Insert Order Items (with clear delivery / pickup banner on notes)
    const geoTag =
      typeof customerLat === "number" && typeof customerLng === "number"
        ? ` [📍 GPS: ${customerLat.toFixed(5)},${customerLng.toFixed(5)}]`
        : "";

    const channelTag =
      orderType === "delivery"
        ? `[🛵 Delivery: ${customerName.trim()} (${customerPhone.trim()}) - ${deliveryAddress?.trim() || ""}${geoTag}]`
        : `[🛍️ Pickup: ${customerName.trim()} (${customerPhone.trim()})]`;

    const itemsToInsert = preparedItems.map((pi, idx) => ({
      order_id: newOrder.id,
      menu_item_id: pi.menu_item_id,
      qty: pi.qty,
      unit_price: pi.unit_price,
      notes: idx === 0 ? [channelTag, pi.notes].filter(Boolean).join(" | ") : pi.notes,
      item_status: "pending",
      customer_name: pi.customer_name,
    }));

    await admin.from("order_items").insert(itemsToInsert);

    // 7. Insert Initial Bill Record
    const billNumber = `ORD-${newOrder.id.slice(-4).toUpperCase()}`;
    await admin.from("bills").insert({
      order_id: newOrder.id,
      bill_number: billNumber,
      subtotal,
      tax_amount: taxAmount,
      total: totalAmount,
      payment_mode: paymentMode,
      payment_status: "unpaid",
    });

    return NextResponse.json({
      ok: true,
      orderId: newOrder.id,
      orderNumber: billNumber,
      orderType,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: orderType === "delivery" ? deliveryAddress?.trim() : null,
      subtotal,
      taxAmount,
      deliveryFee,
      total: totalAmount,
      estimatedPrepMinutes,
      message: `Your ${orderType} order has been placed successfully!`,
    });
  } catch (err: any) {
    console.error("[/api/public/online-order POST] Error:", err);
    return NextResponse.json({ message: err?.message || "Internal server error" }, { status: 500 });
  }
}
