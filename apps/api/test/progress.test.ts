import { describe, expect, it } from "bun:test";
import { getWeekBounds } from "../src/services/progress";

// The test script pins TZ=UTC so these expectations are deterministic.
describe("getWeekBounds", () => {
  it("starts a mid-week date on the preceding Monday", () => {
    const { start, end } = getWeekBounds(new Date("2026-11-04T12:34:56Z"));
    expect(start.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });

  it("keeps a Monday on the same day", () => {
    const { start, end } = getWeekBounds(new Date("2026-11-02T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });

  it("maps Sunday back to the Monday that started that week", () => {
    const { start } = getWeekBounds(new Date("2026-11-08T23:59:59Z"));
    expect(start.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("covers exactly seven days", () => {
    const { start, end } = getWeekBounds(new Date("2026-11-04T00:00:00Z"));
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
