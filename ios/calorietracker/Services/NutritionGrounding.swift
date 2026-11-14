import Foundation

/// Calories and macros per 100 g of a food.
nonisolated struct NutritionPer100g: Equatable, Sendable {
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
}

/// Built-in reference values for Kazakh and Central Asian dishes (and a few
/// everyday staples) that the open food databases don't cover.
///
/// Values are typical home-style recipes per 100 g, averaged from Russian and
/// Kazakh nutrition reference tables. Real dishes vary with the cut of meat and
/// the amount of fat, so treat them as a better starting point than a guess,
/// not as lab values.
nonisolated enum LocalDishCatalog {
    struct Dish: Sendable {
        /// Stable id the AI returns in `lookup`, e.g. "kz:plov".
        let id: String
        /// Names in Russian, Kazakh, English and Latin transliteration, lowercased.
        let names: [String]
        let per100g: NutritionPer100g
    }

    static let dishes: [Dish] = [
        dish("kz:plov", ["плов", "палау", "palau", "plov", "pilaf", "pilau", "osh"], 210, 7, 25, 9),
        dish("kz:beshbarmak", ["бешбармак", "бесбармақ", "бесбармак", "мясо по-казахски", "beshbarmak", "besbarmak"], 215, 13, 16, 11),
        dish("kz:manty", ["манты", "манти", "мәнті", "manty", "manti"], 210, 10, 20, 10),
        dish("kz:baursak", ["баурсак", "баурсаки", "бауырсак", "бауырсақ", "baursak", "bauyrsak", "boorsok"], 380, 8, 47, 18),
        dish("kz:lagman", ["лагман", "лағман", "lagman", "laghman"], 140, 6, 18, 5),
        dish("kz:samsa", ["самса", "сомса", "тандыр самса", "samsa", "somsa"], 330, 10, 32, 18),
        dish("kz:kazy", ["казы", "қазы", "kazy", "qazy", "kazi"], 400, 16, 0, 37),
        dish("kz:shuzhuk", ["шужук", "шұжық", "shuzhuk", "shuzhyk", "chuchuk"], 420, 17, 0, 39),
        dish("kz:kuyrdak", ["куырдак", "қуырдақ", "kuyrdak", "kuurdak"], 230, 15, 3, 18),
        dish("kz:sorpa", ["сорпа", "шорпа", "сурпа", "sorpa", "shorpa", "shurpa"], 60, 4, 4, 3),
        dish("kz:chakchak", ["чак-чак", "чакчак", "шак-шак", "шәкшәк", "chak-chak", "chakchak"], 430, 7, 60, 18),
        dish("kz:kurt", ["курт", "құрт", "kurt", "qurt"], 360, 32, 8, 22),
        dish("kz:kumys", ["кумыс", "қымыз", "kumys", "kumis", "koumiss", "qymyz"], 50, 2, 5, 1.5),
        dish("kz:shubat", ["шубат", "шұбат", "shubat"], 70, 3.5, 4, 4.5),
        dish("kz:ayran", ["айран", "ayran", "airan"], 40, 2.8, 3.6, 1.5),
        dish("kz:chebureki", ["чебурек", "чебуреки", "шебурек", "cheburek", "chebureki"], 290, 9, 26, 17),
        dish("kz:kespe", ["кеспе", "kespe"], 90, 5, 11, 3),
        dish("kz:nauryz_kozhe", ["наурыз коже", "наурыз көже", "көже", "nauryz kozhe"], 60, 2, 10, 1.5),
        dish("kz:khanum", ["ханум", "khanum", "hanum"], 200, 8, 22, 9),
        dish("kz:shashlyk", ["шашлык", "кәуап", "shashlik", "shashlyk"], 260, 17, 1, 21),
        dish("kz:tandyr_nan", ["лепешка", "лепёшка", "нан", "таба нан", "тандыр нан", "nan bread", "tandyr nan"], 270, 8, 52, 3),
        dish("kz:zhent", ["жент", "zhent"], 400, 7, 55, 17),
        dish("kz:talkan", ["талкан", "талқан", "talkan"], 380, 12, 70, 6),
        dish("ru:pelmeni", ["пельмени", "pelmeni"], 250, 12, 25, 12),
        dish("ru:borsch", ["борщ", "borscht", "borsch", "borshch"], 50, 2, 5, 2.5),
        dish("ru:grechka", ["гречка", "гречка отварная", "гречневая каша", "grechka", "buckwheat"], 110, 4, 21, 1),
        dish("ru:syrniki", ["сырники", "syrniki"], 220, 15, 18, 10),
        dish("ru:oladyi", ["оладьи", "oladyi"], 230, 6, 32, 9),
        dish("ru:blini", ["блины", "блин", "блинчики", "blini", "bliny"], 230, 6, 28, 10),
        dish("ru:olivier", ["оливье", "салат оливье", "olivier"], 190, 5, 9, 15),
    ]

    private static func dish(
        _ id: String,
        _ names: [String],
        _ calories: Double,
        _ protein: Double,
        _ carbs: Double,
        _ fat: Double
    ) -> Dish {
        Dish(id: id, names: names, per100g: NutritionPer100g(calories: calories, protein: protein, carbs: carbs, fat: fat))
    }

    /// One line per dish for the AI prompt: "kz:plov (plov)".
    static var promptList: String {
        dishes.map { dish in
            let latin = dish.names.last(where: { name in name.allSatisfy(\.isASCII) }) ?? dish.names[0]
            return "\(dish.id) (\(latin))"
        }
        .joined(separator: ", ")
    }

    static func dish(id: String) -> Dish? {
        let key = id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return dishes.first { $0.id == key }
    }

    /// The dish whose name appears in `text` as whole words, preferring the
    /// longest name so "тандыр самса" wins over "самса".
    static func match(name text: String) -> Dish? {
        let haystack = " " + normalize(text) + " "
        var best: (dish: Dish, length: Int)?
        for dish in dishes {
            for name in dish.names {
                let needle = normalize(name)
                guard needle.count >= 2, haystack.contains(" " + needle + " ") else { continue }
                if needle.count > (best?.length ?? 0) { best = (dish, needle.count) }
            }
        }
        return best?.dish
    }

    /// Lowercased, ё→е, punctuation turned into single spaces.
    static func normalize(_ text: String) -> String {
        let lowered = text.lowercased().replacingOccurrences(of: "ё", with: "е")
        let mapped = lowered.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character($0) : " " }
        return String(mapped).split(separator: " ").joined(separator: " ")
    }
}

