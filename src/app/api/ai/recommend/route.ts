import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";
import { recordCustomerDemand } from "@/lib/platform/state";

interface CategoryMeta {
  id: string;
  name: string;
}

// Common food items guests often ask for that traditional Indian dine-in spots might not carry
const OUT_OF_MENU_DETECTORS = [
  { term: "pizza", label: "Pizza", hint: "Fast Food / Italian" },
  { term: "burger", label: "Burger", hint: "Fast Food" },
  { term: "momo", label: "Momos", hint: "Chinese / Fast Food" },
  { term: "pasta", label: "Pasta", hint: "Italian" },
  { term: "noodle", label: "Noodles / Chowmein", hint: "Chinese" },
  { term: "chowmein", label: "Chowmein", hint: "Chinese" },
  { term: "shawarma", label: "Shawarma", hint: "Middle Eastern" },
  { term: "falooda", label: "Falooda", hint: "Dessert / Beverage" },
  { term: "waffle", label: "Waffles", hint: "Dessert" },
  { term: "pancake", label: "Pancakes", hint: "Breakfast / Dessert" },
  { term: "sushi", label: "Sushi", hint: "Japanese" },
  { term: "sandwich", label: "Sandwich", hint: "Fast Food" },
  { term: "taco", label: "Tacos", hint: "Mexican" },
  { term: "dosa", label: "Dosa", hint: "South Indian" },
  { term: "idli", label: "Idli", hint: "South Indian" },
  { term: "beer", label: "Beer / Alcohol", hint: "Bar & Spirits" },
  { term: "wine", label: "Wine", hint: "Bar & Spirits" },
  { term: "whisky", label: "Whisky / Liquor", hint: "Bar & Spirits" },
  { term: "hookah", label: "Hookah / Sheesha", hint: "Lounge" },
];

function isSweetOrDessert(item: any, categoriesMap: Map<string, string>): boolean {
  const catName = (categoriesMap.get(item.category_id) || item.category || "").toLowerCase();
  const n = (item.name || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();

  if (catName.includes("dessert") || catName.includes("sweet") || catName.includes("mithai") || catName.includes("ice cream")) {
    return true;
  }

  return (
    n.includes("gulab") ||
    n.includes("halwa") ||
    n.includes("rasmalai") ||
    n.includes("brownie") ||
    n.includes("ice cream") ||
    n.includes("kheer") ||
    n.includes("kulfi") ||
    n.includes("jalebi") ||
    n.includes("pastry") ||
    n.includes("cake") ||
    n.includes("sweet lassi") ||
    desc.includes("dessert") ||
    desc.includes("sweet pudding")
  );
}

function formatMenuWithDynamicCategories(
  items: any[],
  categories: CategoryMeta[]
): {
  menuText: string;
  hasDesserts: boolean;
  dessertItems: any[];
  bestsellerItems: any[];
  categoriesMap: Map<string, string>;
} {
  const categoriesMap = new Map<string, string>();
  categories.forEach((c) => categoriesMap.set(c.id, c.name));

  const available = items.filter((it) => it.is_available !== false);
  const bestsellers = available.filter((it) => it.is_bestseller);
  const dessertItems = available.filter((it) => isSweetOrDessert(it, categoriesMap));

  // Group dishes by their actual DB Category Name
  const grouped = new Map<string, any[]>();
  available.forEach((it) => {
    let catName = categoriesMap.get(it.category_id) || it.category;
    if (!catName) {
      if (isSweetOrDessert(it, categoriesMap)) catName = "Desserts & Sweets";
      else if (it.is_veg) catName = "Vegetarian";
      else catName = "Non-Vegetarian";
    }
    if (!grouped.has(catName)) {
      grouped.set(catName, []);
    }
    grouped.get(catName)!.push(it);
  });

  const sections: string[] = [];
  grouped.forEach((dishes, catTitle) => {
    const lines = dishes.map(
      (it) => `${it.id} | ${it.name} | ₹${it.price} | ${it.is_veg ? "Veg" : "Non-Veg"}${it.description ? ` (${it.description.slice(0, 80)})` : ""}`
    );
    sections.push(`=== 📂 ${catTitle.toUpperCase()} ===\n${lines.join("\n")}`);
  });

  return {
    menuText: sections.join("\n\n"),
    hasDesserts: dessertItems.length > 0,
    dessertItems,
    bestsellerItems: bestsellers.length > 0 ? bestsellers : available.slice(0, 4),
    categoriesMap,
  };
}

function cleanDishBulletsFromMessage(msg: string): string {
  if (!msg) return "";
  const lines = msg.split("\n");
  const filtered = lines.filter((line) => {
    const l = line.trim();
    if (!l) return false;
    // Strip lines listing dishes/courses/prices so visual cards take center stage
    if (
      l.startsWith("-") ||
      l.startsWith("*") ||
      l.startsWith("•") ||
      /^\d+[\.\)]\s/.test(l)
    ) {
      if (
        l.includes("₹") ||
        /starter|main|course|bread|rice|dessert|curry|roti|naan|tikka/i.test(l)
      ) {
        return false;
      }
    }
    if (/^total\s*(price)?:/i.test(l)) {
      return false;
    }
    return true;
  });

  let result = filtered.join(" ").replace(/\s+/g, " ").trim();
  result = result.replace(/isme shaamil hai:?/i, "Ye dishes niche cards me di gayi hain:").trim();
  return result || msg;
}

