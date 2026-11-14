import Foundation
import Testing
@testable import calorietracker

@Suite(.serialized)
struct NutritionGroundingTests {
    @Test func catalogMatchesRussianKazakhAndLatinNames() {
        #expect(LocalDishCatalog.match(name: "Плов с бараниной")?.id == "kz:plov")
        #expect(LocalDishCatalog.match(name: "бауырсақ")?.id == "kz:baursak")
        #expect(LocalDishCatalog.match(name: "Beshbarmak")?.id == "kz:beshbarmak")
        #expect(LocalDishCatalog.match(name: "Тандыр самса")?.id == "kz:samsa")
        #expect(LocalDishCatalog.match(name: "Пельмёни")?.id == "ru:pelmeni")
    }

    @Test func catalogNeedsWholeWords() {
        #expect(LocalDishCatalog.match(name: "Caesar salad") == nil)
        #expect(LocalDishCatalog.match(name: "non-fat milk") == nil)
        #expect(LocalDishCatalog.match(name: "Мантыжаровые") == nil)
    }

    @Test func catalogIdsAreUnique() {
        let ids = LocalDishCatalog.dishes.map(\.id)
        #expect(Set(ids).count == ids.count)
        #expect(LocalDishCatalog.dish(id: " KZ:PLOV ")?.id == "kz:plov")
    }

    @Test func usdaParserReadsPer100gMacros() throws {
        let json = """
        {"foods":[
          {"description":"no energy","foodNutrients":[{"nutrientId":1003,"value":1}]},
          {"description":"Rice, white, cooked","foodNutrients":[
            {"nutrientId":1008,"value":130},{"nutrientId":1003,"value":2.7},
            {"nutrientId":1004,"value":0.3},{"nutrientId":1005,"value":28.2}]}
        ]}
        """
        let per100g = try #require(USDAGenericFoodLookup.parse(Data(json.utf8)))
        #expect(per100g == NutritionPer100g(calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3))
    }

    @Test func groundingReplacesLocalDishCaloriesUsingAIGrams() async {
        let defaults = UserDefaults.standard
        let previous = defaults.object(forKey: NutritionGrounding.enabledKey)
        defer { defaults.set(previous, forKey: NutritionGrounding.enabledKey) }
        defaults.set(true, forKey: NutritionGrounding.enabledKey)

        var analysis = GeminiService.FoodAnalysis(
            name: "Плов", calories: 900, protein: 20, carbs: 100, fat: 40, servingSizeGrams: 300
        )
        analysis.lookupName = "kz:plov"
        let grounded = await NutritionGrounding.ground(analysis)
        #expect(grounded.calories == 630)
        #expect(grounded.protein == 21)
        #expect(grounded.carbs == 75)
        #expect(grounded.fat == 27)
    }

    @Test func emptyLookupKeepsLabelNumbers() async {
        var analysis = GeminiService.FoodAnalysis(
            name: "Плов (упаковка)", calories: 512, protein: 10, carbs: 60, fat: 25, servingSizeGrams: 250
        )
        analysis.lookupName = ""
        let grounded = await NutritionGrounding.ground(analysis)
        #expect(grounded.calories == 512)
    }

    @Test func parserKeepsIngredientLookups() throws {
        let text = """
        {"name":"Обед","calories":700,"protein":30,"carbs":80,"fat":25,"serving_size_grams":450,"lookup":"",
         "ingredients":[
          {"name":"Бешбармак","lookup":"kz:beshbarmak","grams":300,"calories":600,"protein":28,"carbs":50,"fat":30},
          {"name":"Айран","lookup":"kz:ayran","grams":150,"calories":60,"protein":4,"carbs":5,"fat":2}],
         "unit_options":[]}
        """
        let analysis = try GeminiService.parseFoodAnalysis(from: text)
        #expect(analysis.ingredientLookupNames == ["kz:beshbarmak", "kz:ayran"])
        #expect(analysis.lookupName == "")
    }
}
