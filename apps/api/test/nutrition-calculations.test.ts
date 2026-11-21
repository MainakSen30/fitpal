import { describe, expect, it } from "bun:test";
import {
  buildNutritionSnapshot,
  calculateConsumedNutrition,
  per100gFromSnapshot,
  roundDecimal,
  serializeTotals,
  sumNutritionSnapshots,
} from "../src/services/nutrition-calculations";

describe("calculateConsumedNutrition", () => {
  it("uses decimal arithmetic for per-100g quantities", () => {
    expect(calculateConsumedNutrition("89", "150")).toBe("133.500");
    expect(calculateConsumedNutrition(18.3, 150)).toBe("27.450");
    expect(calculateConsumedNutrition("0.4", 200)).toBe("0.800");
  });

  it("keeps null nutrition values null", () => {
    expect(calculateConsumedNutrition(null, 150)).toBeNull();
    expect(calculateConsumedNutrition(undefined, 150)).toBeNull();
  });

  it("rounds halves away from zero once, at the requested scale", () => {
    expect(roundDecimal("1.2345")).toBe("1.235");
    expect(calculateConsumedNutrition("1.001", "50")).toBe("0.501");
  });

  it("rejects non-positive quantities", () => {
    expect(() => calculateConsumedNutrition("100", 0)).toThrow("Quantity must be positive");
  });
});

describe("snapshots", () => {
  it("preserves missing values while snapshotting a food", () => {
    const snapshot = buildNutritionSnapshot(
      {
        caloriesPer100g: 116,
        proteinPer100g: null,
        carbohydratesPer100g: 20,
        fatPer100g: 0.4,
      },
      200,
    );
    expect(snapshot).toEqual({
      caloriesSnapshot: "232.000",
      proteinSnapshot: null,
      carbohydratesSnapshot: "40.000",
      fatSnapshot: "0.800",
    });
  });

  it("derives per-100g values from an existing snapshot for explicit quantity edits", () => {
    expect(per100gFromSnapshot("133.500", "150")).toBe("89.000");
    expect(per100gFromSnapshot(null, "150")).toBeNull();
  });

  it("sums only present values and keeps an all-missing field null", () => {
    const totals = sumNutritionSnapshots([
      { caloriesSnapshot: "100.500", proteinSnapshot: null, carbohydratesSnapshot: "10.000", fatSnapshot: "2.000" },
      { caloriesSnapshot: "200.250", proteinSnapshot: null, carbohydratesSnapshot: null, fatSnapshot: "1.500" },
    ]);
    expect(serializeTotals(totals)).toEqual({
      calories: "300.750",
      protein: null,
      carbohydrates: "10.000",
      fat: "3.500",
    });
  });
});
