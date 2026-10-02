import { NextRequest, NextResponse } from "next/server";
import {
  getDeliveryRiders,
  saveDeliveryRider,
  deleteDeliveryRider,
  getOrderDispatch,
  setOrderDispatch,
} from "@/lib/platform/state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId") || "";
    const orderId = searchParams.get("orderId");

    const riders = restaurantId ? getDeliveryRiders(restaurantId) : [];
    const dispatch = orderId ? getOrderDispatch(orderId) : null;

    return NextResponse.json({ ok: true, riders, dispatch });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to get dispatch data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, restaurantId, orderId, riderName, riderPhone, vehicle, riderId, stage } = body;

    const admin = createAdminClient();

    // 1. Dispatch Rider to Order
    if (action === "dispatch_rider") {
      if (!orderId || !riderName?.trim()) {
        return NextResponse.json({ message: "orderId and riderName are required" }, { status: 400 });
      }

      // Auto-save rider to saved fleet if restaurantId and phone are provided
      if (restaurantId && riderPhone?.trim()) {
        saveDeliveryRider(restaurantId, {
          name: riderName.trim(),
          phone: riderPhone.trim(),
          vehicle: vehicle || "Bike",
          active: true,
        });
      }

      const dispatch = setOrderDispatch(orderId, {
        restaurantId,
        riderName: riderName.trim(),
        riderPhone: riderPhone?.trim() || "",
        dispatchedAt: new Date().toISOString(),
        stage: "dispatched",
      });

      return NextResponse.json({
        ok: true,
        message: `Order successfully dispatched to ${riderName.trim()}.`,
        dispatch,
      });
    }

    // 2. Update Delivery Stage (e.g. "delivered", "out_for_delivery")
    if (action === "update_stage") {
      if (!orderId) {
        return NextResponse.json({ message: "orderId is required" }, { status: 400 });
      }

      const nextStage = stage || "delivered";
      const nowIso = new Date().toISOString();

      const dispatch = setOrderDispatch(orderId, {
        stage: nextStage,
        ...(nextStage === "delivered" ? { deliveredAt: nowIso } : {}),
      });

      if (nextStage === "delivered") {
        // Also close order in database & mark bill paid
        await admin
          .from("orders")
          .update({ status: "closed", closed_at: nowIso })
          .eq("id", orderId);

        await admin
          .from("bills")
          .update({ payment_status: "paid", paid_at: nowIso })
          .eq("order_id", orderId);
      }

      return NextResponse.json({ ok: true, dispatch });
    }

    // 3. Save / Update Rider in fleet
    if (action === "save_rider") {
      if (!restaurantId || !riderName?.trim() || !riderPhone?.trim()) {
        return NextResponse.json({ message: "restaurantId, riderName, and riderPhone are required" }, { status: 400 });
      }

      const riders = saveDeliveryRider(restaurantId, {
        id: riderId,
        name: riderName.trim(),
        phone: riderPhone.trim(),
        vehicle: vehicle || "Bike",
        active: true,
      });

      return NextResponse.json({ ok: true, riders });
    }

    // 4. Delete Rider from fleet
    if (action === "delete_rider") {
      if (!restaurantId || !riderId) {
        return NextResponse.json({ message: "restaurantId and riderId are required" }, { status: 400 });
      }

      const riders = deleteDeliveryRider(restaurantId, riderId);
      return NextResponse.json({ ok: true, riders });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to process dispatch action" }, { status: 500 });
  }
}
