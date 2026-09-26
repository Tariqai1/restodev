import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  removeItemFromPendingBatch,
  updateItemQtyInPendingBatch,
  isTableAwaitingApproval,
} from "@/lib/platform/state";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "unknown-client";
    const body = await request.json();
    const { token, orderId, orderItemId, action, qty } = body as {
      token: string;
      orderId: string;
      orderItemId: string;
      action: "cancel" | "update_qty";
      qty?: number;
    };

    if (!token || !orderId || !orderItemId || !action) {
      return NextResponse.json(
        { message: "Missing required parameters (token, orderId, orderItemId, action)." },
        { status: 400 }
      );
    }

    if (!["cancel", "update_qty"].includes(action)) {
      return NextResponse.json({ message: "Invalid action." }, { status: 400 });
    }

    // Rate Limiting: Max 20 actions per table token per minute
    const rateKey = `order-item:${token}:${ip}`;
    const rateCheck = checkRateLimit(rateKey, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const admin = createAdminClient();

    // 1. Verify Table Token
    const { data: table, error: tableError } = await admin
      .from("restaurant_tables")
      .select("id, restaurant_id, table_number, status")
      .eq("qr_token", token.trim())
      .maybeSingle();

    if (tableError || !table) {
      return NextResponse.json({ message: "Invalid table token." }, { status: 404 });
    }

    // 2. Fetch the target order item and verify ownership
    const { data: orderItem, error: itemError } = await admin
      .from("order_items")
      .select("id, order_id, qty, unit_price, item_status, notes")
      .eq("id", orderItemId)
      .eq("order_id", orderId)
      .maybeSingle();

    if (itemError || !orderItem) {
      return NextResponse.json(
        { message: "Dish not found in this active order." },
        { status: 404 }
      );
    }

    // 3. Strict Boundary: Only pending items can be modified/cancelled before verification
    if (orderItem.item_status !== "pending") {
      return NextResponse.json(
        {
          message:
            "This dish is already being prepared in the kitchen and cannot be modified.",
        },
        { status: 400 }
      );
    }

    // 4. Handle Actions
    if (action === "cancel") {
      // Update pending batch in memory/file store
      removeItemFromPendingBatch(
        orderItemId,
        Number(orderItem.unit_price),
        Number(orderItem.qty)
      );

      // Delete the order item from database
      const { error: delError } = await admin
        .from("order_items")
        .delete()
        .eq("id", orderItemId);

      if (delError) {
        throw new Error(delError.message || "Failed to cancel order item.");
      }

      // Check remaining items for this order
      const { count: remainingCount } = await admin
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("order_id", orderId);

      // If no items remain and table was pending without approval, reset table status
      if (
        (remainingCount === 0 || remainingCount === null) &&
        !isTableAwaitingApproval(table.id)
      ) {
        await admin
          .from("restaurant_tables")
          .update({ status: "empty" })
          .eq("id", table.id);
      }

      return NextResponse.json({
        ok: true,
        action: "cancelled",
        message: "Dish cancelled successfully.",
        orderItemId,
        remainingCount: remainingCount || 0,
      });
    }

    if (action === "update_qty") {
      const cleanQty = Math.max(1, Math.min(30, Math.floor(Number(qty)) || 1));
      if (cleanQty === orderItem.qty) {
        return NextResponse.json({
          ok: true,
          action: "unchanged",
          qty: cleanQty,
        });
      }

      // Update in memory/file store batch
      updateItemQtyInPendingBatch(
        orderItemId,
        Number(orderItem.qty),
        cleanQty,
        Number(orderItem.unit_price)
      );

      // Update in database
      const { error: updateError } = await admin
        .from("order_items")
        .update({ qty: cleanQty })
        .eq("id", orderItemId);

      if (updateError) {
        throw new Error(updateError.message || "Failed to update item quantity.");
      }

      return NextResponse.json({
        ok: true,
        action: "updated",
        message: "Quantity updated.",
        orderItemId,
        qty: cleanQty,
      });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Order item action error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
