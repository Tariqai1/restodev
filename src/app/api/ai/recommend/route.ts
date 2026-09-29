import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";

export async function POST(req: NextRequest) {
  let guestPrompt = "";
  let itemsList: any[] = [];
  let restoName = "";

  try {
    const body = await req.json().catch(() => ({}));
    guestPrompt = typeof body.prompt === "string" ? body.prompt : "";
    itemsList = Array.isArray(body.menuItems) ? body.menuItems : [];
    restoName = typeof body.restaurantName === "string" ? body.restaurantName : "";

    if (!guestPrompt) {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    const items = itemsList;
    // Provide a compact representation of the menu to save tokens
    const menuSummary = items
      .map((it) => `#${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}${it.description ? ` | ${it.description.slice(0, 60)}` : ""}`)
      .join("\n");

    const systemPrompt = `You are a warm, friendly, and food-savvy AI Captain & Food Assistant at "${restoName || "our restaurant"}".
You speak in conversational Hinglish (blend of Hindi and English, natural and friendly).
IMPORTANT: NEVER use the word "Namaste". Instead use friendly greetings like "Welcome!", "Hello!", "Hey there!", or directly jump to the recommendations.
Your goal is to recommend the best dishes from our restaurant menu based on the guest's taste, dietary preferences (veg/non-veg), spice level, and budget.

RESTAURANT MENU:
${menuSummary || "Menu items will be recommended generally."}

RESPONSE FORMAT:
You MUST respond with a JSON object in this exact schema:
{
  "message": "Friendly 1-3 sentence engaging recommendation in natural Hinglish explaining why these dishes match what the customer asked for.",
  "recommendedDishIds": ["<id1>", "<id2>"]
}
Only recommend dish IDs that exist in the RESTAURANT MENU above. Recommend 1 to 4 dishes maximum.`;

    const { text } = await callNvidiaChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: guestPrompt },
      ],
      {
        model: "meta/llama-3.2-11b-vision-instruct",
        temperature: 0.2,
        max_tokens: 400,
        timeoutMs: 12000,
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
    console.error("[AI Recommend Error]:", error?.message || error);
    
    // Resilient fallback based on guest prompt and available restaurant menu items
    const p = guestPrompt.toLowerCase();
    const isVegReq = p.includes("veg") && !p.includes("non-veg") && !p.includes("nonveg") && !p.includes("chicken") && !p.includes("mutton") && !p.includes("fish");
    const isNonVegReq = p.includes("non-veg") || p.includes("nonveg") || p.includes("chicken") || p.includes("mutton") || p.includes("fish") || p.includes("egg");
    
    const budgetMatch = p.match(/(?:under|below|budget|mein|me|₹|\b)(\d{2,4})\b/);
    const budget = budgetMatch ? Number(budgetMatch[1]) : 0;

    let pool = itemsList.filter((it: any) => it.is_available !== false);
    if (isVegReq) {
      const vegPool = pool.filter((it: any) => it.is_veg);
      if (vegPool.length > 0) pool = vegPool;
    }
    if (isNonVegReq) {
      const nonVegPool = pool.filter((it: any) => !it.is_veg);
      if (nonVegPool.length > 0) pool = nonVegPool;
    }
    if (budget > 0) {
      const budgetPool = pool.filter((it: any) => Number(it.price) <= budget);
      if (budgetPool.length > 0) pool = budgetPool;
    }

    const selected = pool.slice(0, 3);

    return NextResponse.json({
      ok: true,
      message: selected.length > 0
        ? `Aapke taste aur preference ke hisaab se humare menu se ye behtareen dishes zaroor try kijiye:`
        : "Aapke liye humare menu se ye popular dishes recommend kar rahe hain:",
      recommendedDishIds: selected.map((it: any) => it.id),
    });
  }
}
