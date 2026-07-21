/**
 * lib/graph-recurrence.ts — pure helpers for building Microsoft Graph recurrence
 * patterns. Extracted from graph.ts so the weekday math (the source of the 2026-06
 * "every recurring series one day late" incident) is unit-testable without the Graph
 * SDK. See lib/graph-recurrence.test.ts.
 */
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/booking-config";
import { addSaDays } from "@/lib/dates";

/** Graph `daysOfWeek` names, indexed JS-getDay() style: 0 = Sunday … 6 = Saturday. */
export const GRAPH_DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Graph relativeMonthly `index` names, by week-of-month 0–4. */
export const GRAPH_WEEK_INDEX = ["first", "second", "third", "fourth", "last"] as const;

/**
 * The Graph recurrence weekday name for a start instant, computed in SAST.
 *
 * The token MUST be `"i"` — the ISO day of week (1 = Monday … 7 = Sunday). The locale
 * token `"e"` counts 1 = Sunday under the en-US default, which shifted every recurring
 * series one weekday LATE (a Tuesday booking produced a Wednesday Teams event) — the
 * bug behind the 2026-06/07 mass-deletion incident. The `7 → 0` remap below only makes
 * sense for ISO numbering, which is the tell that `"i"` was always intended.
 */
export function graphDayOfWeek(start: Date): string {
  const isoDay = parseInt(formatInTimeZone(start, TIMEZONE, "i"), 10); // 1=Mon … 7=Sun
  const jsDay = isoDay === 7 ? 0 : isoDay; // → 0=Sun … 6=Sat (GRAPH_DAY_NAMES index)
  return GRAPH_DAY_NAMES[jsDay];
}

/**
 * The dates a weekly (interval 1) or bimonthly (interval 2) Graph recurrence will
 * materialise, given a range whose `startDate` already falls on the target weekday.
 * Occurrences land every `interval` weeks from the start, through `endDate` inclusive.
 *
 * This exists for PRUNING. A rebuilt series spans a contiguous range, but the bookings
 * inside it are rarely contiguous — a public holiday or a cancelled session leaves a
 * hole. Every generated date with no booking behind it becomes an instant ghost, so the
 * rebuild has to remove them. (Chanene's real series: 43 bookings across 50 weekly
 * slots — 7 holes.)
 */
export function weeklyOccurrenceDates(
  startDate: string,
  endDate: string,
  interval: number,
): string[] {
  const step = 7 * Math.max(1, interval);
  const out: string[] = [];
  let date = startDate;
  while (date <= endDate) {
    out.push(date);
    date = addSaDays(date, step);
  }
  return out;
}
