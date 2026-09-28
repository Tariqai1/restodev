import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";

export async function POST(req: NextRequest) {
  try {
    const { orderItems, activeKitchenOrdersCount } = await req.json();

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return NextResponse.json({ ok: false, error: "Order items are required" }, { status: 400 });
    }

    const itemsList = orderItems.map((it: any) => `${it.qty}x ${it.name}`).join(", ");
    const pendingTickets = typeof activeKitchenOrdersCount === "number" ? activeKitchenOrdersCount : 2;

    const systemPrompt = `You are an expert Executive Head Chef and Kitchen Operations Manager.
Estimate the realistic preparation and cooking time (in minutes) for an order given the dishes and kitchen queue load.

GUIDELINES:
- Cold drinks, salads, papad: 3-5 mins
- Fast snacks, fries, starters: 8-12 mins
- Curries, dals, paneer: 12-18 mins
- Fresh tandoor breads, naans: 8-12 mins
- Biryani, slow-cooked mains: 15-22 mins
- If kitchen has multiple pending orders (${pendingTickets} tickets in queue), add 2-5 minutes buffer.
- Never estimate below 5 minutes or above 45 minutes for normal dine-in.

RESPONSE FORMAT:
Respond ONLY with a JSON object:
{
  "estimatedMinutes": 15,
  "reason": "Quick reason explaining the estimate (e.g. 'Tandoor naans take ~10m, curry is simmering, +3m queue load.')"
}`;

    const { text } = await callNvidiaChat(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `New Order Items: [${itemsList}]. Active kitchen queue: ${pendingTickets} pending tickets.`,
        },
      ],
      {
        model: "meta/llama-3.2-11b-vision-instruct",
        temperature: 0.1,
        max_tokens: 300,
        timeoutMs: 12000,
      }
    );

    const parsed = extractJsonFromResponse<{ estimatedMinutes: number; reason: string }>(text);

    const minutes = Math.max(5, Math.min(60, Number(parsed?.estimatedMinutes) || 15));

    return NextResponse.json({
      ok: true,
      estimatedMinutes: minutes,
      reason: parsed?.reason || `Estimated ~${minutes} mins based on ordered dishes and kitchen load.`,
    });
  } catch (error: any) {
    console.error("[Smart Prep Time Error]:", error);
    // Provide sensible mathematical fallback if API call fails
    return NextResponse.json({
      ok: true,
      estimatedMinutes: 15,
      reason: "Standard chef prep window (15 mins)",
    });
  }
}
