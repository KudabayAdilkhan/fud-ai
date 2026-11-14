import test from "node:test";
import assert from "node:assert/strict";
import { matchDish, dishById, DISHES, promptList } from "../src/catalog.js";
import { parseAI, ground, totals, parseUSDA, buildPrompt } from "../src/nutrition.js";

test("catalog matches RU/KZ/Latin names as whole words", () => {
  assert.equal(matchDish("Плов с бараниной").id, "kz:plov");
  assert.equal(matchDish("бауырсақ").id, "kz:baursak");
  assert.equal(matchDish("Тандыр самса").id, "kz:samsa");
  assert.equal(matchDish("Пельмёни").id, "ru:pelmeni");
  assert.equal(matchDish("Caesar salad"), null);
  assert.equal(matchDish("Мантыжаровые"), null);
  assert.equal(new Set(DISHES.map((d) => d.id)).size, DISHES.length);
  assert.equal(dishById(" KZ:PLOV ").id, "kz:plov");
  assert.match(promptList(), /kz:plov \(osh\)|kz:plov \(pilau\)/);
});

test("parseAI reads fenced JSON and clamps junk", () => {
  const r = parseAI('```json\n{"is_food":true,"items":[{"name":"Плов","lookup":"kz:plov","grams":"300","kcal":900,"protein":20,"carbs":100,"fat":-5}]}\n```');
  assert.equal(r.isFood, true);
  assert.equal(r.items[0].grams, 300);
  assert.equal(r.items[0].fat, 0);
  assert.equal(parseAI('{"is_food":false,"items":[]}').isFood, false);
});

test("ground uses catalog values with AI grams; keeps label numbers", async () => {
  const items = await ground([
    { name: "Плов", lookup: "kz:plov", grams: 300, kcal: 900, protein: 20, carbs: 100, fat: 40 },
    { name: "Сникерс", lookup: "", grams: 50, kcal: 245, protein: 4.3, carbs: 30, fat: 12 },
  ], null);
  assert.deepEqual([items[0].kcal, items[0].protein, items[0].carbs, items[0].fat, items[0].source], [630, 21, 75, 27, "catalog"]);
  assert.equal(items[1].kcal, 245);
  assert.equal(totals(items).kcal, 875);
});

test("ground rejects a far-off USDA match", async () => {
  const usda = async () => ({ kcal: 900, p: 0, c: 0, f: 100 });
  const [it] = await ground([{ name: "Яблоко", lookup: "apple raw", grams: 150, kcal: 78, protein: 0.4, carbs: 21, fat: 0.3 }], usda);
  assert.equal(it.source, "ai");
  const ok = async () => ({ kcal: 52, p: 0.3, c: 14, f: 0.2 });
  const [it2] = await ground([{ name: "Яблоко", lookup: "apple raw", grams: 150, kcal: 90, protein: 0.4, carbs: 21, fat: 0.3 }], ok);
  assert.equal(it2.kcal, 78);
  assert.equal(it2.source, "usda");
});

test("parseUSDA picks first food with energy and macros", () => {
  const r = parseUSDA({ foods: [
    { foodNutrients: [{ nutrientId: 1003, value: 1 }] },
    { foodNutrients: [{ nutrientId: 1008, value: 130 }, { nutrientId: 1003, value: 2.7 }, { nutrientId: 1004, value: 0.3 }, { nutrientId: 1005, value: 28.2 }] },
  ] });
  assert.deepEqual(r, { kcal: 130, p: 2.7, c: 28.2, f: 0.3 });
});

test("prompt mentions the dish list", () => {
  assert.match(buildPrompt("плов", false), /kz:beshbarmak/);
});
