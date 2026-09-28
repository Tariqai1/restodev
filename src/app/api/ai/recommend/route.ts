import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";

export async function POST(req: NextRequest) {
  try {
    const { prompt, menuItems, restaurantName } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    const items = Array.isArray(menuItems) ? menuItems : [];
    // Provide a compact representation of the menu to save tokens
    const menuSummary = items
      .map((it) => `#${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}${it.description ? ` | ${it.description.slice(0, 60)}` : ""}`)
      .join("\n");

    const systemPrompt = `You are a warm, polite, and food-savvy AI Captain & Waiter at "${restaurantName || "our restaurant"}".
You speak in friendly Hinglish (blend of Hindi and English like in Indian restaurants).
Your goal is to recommend the best dishes from our restaurant menu based on the guest's taste, dietary preferences (veg/non-veg), spice level, and budget.

RESTAURANT MENU:
${menuSummary || "Menu items will be recommended generally."}

RESPONSE FORMAT:
You MUST respond with a JSON object in this exact schema:
{
  "message": "Friendly 2-3 sentence recommendation explaining why these dishes match what the customer asked for.",
  "recommendedDishIds": ["<id1>", "<id2>"]
}
Only recommend dish IDs that exist in the RESTAURANT MENU above. Recommend 1 to 4 dishes maximum.`;

    const { text } = await callNvidiaChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      {
        model: "meta/llama-3.3-70b-instruct",
        temperature: 0.6,
        max_tokens: 600,
      }
    );

    const parsed = extractJsonFromResponse<{ message: string; recommendedDishIds: string[] }>(text);

    if (parsed && parsed.message) {
      return NextResponse.json({
        ok: true,
        message: parsed.message,
        recommendedDishIds: Array.isArray(parsed.recommendedDishIds) ? parsed.recommendedDishIds : [],
      });
    }

    // Fallback if model returned plain text
    return NextResponse.json({
      ok: true,
      message: text.replace(/```(?:json)?/g, "").trim(),
      recommendedDishIds: [],
    });
  } catch (error: any) {
    console.error("[AI Recommend Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to generate recommendation" },
      { status: 500 }
    );
  }
}
