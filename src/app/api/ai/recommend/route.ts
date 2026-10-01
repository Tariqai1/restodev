import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";

interface MenuCategorized {
  starters: any[];
  mainsVeg: any[];
  mainsNonVeg: any[];
  biryaniRice: any[];
  breads: any[];
  desserts: any[];
  beverages: any[];
  bestsellers: any[];
}

function formatMenuForAI(items: any[]): { menuText: string; categorized: MenuCategorized } {
  const cat: MenuCategorized = {
    starters: [],
    mainsVeg: [],
    mainsNonVeg: [],
    biryaniRice: [],
    breads: [],
    desserts: [],
    beverages: [],
    bestsellers: [],
  };

  items.forEach((it) => {
    if (it.is_available === false) return;
    const n = it.name.toLowerCase();
    const desc = it.description ? ` (${it.description.slice(0, 90)})` : "";
    const line = `#${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}${desc}`;

    if (it.is_bestseller) cat.bestsellers.push(it);

    if (
      n.includes("dessert") ||
      n.includes("gulab") ||
      n.includes("halwa") ||
      n.includes("rasmalai") ||
      n.includes("brownie") ||
      n.includes("ice cream") ||
      n.includes("sweet") ||
      n.includes("kheer")
    ) {
      cat.desserts.push(it);
    } else if (
      n.includes("chai") ||
      n.includes("coffee") ||
      n.includes("lassi") ||
      n.includes("soda") ||
      n.includes("mojito") ||
      n.includes("shake") ||
      n.includes("drink") ||
      n.includes("cooler")
    ) {
      cat.beverages.push(it);
    } else if (
      n.includes("roti") ||
      n.includes("naan") ||
      n.includes("paratha") ||
      n.includes("kulcha") ||
      n.includes("bread")
    ) {
      cat.breads.push(it);
    } else if (n.includes("biryani") || n.includes("pulao") || n.includes("rice")) {
      cat.biryaniRice.push(it);
    } else if (
      n.includes("tikka") ||
      n.includes("kebab") ||
      n.includes("crispy") ||
      n.includes("roll") ||
      n.includes("chaap") ||
      n.includes("lollipop") ||
      n.includes("65") ||
      n.includes("starter") ||
      n.includes("finger")
    ) {
      cat.starters.push(it);
    } else if (!it.is_veg) {
      cat.mainsNonVeg.push(it);
    } else {
      cat.mainsVeg.push(it);
    }
  });

  const sections: string[] = [];
  if (cat.bestsellers.length > 0) {
    sections.push(
      `=== ⭐ TOP BESTSELLERS ===\n` +
        cat.bestsellers.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}`).join("\n")
    );
  }
  if (cat.starters.length > 0) {
    sections.push(
      `=== 🍢 STARTERS & APPETIZERS ===\n` +
        cat.starters.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}`).join("\n")
    );
  }
  if (cat.mainsVeg.length > 0) {
    sections.push(
      `=== 🍲 MAIN COURSE (VEG) ===\n` +
        cat.mainsVeg.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | Veg`).join("\n")
    );
  }
  if (cat.mainsNonVeg.length > 0) {
    sections.push(
      `=== 🍗 MAIN COURSE (NON-VEG) ===\n` +
        cat.mainsNonVeg.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | Non-Veg`).join("\n")
    );
  }
  if (cat.biryaniRice.length > 0) {
    sections.push(
      `=== 🍚 BIRYANI & RICE ===\n` +
        cat.biryaniRice.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}`).join("\n")
    );
  }
  if (cat.breads.length > 0) {
    sections.push(
      `=== 🫓 BREADS & NAANS ===\n` +
        cat.breads.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | Veg`).join("\n")
    );
  }
  if (cat.desserts.length > 0) {
    sections.push(
      `=== 🍨 DESSERTS & SWEETS ===\n` +
        cat.desserts.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | Veg`).join("\n")
    );
  }
  if (cat.beverages.length > 0) {
    sections.push(
      `=== 🥤 BEVERAGES & COOLERS ===\n` +
        cat.beverages.map((it) => `#${it.id} | ${it.name} | ₹${it.price} | Veg`).join("\n")
    );
  }

  return { menuText: sections.join("\n\n"), categorized: cat };
}