/// Per-100 g values for generic foods ("cooked white rice", "chicken breast")
/// from USDA FoodData Central's Foundation and SR Legacy data. Uses the user's
/// own key from Settings > Product Information; without one nothing is sent.
enum USDAGenericFoodLookup {
    private static var cache: [String: NutritionPer100g?] = [:]

    static func per100g(for query: String, apiKey: String, session: URLSession = .shared) async -> NutritionPer100g? {
        let key = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty else { return nil }
        if let cached = cache[key] { return cached }

        var request = URLRequest(url: FoodDataCentralService.searchURL, timeoutInterval: FoodDataCentralService.requestTimeout)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "X-Api-Key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "query": key,
            "dataType": ["Foundation", "SR Legacy"],
            "requireAllWords": true,
            "pageSize": 5,
        ])

        guard let result = try? await session.data(for: request),
              let http = result.1 as? HTTPURLResponse
        else { return nil } // Network failure: don't cache, try again next time.
        guard (200..<300).contains(http.statusCode) else {
            // A rejected key or a rate limit isn't an answer about this food.
            return nil
        }
        let per100g = parse(result.0)
        cache[key] = per100g
        return per100g
    }

    /// The first result that has energy and all three macros. Foundation and
    /// SR Legacy nutrients are already per 100 g.
    static func parse(_ data: Data) -> NutritionPer100g? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let foods = root["foods"] as? [[String: Any]]
        else { return nil }
        for food in foods {
            let nutrients = food["foodNutrients"] as? [[String: Any]] ?? []
            func value(_ ids: [Int]) -> Double? {
                for id in ids {
                    if let match = nutrients.first(where: { ($0["nutrientId"] as? NSNumber)?.intValue == id }),
                       let number = (match["value"] as? NSNumber)?.doubleValue {
                        return number
                    }
                }
                return nil
            }
            // 1008 Energy (kcal); Foundation foods often carry only the Atwater energies.
            guard let calories = value([1008, 2047, 2048]), calories > 0,
                  let protein = value([1003]),
                  let fat = value([1004]),
                  let carbs = value([1005])
            else { continue }
            return NutritionPer100g(calories: calories, protein: protein, carbs: carbs, fat: fat)
        }
        return nil
    }
}

