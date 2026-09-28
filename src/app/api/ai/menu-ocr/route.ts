import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChat, extractJsonFromResponse } from "@/lib/ai/nvidia";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageUrl, saveToRestaurantId } = await req.json();

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ ok: false, error: "Image data (base64 or URL) is required" }, { status: 400 });
    }

    const imageSource = imageUrl || (imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`);

    const promptText = `Analyze this restaurant menu photo and extract all food/beverage items into structured categories.
For each dish extract:
- name: Dish name
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
        max_tokens: 1500,
        timeoutMs: 30000,
      }
    );

    const parsed = extractJsonFromResponse<{ categories: Array<{ name: string; items: any[] }> }>(text);

    if (!parsed || !Array.isArray(parsed.categories)) {
      return NextResponse.json({
        ok: false,
        error: "Could not parse menu card. Please ensure the photo is clear and well-lit.",
        rawText: text.slice(0, 300),
      });
    }

    // If client requested to directly commit to database
    let insertedCounts = { categories: 0, items: 0 };
    if (saveToRestaurantId) {
      const supabase = createAdminClient();

      for (const cat of parsed.categories) {
        if (!cat.name || !Array.isArray(cat.items)) continue;

        // Upsert category
        const { data: catRecord } = await supabase
          .from("menu_categories")
          .upsert({
            restaurant_id: saveToRestaurantId,
            name: cat.name,
          }, { onConflict: "restaurant_id,name" })
          .select("id")
          .single();

        const catId = catRecord?.id;
        insertedCounts.categories++;

        // Insert items
        for (const it of cat.items) {
          if (!it.name) continue;
          await supabase.from("menu_items").insert({
            restaurant_id: saveToRestaurantId,
            category_id: catId || null,
            name: it.name,
            price: Number(it.price) || 99,
            is_veg: Boolean(it.is_veg),
            description: it.description || null,
            is_available: true,
          });
          insertedCounts.items++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      categories: parsed.categories,
      saved: Boolean(saveToRestaurantId),
      insertedCounts,
    });
  } catch (error: any) {
    console.error("[Menu OCR Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to digitize menu photo" },
      { status: 500 }
    );
  }
}
