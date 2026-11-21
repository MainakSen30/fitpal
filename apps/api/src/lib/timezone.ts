import { ApiError } from "./errors";

/** Intl is the only timezone source needed; unknown zones are a client error. */
export function assertTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new ApiError("Invalid timezone", 400);
  }
}

export function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcToDateKey(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  return utcToDateKey(dateKeyToUtc(key) + days * DAY_MS);
}

/** Monday-based week start in calendar days, independent of the host timezone. */
export function weekStart(key: string): string {
  const weekday = new Date(dateKeyToUtc(key)).getUTCDay();
  return addDays(key, weekday === 0 ? -6 : 1 - weekday);
}

export function monthRange(month: string): { start: string; endExclusive: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endYear = monthNumber === 12 ? year + 1 : year;
  const endMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    start,
    endExclusive: `${endYear}-${String(endMonth).padStart(2, "0")}-01`,
  };
}

/**
 * A deliberately wide UTC window avoids DST/offset boundary mistakes. Rows are
 * bucketed afterwards with localDateKey, so no meal is dropped at midnight.
 */
export function wideUtcWindow(startKey: string, endKeyExclusive: string) {
  return {
    from: new Date(dateKeyToUtc(startKey) - 2 * DAY_MS),
    to: new Date(dateKeyToUtc(endKeyExclusive) + 2 * DAY_MS),
  };
}
