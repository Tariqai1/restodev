import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createWaiterCall,
  getActiveWaiterCalls,
  resolveWaiterCall,
  WaiterCallType,
  WaiterCallRequest,
  DEFAULT_RESTAURANT_FEATURES,
  type RestaurantFeatures,
} from "@/lib/platform/state";

// 1. GET: Fetch active waiter calls for a restaurant
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || undefined;

    let dbCalls: WaiterCallRequest[] = [];
    if (restaurantId) {
      const admin = createAdminClient();
      const { data: resto } = await admin
        .from("restaurants")
        .select("gstin")
        .eq("id", restaurantId)
        .maybeSingle();

      const rawGstin = resto?.gstin || "";
      if (rawGstin.startsWith("{")) {
        try {
          const meta = JSON.parse(rawGstin);
          if (Array.isArray(meta.waiter_calls)) {
            const now = Date.now();
            dbCalls = meta.waiter_calls.filter(
              (c: WaiterCallRequest) =>
                c.status === "active" && now - new Date(c.createdAt).getTime() < 2 * 60 * 60 * 1000
            );
          }
        } catch {}
      }
    }

    const memCalls = getActiveWaiterCalls(restaurantId);
    const callMap = new Map<string, WaiterCallRequest>();
    for (const c of memCalls) callMap.set(c.id, c);
    for (const c of dbCalls) callMap.set(c.id, c);

    const calls = Array.from(callMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ ok: true, calls });
  } catch (error) {
    console.error("Fetch waiter calls error:", error);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}

// 2. POST: Customer triggers "Call Waiter"
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, type = "waiter", customNote, paymentMode } = body as {
      token?: string;
      type?: WaiterCallType;
      customNote?: string;
      paymentMode?: "upi" | "cash" | "card";
    };

    if (!token) {
      return NextResponse.json({ message: "Table token required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify table by QR token
    const { data: table, error } = await admin
      .from("restaurant_tables")
      .select("id, table_number, restaurant_id")
      .eq("qr_token", token)
      .maybeSingle();

    if (error || !table) {
      return NextResponse.json({ message: "Table not found" }, { status: 404 });
    }

    const callId = `wc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newCall: WaiterCallRequest = {
      id: callId,
      tableId: table.id,
      tableNumber: table.table_number,
      restaurantId: table.restaurant_id,
      type: (type || "waiter") as WaiterCallType,
      customNote: customNote || undefined,
      paymentMode: paymentMode || undefined,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    // 1. Persist directly into Supabase (restaurants.gstin JSON metadata)
    const { data: resto } = await admin
      .from("restaurants")
      .select("name, gstin")
      .eq("id", table.restaurant_id)
      .maybeSingle();

    let meta: Record<string, unknown> = {};
    const rawGstin = resto?.gstin || "";
    if (rawGstin.startsWith("{") && rawGstin.endsWith("}")) {
      try {
        meta = JSON.parse(rawGstin);
      } catch {}
    } else if (rawGstin) {
      meta.gstin_number = rawGstin;
    }

    const existingCalls = (meta.waiter_calls as WaiterCallRequest[]) || [];
    const now = Date.now();
    const activeCalls = existingCalls.filter(
      (c) => c.status === "active" && now - new Date(c.createdAt).getTime() < 2 * 60 * 60 * 1000
    );

    activeCalls.unshift(newCall);
    meta.waiter_calls = activeCalls.slice(0, 40);

    await admin
      .from("restaurants")
      .update({ gstin: JSON.stringify(meta) })
      .eq("id", table.restaurant_id);

    // 2. Also register in local memory fallback
    try {
      createWaiterCall(newCall);
    } catch {}

    // 3. Automated WhatsApp or Webhook notification dispatch
    const features: RestaurantFeatures = {
      ...DEFAULT_RESTAURANT_FEATURES,
      ...((meta.features as Partial<RestaurantFeatures>) || {}),
    };

    let whatsappWebUrl = "";
    const cleanPhone = (features.whatsappCaptainPhone || "").replace(/[^0-9]/g, "");
    const callEmoji =
      type === "water" ? "💧" : type === "bill" ? "🧾" : type === "clean" ? "✨" : "🛎️";
    const fullMessage = `${callEmoji} *TABLE BUZZER: ${(type || "waiter").toUpperCase()}*\n📍 *Table:* ${table.table_number}\n🏢 *${resto?.name || "Restaurant"}*\n${customNote ? `💬 Note: "${customNote}"\n` : ""}\n👉 Please attend Table ${table.table_number} immediately.`;
    const encodedText = encodeURIComponent(fullMessage);
    whatsappWebUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    if (features.whatsappAlerts && features.whatsappWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        await fetch(features.whatsappWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            event: "WAITER_CALL",
            tableNumber: table.table_number,
            callType: type || "waiter",
            customNote,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => undefined);
        clearTimeout(timeoutId);
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      message: `Buzzer sent! Staff notified for Table ${table.table_number}.`,
      call: newCall,
      whatsappWebUrl: cleanPhone ? whatsappWebUrl : undefined,
    });
  } catch (error) {
    console.error("Create waiter call error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

// 3. PATCH: Staff resolves/dismisses the call buzzer
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { callId } = body as { callId?: string };

    if (!callId) {
      return NextResponse.json({ message: "callId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Remove/resolve from Supabase metadata across restaurants
    const { data: restaurants } = await admin
      .from("restaurants")
      .select("id, gstin");

    let foundInDb = false;
    for (const r of restaurants || []) {
      if (r.gstin?.startsWith("{")) {
        try {
          const meta = JSON.parse(r.gstin);
          if (Array.isArray(meta.waiter_calls) && meta.waiter_calls.some((c: WaiterCallRequest) => c.id === callId)) {
            meta.waiter_calls = meta.waiter_calls.filter((c: WaiterCallRequest) => c.id !== callId);
            await admin
              .from("restaurants")
              .update({ gstin: JSON.stringify(meta) })
              .eq("id", r.id);
            foundInDb = true;
            break;
          }
        } catch {}
      }
    }

    // 2. Also resolve in memory
    const memSuccess = resolveWaiterCall(callId);

    if (!foundInDb && !memSuccess) {
      return NextResponse.json({ message: "Call request not found or already resolved" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Call acknowledged" });
  } catch (error) {
    console.error("Resolve waiter call error:", error);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
