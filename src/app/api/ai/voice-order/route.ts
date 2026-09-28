import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";

export async function POST(req: NextRequest) {
  try {
    const { transcript, menuItems } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ ok: false, error: "Spoken transcript is required" }, { status: 400 });
    }

    const items = Array.isArray(menuItems) ? menuItems : [];
    const menuSummary = items
      .map((it) => `#${it.id} | ${it.name} | ₹${it.price}`)
      .join("\n");

    const systemPrompt = `You are an expert Voice Order Parser for a restaurant POS system.
The user speaks in Hindi, Hinglish, or English (e.g. "2 butter naan aur ek plate kadai paneer half", "give me one coke and two biryani").
Your task is to identify which items from the restaurant menu the customer wants to order, along with their quantities and portion.

RESTAURANT MENU:
${menuSummary}

INSTRUCTIONS:
1. Match spoken dish names to the closest matching item in the RESTAURANT MENU.
2. Extract quantity (default 1 if not specified, e.g. "ek" = 1, "do" = 2, "teen" = 3, "char" = 4).
3. Extract portion if specified ("half" or "full", default "full").
4. Return a JSON object with this EXACT schema:
{
  "summary": "Short confirmation line in Hinglish (e.g. '2 Butter Naan aur 1 Kadai Paneer samjh gaya!')",
  "matchedItems": [
    {
      "dishId": "<menu item id>",
      "name": "<exact menu item name>",
      "qty": 2,
      "portion": "full"
    }
  ]
}
If no dishes match the menu, return {"summary": "Koi dish match nahi hui, kripya dobara bolein.", "matchedItems": []}.`;

    const { text } = await callNvidiaChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Customer said: "${transcript}"` },
      ],
      {
        model: "meta/llama-3.2-11b-vision-instruct",
        temperature: 0.1,
        max_tokens: 400,
        timeoutMs: 12000,
      }
    );

    const parsed = extractJsonFromResponse<{ summary: string; matchedItems: any[] }>(text);

    return NextResponse.json({
      ok: true,
      summary: parsed?.summary || "Order processed",
      matchedItems: Array.isArray(parsed?.matchedItems) ? parsed.matchedItems : [],
    });
  } catch (error: any) {
    console.error("[Voice Order Parse Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to parse voice order" },
      { status: 500 }
    );
  }
}
