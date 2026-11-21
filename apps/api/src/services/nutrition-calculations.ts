/**
 * All nutrition numeric values are serialized as decimal strings with a fixed
 * scale (3 for grams/kcal, 2 for money). Drizzle/postgres-js already returns
 * numeric columns as strings, so responses stay consistent end to end.
 * Arithmetic uses BigInt fixed-point math: no JS float is authoritative.
 */

export const NUTRITION_SCALE = 3;
export const MONEY_SCALE = 2;

export type DecimalString = string;

export interface NutritionPer100g {
  caloriesPer100g?: DecimalString | number | null;
  proteinPer100g?: DecimalString | number | null;
  carbohydratesPer100g?: DecimalString | number | null;
  fatPer100g?: DecimalString | number | null;
}

export interface NutritionSnapshot {
  caloriesSnapshot: DecimalString | null;
  proteinSnapshot: DecimalString | null;
  carbohydratesSnapshot: DecimalString | null;
  fatSnapshot: DecimalString | null;
}

interface Decimal {
  coefficient: bigint;
  scale: number;
}

function parseDecimal(input: DecimalString | number): Decimal {
  const text = typeof input === "number" ? String(input) : input.trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error(`Invalid decimal value: ${text}`);

  const [, sign, whole = "", fractionAfterPoint = "", fractionOnly = "", exponent = "0"] = match;
  const fraction = fractionOnly || fractionAfterPoint;
  let digits = `${whole}${fraction}`;
  let scale = fraction.length - Number.parseInt(exponent || "0", 10);

  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }
  while (scale > 0 && digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }

  const coefficient = BigInt(digits || "0");
  return { coefficient: sign === "-" ? -coefficient : coefficient, scale };
}

function rescale(value: Decimal, scale: number): bigint {
  if (value.scale === scale) return value.coefficient;
  if (value.scale < scale) {
    return value.coefficient * 10n ** BigInt(scale - value.scale);
  }

  const factor = 10n ** BigInt(value.scale - scale);
  const absolute = value.coefficient < 0n ? -value.coefficient : value.coefficient;
  // Postgres numeric rounds halves away from zero.
  const rounded = (absolute + factor / 2n) / factor;
  return value.coefficient < 0n ? -rounded : rounded;
}

function format(coefficient: bigint, scale: number): DecimalString {
  const negative = coefficient < 0n;
  const absolute = negative ? -coefficient : coefficient;
  const digits = absolute.toString().padStart(scale + 1, "0");
  const integer = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? "" : `.${digits.slice(-scale)}`;
  return `${negative ? "-" : ""}${integer}${fraction}`;
}

export function roundDecimal(input: DecimalString | number, scale = NUTRITION_SCALE): DecimalString {
  return format(rescale(parseDecimal(input), scale), scale);
}

/** consumed = per100g × quantity_grams / 100. Null stays null. */
export function calculateConsumedNutrition(
  per100g: DecimalString | number | null | undefined,
  quantityGrams: DecimalString | number,
  scale = NUTRITION_SCALE,
): DecimalString | null {
  if (per100g == null) return null;

  const value = parseDecimal(per100g);
  const quantity = parseDecimal(quantityGrams);
  if (quantity.coefficient <= 0n) throw new Error("Quantity must be positive");

  const product: Decimal = {
    coefficient: value.coefficient * quantity.coefficient,
    scale: value.scale + quantity.scale + 2,
  };
  return format(rescale(product, scale), scale);
}

/** Derive per-100g values from an existing snapshot when quantity changes. */
export function per100gFromSnapshot(
  snapshot: DecimalString | number | null | undefined,
  quantityGrams: DecimalString | number,
  scale = NUTRITION_SCALE,
): DecimalString | null {
  if (snapshot == null) return null;

  const quantity = parseDecimal(quantityGrams);
  if (quantity.coefficient <= 0n) throw new Error("Quantity must be positive");

  const value = parseDecimal(snapshot);
  // Divide at a high intermediate scale, then round once.
  const intermediateScale = scale + 6;
  const valueHigh = rescale(value, intermediateScale);
  const numerator = valueHigh * 100n * 10n ** BigInt(quantity.scale);
  const coefficient = numerator / quantity.coefficient;
  return format(rescale({ coefficient, scale: intermediateScale }, scale), scale);
}

export function buildNutritionSnapshot(
  food: NutritionPer100g,
  quantityGrams: DecimalString | number,
): NutritionSnapshot {
  return {
    caloriesSnapshot: calculateConsumedNutrition(food.caloriesPer100g, quantityGrams),
    proteinSnapshot: calculateConsumedNutrition(food.proteinPer100g, quantityGrams),
    carbohydratesSnapshot: calculateConsumedNutrition(food.carbohydratesPer100g, quantityGrams),
    fatSnapshot: calculateConsumedNutrition(food.fatPer100g, quantityGrams),
  };
}

const SNAPSHOT_KEYS = [
  "caloriesSnapshot",
  "proteinSnapshot",
  "carbohydratesSnapshot",
  "fatSnapshot",
] as const;

/** Missing values are excluded; a field with no values at all stays null. */
export function sumNutritionSnapshots(items: readonly NutritionSnapshot[]): NutritionSnapshot {
  const result: NutritionSnapshot = {
    caloriesSnapshot: null,
    proteinSnapshot: null,
    carbohydratesSnapshot: null,
    fatSnapshot: null,
  };

  for (const key of SNAPSHOT_KEYS) {
    let sum = 0n;
    let seen = false;
    for (const item of items) {
      const value = item[key];
      if (value == null) continue;
      sum += rescale(parseDecimal(value), NUTRITION_SCALE);
      seen = true;
    }
    if (seen) result[key] = format(sum, NUTRITION_SCALE);
  }

  return result;
}

export function serializeTotals(totals: NutritionSnapshot) {
  return {
    calories: totals.caloriesSnapshot,
    protein: totals.proteinSnapshot,
    carbohydrates: totals.carbohydratesSnapshot,
    fat: totals.fatSnapshot,
  };
}
