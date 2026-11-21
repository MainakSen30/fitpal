import { describe, expect, it } from "bun:test";
import {
  compareDateOnly,
  dateOnlySchema,
  dateOnlyToIso,
  dbDateOnlySchema,
  isoToDateOnly,
  isValidDateOnly,
} from "@fitpal/shared";

describe("DD-MM-YYYY date-only utility", () => {
  it("accepts valid dates", () => {
    for (const value of ["01-01-2026", "28-02-2026", "29-02-2024", "30-04-2026", "31-12-2026"]) {
      expect(isValidDateOnly(value)).toBe(true);
      expect(dateOnlySchema.parse(value)).toBe(value);
      expect(dbDateOnlySchema.parse(value)).toBe(dateOnlyToIso(value));
    }
  });

  it("rejects impossible calendar dates", () => {
    for (const value of ["29-02-2026", "31-02-2026", "31-04-2026", "32-01-2026", "00-01-2026", "01-00-2026", "01-13-2026", "01-01-0000"]) {
      expect(isValidDateOnly(value)).toBe(false);
      expect(dateOnlySchema.safeParse(value).success).toBe(false);
      expect(dbDateOnlySchema.safeParse(value).success).toBe(false);
    }
  });

  it("enforces strict two-digit and four-digit components", () => {
    for (const value of ["1-01-2026", "01-1-2026", "01-01-26", "2026-01-01", "", " 01-01-2026", "01-01-2026 ", "01/01/2026", "01-01-2026T00:00:00Z"]) {
      expect(isValidDateOnly(value)).toBe(false);
      expect(dateOnlySchema.safeParse(value).success).toBe(false);
      expect(dbDateOnlySchema.safeParse(value).success).toBe(false);
    }
  });

  it("applies leap-year rules", () => {
    expect(isValidDateOnly("29-02-2024")).toBe(true);
    expect(isValidDateOnly("29-02-2000")).toBe(true);
    expect(isValidDateOnly("29-02-1900")).toBe(false);
    expect(isValidDateOnly("29-02-2026")).toBe(false);
  });

  it("round-trips through the ISO database representation", () => {
    const values = ["01-01-2026", "29-02-2024", "31-12-2026"];
    for (const value of values) {
      const iso = dateOnlyToIso(value);
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isoToDateOnly(iso)).toBe(value);
    }
  });

  it("converts UTC dates without timezone drift", () => {
    expect(isoToDateOnly(new Date("2024-02-29T23:59:59.000Z"))).toBe("29-02-2024");
    expect(isoToDateOnly("2026-11-21")).toBe("21-11-2026");
  });

  it("compares chronologically after parsing", () => {
    expect(compareDateOnly("01-01-2026", "21-11-2026")).toBe(-1);
    expect(compareDateOnly("21-11-2026", "21-11-2026")).toBe(0);
    expect(compareDateOnly("31-12-2026", "01-01-2027")).toBe(-1);
    expect(compareDateOnly("29-02-2024", "01-03-2024")).toBe(-1);
  });

  it("throws instead of normalizing invalid values", () => {
    expect(() => dateOnlyToIso("31-04-2026")).toThrow();
    expect(() => isoToDateOnly("not-a-date")).toThrow();
  });
});
