export function triggerHaptic(ms = 12) {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/aa/g, "a")
    .replace(/ck/g, "k")
    .replace(/y$/g, "i")
    .replace(/ph/g, "f");
}

export function matchesSearch(query: string, itemName: string, itemDesc: string | null): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const name = itemName.toLowerCase();
  const desc = (itemDesc || "").toLowerCase();

  // Direct match
  if (name.includes(q) || desc.includes(q)) return true;

  // Normalized phonetic match (e.g. "chiken" -> "chicken", "briyani" -> "biryani", "panir" -> "paneer")
  const normQ = normalizeText(q);
  const normName = normalizeText(name);
  if (normName.includes(normQ)) return true;

  const tokens = q.split(/\s+/);
  return tokens.every((tok) => name.includes(tok) || normalizeText(name).includes(normalizeText(tok)));
}

export function getFoodEmoji(name: string, isVeg: boolean): string {
  const n = name.toLowerCase();
  if (n.includes("biryani") || n.includes("rice") || n.includes("pulao") || n.includes("jeera")) return "🍚";
  if (n.includes("paneer") || n.includes("curry") || n.includes("dal") || n.includes("gravy") || n.includes("masala") || n.includes("kofta")) return "🍲";
  if (n.includes("roti") || n.includes("naan") || n.includes("bread") || n.includes("paratha") || n.includes("kulcha")) return "🫓";
  if (n.includes("tikka") || n.includes("kebab") || n.includes("tandoor") || n.includes("crispy") || n.includes("fry")) return "🍢";
  if (n.includes("chicken") || n.includes("mutton") || n.includes("fish") || n.includes("egg") || n.includes("prawn")) return "🍗";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("burger") || n.includes("sandwich")) return "🍔";
  if (n.includes("noodle") || n.includes("chowmein") || n.includes("pasta") || n.includes("manchurian")) return "🍜";
  if (n.includes("chai") || n.includes("tea") || n.includes("coffee") || n.includes("latte") || n.includes("cappuccino")) return "☕";
  if (n.includes("shake") || n.includes("smoothie") || n.includes("juice") || n.includes("soda") || n.includes("mojito") || n.includes("lassi") || n.includes("drink")) return "🥤";
  if (n.includes("ice cream") || n.includes("gulab") || n.includes("halwa") || n.includes("kheer") || n.includes("cake") || n.includes("brownie") || n.includes("dessert")) return "🍨";
  if (n.includes("soup") || n.includes("shorba")) return "🥣";
  if (n.includes("salad") || n.includes("raita") || n.includes("papad")) return "🥗";
  if (n.includes("roll") || n.includes("wrap") || n.includes("frankie")) return "🌯";
  if (n.includes("dosa") || n.includes("idli") || n.includes("vada") || n.includes("sambar")) return "🥞";
  if (n.includes("samosa") || n.includes("pakoda") || n.includes("chaat") || n.includes("snack")) return "🥟";
  return isVeg ? "🥗" : "🍖";
}

export function getCategoryIcon(catName: string): string {
  const c = catName.toLowerCase();
  if (c.includes("starter") || c.includes("appetizer") || c.includes("snack")) return "🥟";
  if (c.includes("main") || c.includes("curry") || c.includes("gravy")) return "🍛";
  if (c.includes("bread") || c.includes("roti") || c.includes("naan")) return "🫓";
  if (c.includes("rice") || c.includes("biryani")) return "🍚";
  if (c.includes("drink") || c.includes("beverage") || c.includes("juice") || c.includes("mocktail")) return "🥤";
  if (c.includes("dessert") || c.includes("sweet") || c.includes("ice")) return "🍨";
  if (c.includes("soup") || c.includes("salad")) return "🥗";
  if (c.includes("tandoor") || c.includes("kebab") || c.includes("grill")) return "🍢";
  return "🍽️";
}

export function getSpiciness(name: string, desc: string | null): "mild" | "medium" | "spicy" {
  const text = `${name} ${desc || ""}`.toLowerCase();
  if (
    text.includes("extra spicy") ||
    text.includes("schezwan") ||
    text.includes("peri peri") ||
    text.includes("kolhapuri") ||
    text.includes("vindaloo") ||
    text.includes("mirch") ||
    text.includes("angara") ||
    text.includes("chilli") ||
    text.includes("hot garlic") ||
    text.includes("spicy") ||
    text.includes("tikka")
  ) {
    return "spicy";
  }
  if (
    text.includes("korma") ||
    text.includes("malai") ||
    text.includes("butter") ||
    text.includes("sweet") ||
    text.includes("shahi") ||
    text.includes("sweet corn") ||
    text.includes("curd") ||
    text.includes("custard") ||
    text.includes("ice cream") ||
    text.includes("shake") ||
    text.includes("halwa") ||
    text.includes("kheer") ||
    text.includes("lassi")
  ) {
    return "mild";
  }
  return "medium";
}
