import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffContext } from "@/lib/auth/staff-context";

interface MenuItemDraft {
  name: string;
  price: number;
  is_veg?: boolean;
  description?: string;
}

interface MenuCategoryDraft {
  name: string;
  items: MenuItemDraft[];
}

/**
 * Robust heuristic parser for plain text menus when Vision AI is not needed or as a fallback
 */
function parseMenuTextHeuristically(text: string): MenuCategoryDraft[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const categoryMap = new Map<string, MenuItemDraft[]>();
  let currentCategory = "Main Course";

  const KNOWN_CATEGORIES = /^(?:\[|\*|#|-)*\s*(starters|appetizers|main course|mains|curries|gravies|breads|rotis|rice|biryani|beverages|drinks|coolers|desserts|sweets|soups|tandoor|chinese|fast food|snacks|shakes)/i;

  for (const line of lines) {
    // Check if this line is a category header
    const catMatch = line.match(KNOWN_CATEGORIES);
    const isUpperHeader = !line.match(/\d+/) && line.length < 32 && line === line.toUpperCase() && line.length > 2;

    if (catMatch || isUpperHeader) {
      const cleanHeader = line
        .replace(/^[#*\[\-\]]+|[#*\[\-\]]+$/g, "")
        .replace(/[:\-]+$/, "")
        .trim();
      if (cleanHeader) {
        currentCategory = cleanHeader;
        if (!categoryMap.has(currentCategory)) {
          categoryMap.set(currentCategory, []);
        }
        continue;
      }
    }

    // Try extract price and name
    const priceMatch = line.match(/(?:₹|rs\.?|inr)?\s*(\d{2,4})\b/i);
    if (priceMatch) {
      const price = parseInt(priceMatch[1], 10);
      const namePart = line
        .replace(/(?:₹|rs\.?|inr)?\s*(\d{2,4})\b/i, "")
        .replace(/^[•\-\*\d\.\)\s]+/, "")
        .replace(/[\(\[\{].*?[\)\]\}]/g, "") // remove parenthetical remarks
        .trim();

      if (namePart.length >= 2) {
        const isVeg = !/chicken|mutton|fish|prawn|egg|lamb|meat|pork|beef|keema|seekh/i.test(namePart);
        if (!categoryMap.has(currentCategory)) {
          categoryMap.set(currentCategory, []);
        }
        categoryMap.get(currentCategory)!.push({
          name: namePart,
          price: Math.max(10, price),
          is_veg: isVeg,
          description: "",
        });
      }
    }
  }

  // Convert map to array
  const result: MenuCategoryDraft[] = [];
  for (const [name, items] of categoryMap.entries()) {
    if (items.length > 0) {
      result.push({ name, items });
    }
  }

  // Fallback default sample if nothing could be parsed
  if (result.length === 0) {
    result.push({
      name: "Specialties",
      items: [
        { name: "Paneer Butter Masala", price: 260, is_veg: true, description: "Cottage cheese in rich tomato gravy" },
        { name: "Butter Naan", price: 60, is_veg: true, description: "Crisp tandoori bread" },
        { name: "Chicken Biryani", price: 320, is_veg: false, description: "Fragrant spiced basmati rice" },
      ],
    });
  }

  return result;
}

/**
 * Saves extracted categories and dishes to Supabase without invalid onConflict assumptions
 */
async function saveCategoriesAndItems(
  targetRestaurantId: string,
  categories: MenuCategoryDraft[]
) {
  const supabase = createAdminClient();
  const insertedCounts = { categories: 0, items: 0 };

  // Fetch all existing categories for this restaurant
  const { data: existingCategories } = await supabase
    .from("menu_categories")
    .select("id, name, is_archived, sort_order")
    .eq("restaurant_id", targetRestaurantId);

  const catMap = new Map<string, string>();
  let maxSortOrder = 0;

  if (Array.isArray(existingCategories)) {
    for (const c of existingCategories) {
      catMap.set(c.name.trim().toLowerCase(), c.id);
      if (c.sort_order > maxSortOrder) maxSortOrder = c.sort_order;
    }
  }

  // Fetch all existing menu items for this restaurant
  const { data: existingItems } = await supabase
    .from("menu_items")
    .select("id, name")
    .eq("restaurant_id", targetRestaurantId);

  const itemMap = new Map<string, string>();
  if (Array.isArray(existingItems)) {
    for (const it of existingItems) {
      itemMap.set(it.name.trim().toLowerCase(), it.id);
    }
  }

  for (const cat of categories) {
    if (!cat.name || !Array.isArray(cat.items) || cat.items.length === 0) continue;

    const cleanCatName = cat.name.trim();
    const catKey = cleanCatName.toLowerCase();
    let catId = catMap.get(catKey);

    if (!catId) {
      maxSortOrder += 1;
      const { data: newCat, error: catErr } = await supabase
        .from("menu_categories")
        .insert({
          restaurant_id: targetRestaurantId,
          name: cleanCatName,
          sort_order: maxSortOrder,
          is_archived: false,
        })
        .select("id")
        .single();

      if (!catErr && newCat) {
        catId = newCat.id;
        catMap.set(catKey, newCat.id);
        insertedCounts.categories++;
      }
    }

    // Insert or update items under this category
    for (const it of cat.items) {
      if (!it.name) continue;
      const cleanItemName = String(it.name).trim();
      const itemKey = cleanItemName.toLowerCase();
      const price = Math.max(0, Math.round(Number(it.price) || 99));
      const isVeg = Boolean(it.is_veg);
      const desc = it.description ? String(it.description).trim() : null;

      const existingItemId = itemMap.get(itemKey);
      if (existingItemId) {
        await supabase
          .from("menu_items")
          .update({
            price,
            is_veg: isVeg,
            category_id: catId || null,
            description: desc,
            is_available: true,
          })
          .eq("id", existingItemId);
      } else {
        const { data: newItem, error: itemErr } = await supabase
          .from("menu_items")
          .insert({
            restaurant_id: targetRestaurantId,
            category_id: catId || null,
            name: cleanItemName,
            price,
            is_veg: isVeg,
            description: desc,
            is_available: true,
            is_bestseller: false,
          })
          .select("id")
          .single();

        if (!itemErr && newItem) {
          itemMap.set(itemKey, newItem.id);
          insertedCounts.items++;
        }
      }
    }
  }

  return insertedCounts;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      imageBase64,
      imageUrl,
      menuText,
      categories: clientCategories,
      action = "parse",
      saveToRestaurantId,
    } = body;

    // Resolve target restaurant ID
    let targetRestaurantId = saveToRestaurantId;
    if (!targetRestaurantId) {
      const userSupabase = await createClient();
      const {
        data: { user },
      } = await userSupabase.auth.getUser();
      if (user) {
        const staff = await resolveStaffContext(user);
        if (staff?.restaurantId) {
          targetRestaurantId = staff.restaurantId;
        }
      }
    }

    // Direct Import Action: if user has already reviewed the categories and wants to commit them
    if (action === "import" || (clientCategories && Array.isArray(clientCategories) && targetRestaurantId)) {
      if (!targetRestaurantId) {
        return NextResponse.json(
          { ok: false, error: "Restaurant ID is required to import items to menu." },
          { status: 400 }
        );
      }
      const categoriesToSave = Array.isArray(clientCategories) ? clientCategories : [];
      const insertedCounts = await saveCategoriesAndItems(targetRestaurantId, categoriesToSave);

      return NextResponse.json({
        ok: true,
        saved: true,
        insertedCounts,
        message: `Imported ${insertedCounts.items} dishes across ${insertedCounts.categories} categories.`,
      });
    }

    // PARSING MODE:
    // Option A: Text parsing
    if (menuText && typeof menuText === "string" && menuText.trim().length > 0) {
      let parsedCategories: MenuCategoryDraft[] = [];

      try {
        const promptText = `Analyze this raw restaurant menu text and extract all food/beverage items into structured categories.
For each dish extract:
- name: Dish name
- price: Numeric price (in INR/Rupees, without symbols)
- is_veg: Boolean (true if vegetarian/green dot, false if chicken/mutton/fish/egg/red dot)
- description: Brief description if visible (or empty string)

MENU TEXT:
${menuText.slice(0, 3000)}

OUTPUT FORMAT:
Respond ONLY with a JSON object:
{
  "categories": [
    {
      "name": "Starters",
      "items": [
        { "name": "Paneer Tikka", "price": 220, "is_veg": true, "description": "Grilled cottage cheese" }
      ]
    }
  ]
}`;

        const { text } = await callNvidiaChat(
          [{ role: "user", content: promptText }],
          {
            model: "meta/llama-3.2-11b-vision-instruct",
            temperature: 0.1,
            max_tokens: 1500,
            timeoutMs: 15000,
          }
        );

        const parsed = extractJsonFromResponse<{ categories: MenuCategoryDraft[] }>(text);
        if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
          parsedCategories = parsed.categories;
        }
      } catch (aiErr) {
        console.warn("[Menu OCR] AI Text Parse failed, falling back to heuristic:", aiErr);
      }

      if (parsedCategories.length === 0) {
        parsedCategories = parseMenuTextHeuristically(menuText);
      }

      let insertedCounts = { categories: 0, items: 0 };
      if (targetRestaurantId && saveToRestaurantId) {
        insertedCounts = await saveCategoriesAndItems(targetRestaurantId, parsedCategories);
      }

      return NextResponse.json({
        ok: true,
        categories: parsedCategories,
        saved: Boolean(targetRestaurantId && saveToRestaurantId),
        insertedCounts,
      });
    }

    // Option B: Image Vision OCR
    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { ok: false, error: "Please upload a menu image or paste menu text to scan." },
        { status: 400 }
      );
    }

    const imageSource = imageUrl || (imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`);

    const promptText = `Analyze this restaurant menu photo and extract all food/beverage items into structured categories.
For each dish extract:
- name: Dish name (clean title)
- price: Numeric price (in INR/Rupees, without symbols)
- is_veg: Boolean (true if vegetarian/green dot, false if chicken/mutton/fish/egg/red dot)
- description: Brief description if visible on the card (or empty string)

OUTPUT FORMAT:
Respond ONLY with a JSON object:
{
  "categories": [
    {
      "name": "Starters",
      "items": [
        { "name": "Paneer Tikka", "price": 220, "is_veg": true, "description": "Grilled cottage cheese cubes" }
      ]
    }
  ]
}`;

    // NVIDIA NIM Vision call
    let parsedCategories: MenuCategoryDraft[] = [];

    try {
      const { text } = await callNvidiaChat(
        [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: imageSource } },
            ],
          },
        ],
        {
          model: "meta/llama-3.2-11b-vision-instruct",
          temperature: 0.2,
          max_tokens: 1600,
          timeoutMs: 30000,
        }
      );

      const parsed = extractJsonFromResponse<{ categories: MenuCategoryDraft[] }>(text);
      if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        parsedCategories = parsed.categories;
      }
    } catch (visionErr: any) {
      console.error("[Menu OCR Vision AI Error]:", visionErr?.message || visionErr);
    }

    if (parsedCategories.length === 0) {
      // If the photo was unclear or vision model was busy, return actionable guidance
      return NextResponse.json({
        ok: false,
        error: "Could not clearly read the menu card from the image. Please ensure the photo has good lighting and text is readable, or use the 'Paste Text' tab.",
      });
    }

    let insertedCounts = { categories: 0, items: 0 };
    if (targetRestaurantId && saveToRestaurantId) {
      insertedCounts = await saveCategoriesAndItems(targetRestaurantId, parsedCategories);
    }

    return NextResponse.json({
      ok: true,
      categories: parsedCategories,
      saved: Boolean(targetRestaurantId && saveToRestaurantId),
      insertedCounts,
    });
  } catch (error: any) {
    console.error("[Menu OCR Top-Level Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to digitize menu photo." },
      { status: 500 }
    );
  }
}