/// Replaces the AI's own calorie guess with reference values: the AI names each
/// food and estimates its grams, and calories/macros come from the built-in
/// dish catalog or USDA. Portion size is still the AI's estimate.
enum NutritionGrounding {
    static let enabledKey = "nutritionGroundingEnabled"

    static var isEnabled: Bool {
        UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true
    }

    /// A USDA match whose energy is this far from the AI's guess is more likely
    /// the wrong food than a better number, so the AI's value stays.
    private static let maxUSDAEnergyRatio = 3.0

    /// Extra prompt text that asks for `lookup` keys.
    static var promptInstruction: String {
        """
        Every ingredient object and the top-level object also have "lookup": a key used to look the food up in a nutrition database.
        - For a traditional Kazakh, Central Asian or Russian dish, use exactly one of these ids and keep the dish as ONE ingredient instead of splitting it into components: \(LocalDishCatalog.promptList).
        - Otherwise use a short generic English USDA-style food name for the food as eaten, e.g. "rice white cooked", "chicken breast roasted", "apple raw", "bread white".
        - Use "" when the nutrition was read from a label, menu, screenshot or app, for branded or packaged products, and for mixed foods with no clear generic name.
        """
    }

    static func ground(_ analysis: GeminiService.FoodAnalysis) async -> GeminiService.FoodAnalysis {
        guard isEnabled else { return analysis }
        let apiKey = FoodDataCentralSettings.apiKey

        if !analysis.ingredients.isEmpty {
            var updated = analysis
            var changed = false
            for index in updated.ingredients.indices {
                let ingredient = updated.ingredients[index]
                let lookup = index < analysis.ingredientLookupNames.count ? analysis.ingredientLookupNames[index] : nil
                guard ingredient.grams > 0,
                      let reference = await reference(lookup: lookup, name: ingredient.name, aiCalories: Double(ingredient.calories), grams: ingredient.grams, apiKey: apiKey)
                else { continue }
                let factor = ingredient.grams / 100
                updated.ingredients[index].calories = Int((reference.calories * factor).rounded())
                updated.ingredients[index].protein = round1(reference.protein * factor)
                updated.ingredients[index].carbs = round1(reference.carbs * factor)
                updated.ingredients[index].fat = round1(reference.fat * factor)
                changed = true
            }
            return changed ? updated.withIngredientMacroTotals() : analysis
        }

        guard analysis.servingSizeIsKnown, analysis.servingSizeGrams > 0,
              let reference = await reference(lookup: analysis.lookupName, name: analysis.name, aiCalories: Double(analysis.calories), grams: analysis.servingSizeGrams, apiKey: apiKey)
        else { return analysis }
        var updated = analysis
        let factor = analysis.servingSizeGrams / 100
        updated.calories = Int((reference.calories * factor).rounded())
        updated.protein = round1(reference.protein * factor)
        updated.carbs = round1(reference.carbs * factor)
        updated.fat = round1(reference.fat * factor)
        return updated
    }

    /// `lookup` nil means the model never gave one (e.g. Apple Intelligence),
    /// so only the dish catalog is tried by name. An empty `lookup` means the
    /// model read real numbers from a label or screenshot: keep them.
    private static func reference(
        lookup: String?,
        name: String,
        aiCalories: Double,
        grams: Double,
        apiKey: String?
    ) async -> NutritionPer100g? {
        guard let lookup else {
            return LocalDishCatalog.match(name: name)?.per100g
        }
        let trimmed = lookup.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let dish = LocalDishCatalog.dish(id: trimmed) ?? LocalDishCatalog.match(name: trimmed) ?? LocalDishCatalog.match(name: name) {
            return dish.per100g
        }
        guard let apiKey, let usda = await USDAGenericFoodLookup.per100g(for: trimmed, apiKey: apiKey) else { return nil }
        let usdaCalories = usda.calories * grams / 100
        if aiCalories > 0, usdaCalories > 0 {
            let ratio = usdaCalories / aiCalories
            guard ratio <= maxUSDAEnergyRatio, ratio >= 1 / maxUSDAEnergyRatio else { return nil }
        }
        return usda
    }

    private static func round1(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }
}