function buildCuratedCombo(
  itemsList: any[],
  categoriesMap: Map<string, string>,
  pLower: string,
  restoName: string,
  dessertItems: any[],
  bestsellerItems: any[]
): { dishes: any[]; totalPrice: number; isAllVeg: boolean; comboLabel: string } | null {
  const available = itemsList.filter((it) => it.is_available !== false);
  if (available.length === 0) return null;

  const isVegOnly = pLower.includes("veg") && !pLower.includes("non-veg") && !pLower.includes("nonveg");
  const isNonVegOnly =
    pLower.includes("non-veg") ||
    pLower.includes("nonveg") ||
    pLower.includes("chicken") ||
    pLower.includes("mutton") ||
    pLower.includes("fish");

  let pool = available;
  if (isVegOnly) {
    pool = pool.filter((it) => it.is_veg);
  }

  // 1. Starter / Appetizer
  const starterCandidates = pool.filter((it) => {
    const cat = (categoriesMap.get(it.category_id) || it.category || "").toLowerCase();
    const n = it.name.toLowerCase();
    const isStarterCat =
      cat.includes("starter") ||
      cat.includes("snack") ||
      cat.includes("appetizer") ||
      cat.includes("tandoori") ||
      cat.includes("kebab") ||
      cat.includes("chinese");
    const isStarterName =
      n.includes("tikka") ||
      n.includes("kebab") ||
      n.includes("corn") ||
      n.includes("crispy") ||
      n.includes("roll") ||
      n.includes("65") ||
      n.includes("chilli") ||
      n.includes("fry") ||
      n.includes("dry") ||
      n.includes("soup");
    return isStarterCat || isStarterName;
  });
  let starter =
    starterCandidates.find((it) => (isNonVegOnly ? !it.is_veg : true) && it.is_bestseller) ||
    starterCandidates.find((it) => (isNonVegOnly ? !it.is_veg : true)) ||
    starterCandidates[0];

  // 2. Main Course / Curry
  const mainCandidates = pool.filter((it) => {
    if (starter && it.id === starter.id) return false;
    const cat = (categoriesMap.get(it.category_id) || it.category || "").toLowerCase();
    const n = it.name.toLowerCase();
    const isMainCat =
      cat.includes("main") ||
      cat.includes("curry") ||
      cat.includes("gravy") ||
      cat.includes("special");
    const isMainName =
      n.includes("makhani") ||
      n.includes("butter") ||
      n.includes("kadhai") ||
      n.includes("curry") ||
      n.includes("handi") ||
      n.includes("masala") ||
      n.includes("korma") ||
      n.includes("dal") ||
      n.includes("paneer") ||
      n.includes("kofta");
    return isMainCat || isMainName;
  });
  let main =
    mainCandidates.find((it) => (isNonVegOnly ? !it.is_veg : true) && it.is_bestseller) ||
    mainCandidates.find((it) => (isNonVegOnly ? !it.is_veg : true)) ||
    mainCandidates[0];

  // 3. Bread or Rice
  const breadRiceCandidates = pool.filter((it) => {
    if (starter && it.id === starter.id) return false;
    if (main && it.id === main.id) return false;
    const cat = (categoriesMap.get(it.category_id) || it.category || "").toLowerCase();
    const n = it.name.toLowerCase();
    const isBreadCat =
      cat.includes("bread") ||
      cat.includes("roti") ||
      cat.includes("rice") ||
      cat.includes("biryani");
    const isBreadName =
      n.includes("naan") ||
      n.includes("roti") ||
      n.includes("kulcha") ||
      n.includes("paratha") ||
      n.includes("biryani") ||
      n.includes("rice") ||
      n.includes("pulao");
    return isBreadCat || isBreadName;
  });
  let breadOrRice = breadRiceCandidates.find((it) => it.is_bestseller) || breadRiceCandidates[0];

  // 4. Dessert or Beverage
  let sweetOrDrink: any = null;
  if (dessertItems.length > 0) {
    sweetOrDrink = dessertItems[0];
  } else {
    const drinkCandidates = available.filter((it) => {
      const cat = (categoriesMap.get(it.category_id) || it.category || "").toLowerCase();
      const n = it.name.toLowerCase();
      return (
        cat.includes("beverage") ||
        cat.includes("drink") ||
        n.includes("chai") ||
        n.includes("tea") ||
        n.includes("lassi") ||
        n.includes("soda") ||
        n.includes("lime") ||
        n.includes("shake")
      );
    });
    sweetOrDrink = drinkCandidates[0];
  }

  // Assemble combo
  const comboDishes: any[] = [];
  if (starter) comboDishes.push(starter);
  if (main && !comboDishes.some((d) => d.id === main.id)) comboDishes.push(main);
  if (breadOrRice && !comboDishes.some((d) => d.id === breadOrRice.id)) comboDishes.push(breadOrRice);
  if (sweetOrDrink && !comboDishes.some((d) => d.id === sweetOrDrink.id)) comboDishes.push(sweetOrDrink);

  // If still fewer than 4, fill with bestsellers
  for (const b of bestsellerItems) {
    if (comboDishes.length >= 4) break;
    if (!comboDishes.some((d) => d.id === b.id)) {
      comboDishes.push(b);
    }
  }

  // Fallback to pool if still fewer than 2
  for (const p of pool) {
    if (comboDishes.length >= 4) break;
    if (!comboDishes.some((d) => d.id === p.id)) {
      comboDishes.push(p);
    }
  }

  if (comboDishes.length === 0) return null;

  const totalPrice = comboDishes.reduce((sum, d) => sum + Number(d.price || 0), 0);
  const isAllVeg = comboDishes.every((d) => d.is_veg);
  const comboLabel = isAllVeg ? "Veg" : "Special";

  return {
    dishes: comboDishes,
    totalPrice,
    isAllVeg,
    comboLabel,
  };
}