export async function POST(req: NextRequest) {
  let guestPrompt = "";
  let itemsList: any[] = [];
  let restoName = "";
  let chatHistory: any[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    guestPrompt = typeof body.prompt === "string" ? body.prompt : "";
    itemsList = Array.isArray(body.menuItems) ? body.menuItems : [];
    restoName = typeof body.restaurantName === "string" ? body.restaurantName : "";
    chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];

    if (!guestPrompt) {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    const { menuText, categorized } = formatMenuForAI(itemsList);

    const systemPrompt = `You are the master Head Chef & Senior Dining Concierge at "${restoName || "our restaurant"}".
You speak in warm, delightful, appetite-whetting conversational Hinglish (a natural blend of Hindi and English, as spoken by top Indian restaurant captains).

STRICT OPERATIONAL RULES:
1. NEVER use the word "Namaste". Start with a warm greeting like "Welcome!", "Hello!", "Hey there!", or address the request directly.
2. ONLY recommend dishes that exist in the RESTAURANT MENU below. Never make up or hallucinate dishes.
3. UNDERSTAND MEAL COMPOSITION & PAIRING:
   - If guest asks for dinner/lunch for multiple people (e.g., "2 people", "family", "combo"): Suggest a balanced meal pairing (1 Starter + 1 Main Curry + Breads/Rice + optional Dessert or Drink).
   - If guest asks for something spicy: Recommend bold, spicy dishes (e.g. Kadhai Chicken, Veg Kolhapuri, Chicken Angara, Chicken 65, Honey Chilli Potato).
   - If guest asks for mild/creamy/sweet: Recommend rich, gentle gravies (e.g. Dal Makhani, Butter Chicken, Malai Kofta, Shahi Paneer).
   - If guest specifies a budget (e.g., "under ₹300", "under ₹500"): Select dishes whose prices fit within or match the budget.
   - If guest asks a follow-up question referencing past recommendations: Use the conversation context to provide the best pairing, side dish, or answer.

RESTAURANT MENU:
${menuText || "Menu items will be recommended generally."}

RESPONSE FORMAT:
You MUST respond with a JSON object in this exact schema:
{
  "message": "Enthusiastic, mouthwatering 2-3 sentence recommendation explaining the flavor profile and why these dishes are the perfect choice.",
  "recommendedDishIds": ["<id1>", "<id2>", "<id3>"],
  "pairingTip": "Optional pro-tip about culinary flavor notes or complementary drink/dessert (keep it brief and genuine, or null if none needed)",
  "followUpSuggestions": ["<clean text reply 1>", "<clean text reply 2>", "<clean text reply 3>"]
}
CRITICAL: In followUpSuggestions, DO NOT use any emojis or icons. Use clean plain text only (e.g. 'Kuch meetha bhi dikhao', 'Popular beverages', 'Mera bill status', 'Thode spicy options'). DO NOT ask or suggest roti/naan repeatedly unless the guest explicitly requests bread pairing.
Recommend 2 to 4 dishes maximum.`;

    const messagesToSend: any[] = [{ role: "system", content: systemPrompt }];

    // Inject recent conversation history for multi-turn awareness
    if (chatHistory.length > 0) {
      chatHistory.slice(-4).forEach((h) => {
        if (h.sender === "user" && h.text) {
          messagesToSend.push({ role: "user", content: h.text });
        } else if (h.sender === "ai" && h.text) {
          messagesToSend.push({ role: "assistant", content: h.text });
        }
      });
    }

    messagesToSend.push({ role: "user", content: guestPrompt });

    const { text } = await callNvidiaChat(messagesToSend, {
      model: "meta/llama-3.2-11b-vision-instruct",
      temperature: 0.25,
      max_tokens: 500,
      timeoutMs: 14000,
    });

    const parsed = extractJsonFromResponse<{
      message: string;
      recommendedDishIds: string[];
      pairingTip?: string;
      followUpSuggestions?: string[];
    }>(text);

    if (parsed && parsed.message) {
      const cleanSuggestions = Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions
            .map((s: string) =>
              typeof s === "string"
                ? s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim()
                : ""
            )
            .filter(Boolean)
        : undefined;

      return NextResponse.json({
        ok: true,
        message: parsed.message,
        recommendedDishIds: Array.isArray(parsed.recommendedDishIds) ? parsed.recommendedDishIds : [],
        pairingTip: parsed.pairingTip || null,
        followUpSuggestions: cleanSuggestions,
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

    // Smart Algorithmic Fallback Engine
    const p = guestPrompt.toLowerCase();
    const isVegReq =
      p.includes("veg") &&
      !p.includes("non-veg") &&
      !p.includes("nonveg") &&
      !p.includes("chicken") &&
      !p.includes("mutton") &&
      !p.includes("fish") &&
      !p.includes("egg");
    const isNonVegReq =
      p.includes("non-veg") ||
      p.includes("nonveg") ||
      p.includes("chicken") ||
      p.includes("mutton") ||
      p.includes("fish") ||
      p.includes("egg") ||
      p.includes("meat");

    const isSpicy = p.includes("spicy") || p.includes("mirch") || p.includes("chatpata") || p.includes("hot");
    const isSweet = p.includes("sweet") || p.includes("meetha") || p.includes("dessert") || p.includes("ice cream");
    const isCombo = p.includes("combo") || p.includes("family") || p.includes("dinner") || p.includes("lunch") || p.includes("log") || p.includes("people");

    const budgetMatch = p.match(/(?:under|below|budget|mein|me|₹|\b)(\d{2,4})\b/);
    const budget = budgetMatch ? Number(budgetMatch[1]) : 0;

    const available = itemsList.filter((it: any) => it.is_available !== false);
    let selected: any[] = [];

    if (isSweet) {
      selected = available.filter((it: any) => {
        const n = it.name.toLowerCase();
        return n.includes("gulab") || n.includes("rasmalai") || n.includes("brownie") || n.includes("halwa") || n.includes("ice cream") || n.includes("lassi");
      });
    } else if (isCombo) {
      // Build a balanced combo: 1 Starter + 1 Main + 1 Bread/Rice
      const starters = available.filter((it: any) =>
        (isVegReq ? it.is_veg : isNonVegReq ? !it.is_veg : true) &&
        (it.name.toLowerCase().includes("tikka") || it.name.toLowerCase().includes("kebab") || it.name.toLowerCase().includes("chaap") || it.name.toLowerCase().includes("crispy"))
      );
      const mains = available.filter((it: any) =>
        (isVegReq ? it.is_veg : isNonVegReq ? !it.is_veg : true) &&
        (it.name.toLowerCase().includes("butter") || it.name.toLowerCase().includes("kadhai") || it.name.toLowerCase().includes("dal") || it.name.toLowerCase().includes("rogan") || it.name.toLowerCase().includes("paneer"))
      );
      const breads = available.filter((it: any) =>
        it.name.toLowerCase().includes("naan") || it.name.toLowerCase().includes("roti") || it.name.toLowerCase().includes("biryani")
      );

      if (starters[0]) selected.push(starters[0]);
      if (mains[0]) selected.push(mains[0]);
      if (breads[0]) selected.push(breads[0]);
    } else {
      let pool = available;
      if (isVegReq) pool = pool.filter((it: any) => it.is_veg);
      if (isNonVegReq) pool = pool.filter((it: any) => !it.is_veg);
      if (budget > 0) pool = pool.filter((it: any) => Number(it.price) <= budget);

      if (isSpicy) {
        const spicyPool = pool.filter((it: any) => {
          const n = it.name.toLowerCase();
          return n.includes("tikka") || n.includes("kadhai") || n.includes("angara") || n.includes("kolhapuri") || n.includes("chilli") || n.includes("65");
        });
        if (spicyPool.length > 0) pool = spicyPool;
      }

      // Prioritize bestsellers
      const bestsellers = pool.filter((it: any) => it.is_bestseller);
      selected = bestsellers.length >= 2 ? bestsellers.slice(0, 3) : pool.slice(0, 3);
    }

    return NextResponse.json({
      ok: true,
      message:
        selected.length > 0
          ? `Aapke taste aur craving ke hisaab se ${restoName || "humare restaurant"} ki ye best dishes perfect rahengi:`
          : `Aapke liye ${restoName || "humare restaurant"} ke top chef recommendations yahan hain:`,
      recommendedDishIds: selected.map((it: any) => it.id),
      pairingTip: null,
      followUpSuggestions: [
        "Kuch meetha bhi dikhao",
        "Popular beverages",
        "Thode aur budget-friendly options",
      ],
    });
  }
}
