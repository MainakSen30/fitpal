import { z } from "zod";

const DATE_ONLY_PATTERN = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-([0-9]{4})$/;
const ISO_DATE_PATTERN = /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function dateParts(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1 || day > daysInMonth(year, month)) return null;
  return { day, month, year };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Canonical API/client date-only value, always `DD-MM-YYYY`. */
export type DateOnly = string;

export function isValidDateOnly(value: unknown): value is DateOnly {
  return typeof value === "string" && dateParts(value) !== null;
}

/** API/client representation -> ISO date used by PostgreSQL and Drizzle. */
export function dateOnlyToIso(value: string) {
  const parts = dateParts(value);
  if (!parts) throw new Error("Invalid date-only value");
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** ISO/DB date (or UTC date) -> canonical API/client representation. */
export function isoToDateOnly(value: string | Date) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid date-only value");
    const year = value.getUTCFullYear();
    if (year < 1 || year > 9999) throw new Error("Invalid date-only value");
    return `${pad(value.getUTCDate())}-${pad(value.getUTCMonth() + 1)}-${String(year).padStart(4, "0")}`;
  }
  const iso = ISO_DATE_PATTERN.exec(value);
  if (!iso || Number(iso[1]) < 1) throw new Error("Invalid ISO date value");
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

export function compareDateOnly(left: string, right: string) {
  const a = dateOnlyToIso(left);
  const b = dateOnlyToIso(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Client/API boundary: accepts and returns canonical `DD-MM-YYYY`. */
export const dateOnlySchema = z.string().refine(isValidDateOnly, { message: "Invalid date" });

/** Database boundary: converts validated canonical input to an ISO date. */
export const dbDateOnlySchema = dateOnlySchema.transform(dateOnlyToIso);
