import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderDispatch, setOrderDispatch } from "@/lib/platform/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseOnlineDetails(tbl?: string, notes?: string | null) {
  const isOnline =
    Boolean(tbl?.includes("DEL-")) ||
    Boolean(tbl?.includes("PU-")) ||
    Boolean(notes?.includes("[🛵 Delivery")) ||
    Boolean(notes?.includes("[🛍️ Pickup"));
  const type = tbl?.includes("PU-") || notes?.includes("[🛍️ Pickup") ? "pickup" : "delivery";

  let customerName = "";
  let customerPhone = "";
  let deliveryAddress = "";
  let customerCoords: { lat: number; lng: number } | null = null;

  if (notes) {
    const match = notes.match(/\[(?:🛵 Delivery|🛍️ Pickup):\s*([^(\]]+)(?:\(([^)]+)\))?(?:\s*-\s*([^\]]+))?\]/);
    if (match) {
      customerName = match[1]?.trim() || "";
      customerPhone = match[2]?.trim() || "";
      deliveryAddress = match[3]?.trim() || "";
    }

    const gpsMatch = notes.match(/\[📍 GPS:\s*([0-9.-]+),\s*([0-9.-]+)\]/);
    if (gpsMatch) {
      customerCoords = {
        lat: parseFloat(gpsMatch[1]),
        lng: parseFloat(gpsMatch[2]),
      };
      deliveryAddress = deliveryAddress.replace(/\s*\[📍 GPS:[^\]]+\]/, "").trim();
    }
  }

  return { isOnline, type, customerName, customerPhone, deliveryAddress, customerCoords };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    const admin = createAdminClient();

    // Query restaurant info
    let targetRestoId = restaurantId;
    let restoName = "Our Restaurant";

    if (!targetRestoId) {
      const { data: firstResto } = await admin
        .from("restaurants")
        .select("id, name")
        .limit(1)
        .maybeSingle();
      if (firstResto) {
        targetRestoId = firstResto.id;
        restoName = firstResto.name;
      }
    } else {
      const { data: r } = await admin
        .from("restaurants")
        .select("id, name")
        .eq("id", targetRestoId)
        .maybeSingle();
      if (r) restoName = r.name;
    }

    if (!targetRestoId) {
      return NextResponse.json({ message: "No restaurant found" }, { status: 404 });
    }

    // Fetch active open orders
    const { data: openOrders } = await admin
      .from("orders")
      .select(`
        id,
        table_id,
        status,
        opened_at,
        restaurant_tables (id, table_number),
        order_items (
          id,
          menu_item_id,
          qty,
          unit_price,
          notes,
          item_status,
          menu_items (name, is_veg, price)
        ),
        bills (id, total, payment_mode, payment_status)
      `)
      .eq("restaurant_id", targetRestoId)
      .eq("status", "open")
      .order("opened_at", { ascending: true });

    // Fetch recently completed orders (last 24h)
    const { data: closedOrders } = await admin
      .from("orders")
      .select(`
        id,
        table_id,
        status,
        opened_at,
        closed_at,
        restaurant_tables (id, table_number),
        order_items (
          id,
          menu_item_id,
          qty,
          unit_price,
          notes,
          item_status,
          menu_items (name, is_veg, price)
        ),
        bills (id, total, payment_mode, payment_status)
      `)
      .eq("restaurant_id", targetRestoId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(20);

    const formatRiderTicket = (ord: any) => {
      const tbl = ord.restaurant_tables?.table_number;
      const rawItems = (ord.order_items as any[]) || [];
      const notes = rawItems[0]?.notes || "";
      const details = parseOnlineDetails(tbl, notes);
      const billsArr = Array.isArray(ord.bills) ? ord.bills : ord.bills ? [ord.bills] : [];
      const bill = billsArr[0] || null;

      const subtotal = rawItems.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.qty) || 1), 0);
      const totalAmount = bill ? Number(bill.total) || subtotal : Math.round(subtotal * 1.05);

      const allServed = rawItems.length > 0 && rawItems.every((it) => it.item_status === "served");
      const anyPreparing = rawItems.some((it) => it.item_status === "preparing");
      const kitchenStage = allServed ? "ready" : anyPreparing ? "preparing" : "received";
      const dispatch = getOrderDispatch(ord.id);

      // In-app 4-digit verification code (100% Free PIN)
      let verificationCode = dispatch?.verificationCode;
      if (!verificationCode) {
        const pinMatch = ord.order_items?.[0]?.notes?.match(/PIN:\s*(\d{4})/);
        if (pinMatch) {
          verificationCode = pinMatch[1];
        } else {
          const hashNum = Math.abs(
            ord.id.split("").reduce((acc: number, char: string) => acc * 31 + char.charCodeAt(0), 0)
          );
          verificationCode = String(1000 + (hashNum % 9000));
        }
      }

      return {
        id: ord.id,
        orderNumber: tbl || `DEL-${ord.id.slice(-4).toUpperCase()}`,
        type: details.type,
        customerName: details.customerName || "Customer",
        customerPhone: details.customerPhone,
        deliveryAddress: details.deliveryAddress,
        customerCoords: details.customerCoords,
        kitchenStage,
        dispatchStage: dispatch?.stage || "pending",
        riderName: dispatch?.riderName || null,
        riderPhone: dispatch?.riderPhone || null,
        dispatchedAt: dispatch?.dispatchedAt || null,
        verificationCode,
        paymentCollectedMode: dispatch?.paymentCollectedMode,
        cashAmountCollected: dispatch?.cashAmountCollected,
        openedAt: ord.opened_at,
        closedAt: ord.closed_at,
        totalAmount,
        paymentMode: bill?.payment_mode || "cash",
        paymentStatus: bill?.payment_status || (ord.status === "closed" ? "paid" : "unpaid"),
        items: rawItems.map((it) => ({
          name: it.menu_items?.name || "Dish",
          qty: it.qty,
          price: Number(it.unit_price) || 0,
          isVeg: Boolean(it.menu_items?.is_veg),
        })),
      };
    };

    const activeDeliveries = (openOrders || [])
      .filter((o: any) => {
        const d = parseOnlineDetails(o.restaurant_tables?.table_number, o.order_items?.[0]?.notes);
        return d.isOnline && d.type === "delivery";
      })
      .map(formatRiderTicket);

    const completedDeliveries = (closedOrders || [])
      .filter((o: any) => {
        const d = parseOnlineDetails(o.restaurant_tables?.table_number, o.order_items?.[0]?.notes);
        return d.isOnline && d.type === "delivery";
      })
      .map(formatRiderTicket);

    return NextResponse.json(
      {
        ok: true,
        restaurant: { id: targetRestoId, name: restoName, upiId: "orderdesk@icici" },
        activeDeliveries,
        completedDeliveries,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to load rider orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, orderId, paymentMode = "cash", enteredPin, bypassReason, cashAmountCollected } = body;

    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    if (action === "start_delivery") {
      setOrderDispatch(orderId, {
        stage: "dispatched",
        dispatchedAt: nowIso,
      });

      return NextResponse.json({
        ok: true,
        message: "Delivery started. Heading to customer location! 🛵",
      });
    }

    if (action === "complete_delivery") {
      const dispatch = getOrderDispatch(orderId);
      const expectedCode = dispatch?.verificationCode;

      // 4-Digit In-App Verification Validation
      if (!bypassReason && expectedCode) {
        const cleanEntered = String(enteredPin || "").trim();
        if (cleanEntered !== String(expectedCode).trim()) {
          return NextResponse.json(
            { message: "Galat 4-digit code! Customer se screen par dikh raha PIN confirm karein." },
            { status: 400 }
          );
        }
      }

      // 1. Mark order closed
      const { data: ord } = await admin
        .from("orders")
        .select("id, table_id")
        .eq("id", orderId)
        .maybeSingle();

      await admin
        .from("orders")
        .update({ status: "closed", closed_at: nowIso })
        .eq("id", orderId);

      // 2. Free virtual table
      if (ord?.table_id) {
        await admin
          .from("restaurant_tables")
          .update({ status: "empty" })
          .eq("id", ord.table_id);
      }

      // 3. Mark bill paid
      await admin
        .from("bills")
        .update({
          payment_status: "paid",
          paid_at: nowIso,
          payment_mode: paymentMode,
        })
        .eq("order_id", orderId);

      // 4. Update dispatch stage with cash / upi audit
      setOrderDispatch(orderId, {
        stage: "delivered",
        deliveredAt: nowIso,
        paymentCollectedMode: paymentMode,
        cashAmountCollected: paymentMode === "cash" ? Number(cashAmountCollected) || 0 : 0,
      });

      return NextResponse.json({
        ok: true,
        message: "Order successfully verified & marked delivered! ✅",
      });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to update delivery" }, { status: 500 });
  }
}