export async function POST(req: NextRequest) {
  let guestPrompt = "";
  let itemsList: any[] = [];
  let categoriesList: CategoryMeta[] = [];
  let restoName = "";
  let restaurantId = "";
  let chatHistory: any[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    guestPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    itemsList = Array.isArray(body.menuItems) ? body.menuItems : [];
    categoriesList = Array.isArray(body.categories) ? body.categories : [];
    restoName = typeof body.restaurantName === "string" ? body.restaurantName : "";
    restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
    chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];

    if (!guestPrompt) {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    const {
      menuText,
      hasDesserts,
      dessertItems,
      bestsellerItems,
      categoriesMap,
    } = formatMenuWithDynamicCategories(itemsList, categoriesList);

    const pLower = guestPrompt.toLowerCase();

    // =========================================================================
    // LAYER 2: INSTANT SUB-50ms INTENT GUARDRAILS (< 50ms Response)
    // =========================================================================

    // 1. Direct Out-of-Menu Check (Pizza, Burger, Momos, etc.)
    for (const detector of OUT_OF_MENU_DETECTORS) {
      if (pLower.includes(detector.term)) {
        // Check if restaurant actually has this dish in its menu
        const itemInMenu = itemsList.find(
          (it) => it.name.toLowerCase().includes(detector.term) && it.is_available !== false
        );

        if (!itemInMenu) {
          // Record unfulfilled demand for admin analytics
          if (restaurantId) {
            recordCustomerDemand(restaurantId, detector.label, detector.hint);
          }

          const topDishes = bestsellerItems.slice(0, 3);
          return NextResponse.json({
            ok: true,
            message: `Nahi sir, hamare menu me ${detector.label} available nahi hai. Lekin agar aapko kuch mazedaar khana hai to hamare chef ke ye popular bestsellers try kar sakte hain:`,
            recommendedDishIds: topDishes.map((d) => d.id),
            pairingTip: "Aap hamare tandoori starters aur gravies ke saath Butter Naan try kijiye.",
            followUpSuggestions: [
              "Kuch meetha bhi dikhao",
              "Popular beverages",
              "Mera bill status",
            ],
          });
        }
      }
    }

    // 2. Direct Sweet / "Meetha" / Dessert Request Guardrail
    const isAskingForSweet =
      pLower.includes("meetha") ||
      pLower.includes("sweet") ||
      pLower.includes("dessert") ||
      pLower.includes("mithai") ||
      pLower.includes("ice cream") ||
      pLower.includes("kheer") ||
      pLower.includes("halwa");

    if (isAskingForSweet) {
      if (hasDesserts) {
        const sweetRecommendations = dessertItems.slice(0, 3);
        return NextResponse.json({
          ok: true,
          message: `Aapki sweet craving ke liye hamare paas ye behtareen desserts available hain:`,
          recommendedDishIds: sweetRecommendations.map((d) => d.id),
          pairingTip: "Khane ke baad hot dessert ya chilled ice cream meal ko complete karta hai.",
          followUpSuggestions: [
            "Popular beverages",
            "Mera bill kitna hua",
            "Thode aur options dikhaiye",
          ],
        });
      } else {
        // Log missing dessert demand
        if (restaurantId) {
          recordCustomerDemand(restaurantId, "Desserts & Sweets", "Desserts");
        }
        return NextResponse.json({
          ok: true,
          message: `Maafi chahenge sir, abhi hamare menu me desserts/meetha available nahi hai. Lekin agar aap chahein to meal ke baad hamari hot Masala Chai ya cold beverage enjoy kar sakte hain.`,
          recommendedDishIds: itemsList
            .filter((it) => {
              const n = it.name.toLowerCase();
              return n.includes("chai") || n.includes("tea") || n.includes("coffee") || n.includes("soda") || n.includes("lassi");
            })
            .slice(0, 2)
            .map((it) => it.id),
          pairingTip: null,
          followUpSuggestions: [
            "Popular beverages",
            "Top bestsellers",
            "Mera bill status",
          ],
        });
      }
    }

    // 3. Direct Combo / Family Dinner / Thali Request Guardrail (< 20ms Response)
    const isComboReq =
      pLower.includes("combo") ||
      pLower.includes("family") ||
      pLower.includes("thali") ||
      pLower.includes("dinner for") ||
      pLower.includes("lunch for") ||
      pLower.includes("meal for") ||
      pLower.includes("2 log") ||
      pLower.includes("4 log") ||
      pLower.includes("do log") ||
      pLower.includes("chaar log") ||
      pLower.includes("couple");

    if (isComboReq) {
      const combo = buildCuratedCombo(itemsList, categoriesMap, pLower, restoName, dessertItems, bestsellerItems);
      if (combo && combo.dishes.length >= 2) {
        return NextResponse.json({
          ok: true,
          message: `Aapke parivaar ke liye hamare chef ne ye balanced ${combo.comboLabel} Dinner Combo chuna hai (Total: ₹${combo.totalPrice}). Niche diye button se aap pura combo 1 tap me cart me add kar sakte hain!`,
          recommendedDishIds: combo.dishes.map((d) => d.id),
          pairingTip: "Aap har dish ko alag se ya pure combo ko ek saath 1-click me cart me add kar sakte hain.",
          followUpSuggestions: [
            combo.isAllVeg ? "Non-veg combo dikhao" : "Pure veg combo dikhao",
            "Kuch meetha bhi dikhao",
            "Popular beverages",
          ],
        });
      }
    }

    // =========================================================================
    // LAYER 3: 5-STAR HUMAN DINING CAPTAIN AI (HIGH ACCURACY LLM)
    // =========================================================================

    const recentDishesIds: string[] = [];
    if (chatHistory.length > 0) {
      // Collect dishes previously shown to prevent repetition on "aur options"
      chatHistory.forEach((h) => {
        if (Array.isArray(h.recommendedDishIds)) {
          recentDishesIds.push(...h.recommendedDishIds);
        }
      });
    }

    const systemPrompt = `You are the master Head Chef & Senior Dining Concierge at "${restoName || "our restaurant"}".
You speak in warm, delightful, natural, polite conversational Hinglish (friendly Indian restaurant dining captain).

STRICT OPERATIONAL RULES:
1. DIRECT & TRUTHFUL ANSWER FIRST:
   - Answer the guest's specific inquiry directly and clearly.
   - If guest asks about creamy gravies: Recommend curries like Butter Chicken, Paneer Butter Masala, Dal Makhani, Malai Kofta.
   - If guest asks about spicy food: Recommend spicy curries/starters (e.g. Kadhai Chicken, Chicken Angara, Veg Kolhapuri, Chilli Chicken).
   - If guest asks for dinner combo for 2 or family: Give a balanced pairing (1 Starter + 1 Main Curry + Breads/Rice).
   - If guest asks "Thode aur options": Provide fresh, different dishes from other categories that were NOT shown before.
2. CATEGORY TRUTHFULNESS:
   - NEVER call savoury curries, dals, gravies, or breads "meetha" or "dessert"!
   - ONLY recommend dishes that actually exist in the RESTAURANT MENU below. Never make up or hallucinate dishes.
3. BAN ROBOTIC CLICHÉS:
   - DO NOT repeat phrases like "Yeh combination aapke taste buds ko khush kar dega" or "anokha vikalp" or "meetha sa thaal".
   - Speak genuinely, warmly, and naturally as an attentive restaurant host.
4. NO BULLET LIST OF DISHES IN MESSAGE:
   - DO NOT list dishes with bullets ("- Starter: ...") in "message". The application automatically renders interactive dish cards with direct "[ ADD + ]" buttons underneath your response.
   - Your "message" must ONLY be a warm, mouthwatering 1-2 sentence hospitality greeting explaining why this selection suits their taste.
5. RECOMMENDATION LIMIT:
   - Recommend 2 to 4 dishes maximum and provide their exact IDs in "recommendedDishIds".

RESTAURANT MENU (Grouped by Real Categories):
${menuText || "No active dishes listed."}

RESPONSE SCHEMA (JSON ONLY):
{
  "message": "Direct, hospitable, mouthwatering 1-2 sentence response explaining why these dishes fit the guest's taste (WITHOUT listing dish names as bullets).",
  "recommendedDishIds": ["<id1>", "<id2>"],
  "pairingTip": "Brief helpful pairing tip or null",
  "followUpSuggestions": ["<clean suggestion 1>", "<clean suggestion 2>", "<clean suggestion 3>"]
}
In followUpSuggestions: Use clean plain text only (NO emojis). Example: 'Kuch meetha bhi dikhao', 'Popular beverages', 'Mera bill status'.`;

    const messagesToSend: any[] = [{ role: "system", content: systemPrompt }];

    // Inject last 4 turns for context awareness
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
      temperature: 0.3,
      max_tokens: 400,
      timeoutMs: 12000,
    });

    const parsed = extractJsonFromResponse<{
      message: string;
      recommendedDishIds: string[];
      pairingTip?: string;
      followUpSuggestions?: string[];
    }>(text);

    if (parsed && parsed.message) {
      const rawDishIds = Array.isArray(parsed.recommendedDishIds) ? parsed.recommendedDishIds : [];
      // Clean and validate dish IDs
      let validDishIds = rawDishIds
        .map((id) => (typeof id === "string" ? id.replace(/^[#\s]+/, "").trim() : ""))
        .filter((id) => itemsList.some((it) => it.id === id));

      // If model returned dish names or plain text in IDs, match them
      if (validDishIds.length === 0) {
        const combined = (parsed.message + " " + guestPrompt).toLowerCase();
        const found = itemsList.filter(
          (it) => it.is_available !== false && combined.includes(it.name.toLowerCase())
        );
        if (found.length > 0) {
          validDishIds = found.slice(0, 4).map((it) => it.id);
        }
      }

      // Universal Card Guarantee: If STILL empty, attach top bestsellers so [ ADD + ] cards are never missing
      if (validDishIds.length === 0) {
        validDishIds = bestsellerItems.slice(0, 2).map((it) => it.id);
      }

      const cleanMessage = cleanDishBulletsFromMessage(parsed.message);

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
        message: cleanMessage,
        recommendedDishIds: validDishIds,
        pairingTip: parsed.pairingTip || "Aap niche diye card se direct 1-tap me cart me add kar sakte hain.",
        followUpSuggestions: cleanSuggestions,
      });
    }

    // Fallback if plain text was returned
    const plainMsg = text.replace(/```(?:json)?/g, "").trim();
    let fallbackMatched = itemsList.filter(
      (it) => it.is_available !== false && (plainMsg + " " + guestPrompt).toLowerCase().includes(it.name.toLowerCase())
    );
    if (fallbackMatched.length === 0) {
      fallbackMatched = bestsellerItems.slice(0, 3);
    }
    const cleanPlainMsg = cleanDishBulletsFromMessage(plainMsg);

    return NextResponse.json({
      ok: true,
      message: cleanPlainMsg,
      recommendedDishIds: fallbackMatched.slice(0, 4).map((it) => it.id),
      pairingTip: "Aap niche diye card se direct 1-tap me cart me add kar sakte hain.",
      followUpSuggestions: ["Kuch meetha bhi dikhao", "Popular beverages", "Mera bill status"],
    });
  } catch (error: any) {
    console.error("[AI Recommend Error]:", error?.message || error);

    // Smart Local Fallback Engine (Strictly respecting human dining protocol)
    const p = guestPrompt.toLowerCase();
    const available = itemsList.filter((it: any) => it.is_available !== false);

    const isVegOnly = p.includes("veg") && !p.includes("non-veg") && !p.includes("nonveg");
    const isNonVegOnly = p.includes("non-veg") || p.includes("nonveg") || p.includes("chicken") || p.includes("mutton");
    const isSpicy = p.includes("spicy") || p.includes("teekha") || p.includes("mirch");
    const isCreamy = p.includes("creamy") || p.includes("gravy") || p.includes("curry") || p.includes("butter");

    let pool = available;
    if (isVegOnly) pool = pool.filter((it: any) => it.is_veg);
    if (isNonVegOnly) pool = pool.filter((it: any) => !it.is_veg);

    if (isSpicy) {
      const spicyItems = pool.filter((it: any) => {
        const n = it.name.toLowerCase();
        return n.includes("kadhai") || n.includes("angara") || n.includes("kolhapuri") || n.includes("tikka") || n.includes("65");
      });
      if (spicyItems.length > 0) pool = spicyItems;
    } else if (isCreamy) {
      const creamyItems = pool.filter((it: any) => {
        const n = it.name.toLowerCase();
        return n.includes("butter") || n.includes("makhani") || n.includes("kofta") || n.includes("korma") || n.includes("malai");
      });
      if (creamyItems.length > 0) pool = creamyItems;
    }

    const selectedDishes = pool.slice(0, 3);
    const finalDishes = selectedDishes.length > 0 ? selectedDishes : available.slice(0, 3);

    return NextResponse.json({
      ok: true,
      message:
        finalDishes.length > 0
          ? `Aapke taste ke mutabiq ${restoName || "hamare restaurant"} ke ye popular chef specials perfect rahenge:`
          : `Aapke liye ${restoName || "hamare restaurant"} ke top recommendations yahan hain:`,
      recommendedDishIds: finalDishes.map((d: any) => d.id),
      pairingTip: "Aap niche diye card se direct 1-tap me cart me add kar sakte hain.",
      followUpSuggestions: [
        "Kuch meetha bhi dikhao",
        "Popular beverages",
        "Mera bill status",
      ],
    });
  }
}
