// Built-in per-100 g values for Kazakh, Central Asian and Russian dishes that
// open food databases don't cover. Typical home-style recipes, averaged from
// Russian and Kazakh nutrition reference tables: a better starting point than
// a guess, not lab values.

const d = (id, names, kcal, p, c, f) => ({ id, names, per100: { kcal, p, c, f } });

export const DISHES = [
  d("kz:plov", ["плов", "палау", "palau", "plov", "pilaf", "pilau", "osh"], 210, 7, 25, 9),
  d("kz:beshbarmak", ["бешбармак", "бесбармақ", "бесбармак", "мясо по-казахски", "beshbarmak", "besbarmak"], 215, 13, 16, 11),
  d("kz:manty", ["манты", "манти", "мәнті", "manty", "manti"], 210, 10, 20, 10),
  d("kz:baursak", ["баурсак", "баурсаки", "бауырсак", "бауырсақ", "baursak", "bauyrsak", "boorsok"], 380, 8, 47, 18),
  d("kz:lagman", ["лагман", "лағман", "lagman", "laghman"], 140, 6, 18, 5),
  d("kz:samsa", ["самса", "сомса", "тандыр самса", "samsa", "somsa"], 330, 10, 32, 18),
  d("kz:kazy", ["казы", "қазы", "kazy", "qazy", "kazi"], 400, 16, 0, 37),
  d("kz:shuzhuk", ["шужук", "шұжық", "shuzhuk", "shuzhyk", "chuchuk"], 420, 17, 0, 39),
  d("kz:kuyrdak", ["куырдак", "қуырдақ", "kuyrdak", "kuurdak"], 230, 15, 3, 18),
  d("kz:sorpa", ["сорпа", "шорпа", "сурпа", "sorpa", "shorpa", "shurpa"], 60, 4, 4, 3),
  d("kz:chakchak", ["чак-чак", "чакчак", "шак-шак", "шәкшәк", "chak-chak", "chakchak"], 430, 7, 60, 18),
  d("kz:kurt", ["курт", "құрт", "kurt", "qurt"], 360, 32, 8, 22),
  d("kz:kumys", ["кумыс", "қымыз", "kumys", "kumis", "koumiss", "qymyz"], 50, 2, 5, 1.5),
  d("kz:shubat", ["шубат", "шұбат", "shubat"], 70, 3.5, 4, 4.5),
  d("kz:ayran", ["айран", "ayran", "airan"], 40, 2.8, 3.6, 1.5),
  d("kz:chebureki", ["чебурек", "чебуреки", "шебурек", "cheburek", "chebureki"], 290, 9, 26, 17),
  d("kz:kespe", ["кеспе", "kespe"], 90, 5, 11, 3),
  d("kz:nauryz_kozhe", ["наурыз коже", "наурыз көже", "көже", "nauryz kozhe"], 60, 2, 10, 1.5),
  d("kz:khanum", ["ханум", "khanum", "hanum"], 200, 8, 22, 9),
  d("kz:shashlyk", ["шашлык", "кәуап", "shashlik", "shashlyk"], 260, 17, 1, 21),
  d("kz:tandyr_nan", ["лепешка", "лепёшка", "нан", "таба нан", "тандыр нан", "nan bread", "tandyr nan"], 270, 8, 52, 3),
  d("kz:zhent", ["жент", "zhent"], 400, 7, 55, 17),
  d("kz:talkan", ["талкан", "талқан", "talkan"], 380, 12, 70, 6),
  d("ru:pelmeni", ["пельмени", "pelmeni"], 250, 12, 25, 12),
  d("ru:borsch", ["борщ", "borscht", "borsch", "borshch"], 50, 2, 5, 2.5),
  d("ru:grechka", ["гречка", "гречка отварная", "гречневая каша", "grechka", "buckwheat"], 110, 4, 21, 1),
  d("ru:syrniki", ["сырники", "syrniki"], 220, 15, 18, 10),
  d("ru:oladyi", ["оладьи", "oladyi"], 230, 6, 32, 9),
  d("ru:blini", ["блины", "блин", "блинчики", "blini", "bliny"], 230, 6, 28, 10),
  d("ru:olivier", ["оливье", "салат оливье", "olivier"], 190, 5, 9, 15),
];

export function normalize(text) {
  return String(text)
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function dishById(id) {
  const key = String(id || "").trim().toLowerCase();
  return DISHES.find((x) => x.id === key) || null;
}

/** The dish whose name appears in `text` as whole words, longest name first. */
export function matchDish(text) {
  const hay = " " + normalize(text) + " ";
  let best = null;
  for (const dish of DISHES) {
    for (const name of dish.names) {
      const needle = normalize(name);
      if (needle.length < 2 || !hay.includes(" " + needle + " ")) continue;
      if (!best || needle.length > best.len) best = { dish, len: needle.length };
    }
  }
  return best ? best.dish : null;
}

/** "kz:plov (plov), ..." for the prompt. */
export function promptList() {
  return DISHES.map((x) => {
    const latin = [...x.names].reverse().find((n) => /^[\x00-\x7f]+$/.test(n)) || x.names[0];
    return `${x.id} (${latin})`;
  }).join(", ");
}
