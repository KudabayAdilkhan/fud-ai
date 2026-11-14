import { dishById, matchDish, promptList } from "./catalog.js";

export function buildPrompt(userText, hasPhoto) {
  return `You are a nutrition assistant for a user in Kazakhstan. ${
    hasPhoto
      ? "Identify every food and drink in the photo and estimate the weight in grams of the portion shown."
      : "Parse the meal description: every food and drink, with its weight in grams (use stated amounts; otherwise estimate a typical portion)."
  }
${userText ? `User's note: """${userText}"""` : ""}

Respond ONLY with JSON:
{"is_food":true,"items":[{"name":"...","lookup":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}]}

Rules:
- "name" in Russian, short (e.g. "Плов", "Чай с сахаром").
- grams = weight of the portion eaten; kcal/protein/carbs/fat = your estimate for THAT portion (grams of macros, kcal integer).
- "lookup": for a traditional Kazakh, Central Asian or Russian dish use exactly one id from this list and keep the dish as ONE item (do not split it into components): ${promptList()}.
  Otherwise use a short generic English USDA-style name ("rice white cooked", "chicken breast roasted", "apple raw"), or "" for branded/packaged products and when the numbers were read from a label.
- If a nutrition label is visible, use its numbers and set lookup to "".
- If there is no food at all, return {"is_food":false,"items":[]}.
- At most 15 items.`;
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function parseAI(text) {
  let s = String(text || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1];
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON in model reply");
  const json = JSON.parse(s.slice(start, end + 1));
  const items = (Array.isArray(json.items) ? json.items : [])
    .slice(0, 15)
    .map((it) => ({
      name: String(it.name || "").trim() || "Блюдо",
      lookup: typeof it.lookup === "string" ? it.lookup.trim() : "",
      grams: num(it.grams),
      kcal: Math.round(num(it.kcal)),
      protein: num(it.protein),
      carbs: num(it.carbs),
      fat: num(it.fat),
      source: "ai",
    }));
  return { isFood: json.is_food !== false && items.length > 0, items };
}

const r1 = (x) => Math.round(x * 10) / 10;

/**
 * Replace the AI's calorie guess with reference values: built-in catalog first,
 * then USDA (optional). Grams stay the AI's estimate.
 * `usda(query)` resolves to {kcal,p,c,f} per 100 g or null.
 */
export async function ground(items, usda) {
  const out = [];
  for (const it of items) {
    let ref = null;
    let source = "ai";
    if (it.lookup) {
      const dish = dishById(it.lookup) || matchDish(it.lookup) || matchDish(it.name);
      if (dish) {
        ref = dish.per100;
        source = "catalog";
      } else if (usda) {
        const u = await usda(it.lookup);
        // A USDA hit 3x away from the AI guess is likelier the wrong food.
        if (u && it.grams > 0) {
          const ratio = it.kcal > 0 ? (u.kcal * it.grams) / 100 / it.kcal : 1;
          if (ratio <= 3 && ratio >= 1 / 3) {
            ref = u;
            source = "usda";
          }
        }
      }
    }
    if (ref && it.grams > 0) {
      const k = it.grams / 100;
      out.push({ ...it, kcal: Math.round(ref.kcal * k), protein: r1(ref.p * k), carbs: r1(ref.c * k), fat: r1(ref.f * k), source });
    } else {
      out.push({ ...it, protein: r1(it.protein), carbs: r1(it.carbs), fat: r1(it.fat), source: "ai" });
    }
  }
  return out;
}

export function totals(items) {
  return items.reduce(
    (t, it) => ({ kcal: t.kcal + it.kcal, protein: r1(t.protein + it.protein), carbs: r1(t.carbs + it.carbs), fat: r1(t.fat + it.fat) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/** Per-100 g macros from a FoodData Central search response, or null. */
export function parseUSDA(json) {
  for (const food of json?.foods || []) {
    const ns = food.foodNutrients || [];
    const v = (...ids) => {
      for (const id of ids) {
        const n = ns.find((x) => x.nutrientId === id);
        if (n && Number.isFinite(n.value)) return n.value;
      }
      return null;
    };
    const kcal = v(1008, 2047, 2048);
    const p = v(1003), f = v(1004), c = v(1005);
    if (kcal > 0 && p != null && f != null && c != null) return { kcal, p, c, f };
  }
  return null;
}
