import { addWeeks, addMonths } from "date-fns";
import { isSAPublicHolidayOn } from "@/lib/sa-holidays";
import { calendarDate } from "@/lib/dates";

export type RecurringPattern = "weekly" | "bimonthly" | "monthly";

export const RECURRING_PATTERNS: { value: RecurringPattern; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "bimonthly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

/**
 * Find the nth occurrence of a given weekday in a month.
 * e.g. getNthWeekdayOfMonth(2026, 3, 4, 3) → 3rd Thursday of April 2026
 * @param year  Full year
 * @param month 0-based month (0=Jan)
 * @param dow   Day of week (0=Sun, 4=Thu)
 * @param n     Which occurrence (1=first, 2=second, etc.)
 * @returns Date (UTC) or null if the nth occurrence doesn't exist in that month
 */
function getNthWeekdayOfMonth(year: number, month: number, dow: number, n: number): Date | null {
  // First day of the month
  const first = new Date(Date.UTC(year, month, 1));
  const firstDow = first.getUTCDay();
  // Day number of the first occurrence of `dow`
  const firstOccurrence = 1 + ((dow - firstDow + 7) % 7);
  const day = firstOccurrence + (n - 1) * 7;
  // Check it's still in the same month
  const result = new Date(Date.UTC(year, month, day));
  if (result.getUTCMonth() !== month) return null;
  return result;
}

/**
 * Advance to the same weekday occurrence in the next month.
 * e.g. 3rd Thursday of March → 3rd Thursday of April.
 * If the nth weekday doesn't exist (rare, e.g. 5th occurrence), falls back to the last occurrence.
 */
function nextMonthSameWeekday(current: Date): Date {
  const dow = current.getUTCDay();
  const dayOfMonth = current.getUTCDate();
  const n = Math.ceil(dayOfMonth / 7); // which occurrence (1st, 2nd, 3rd, etc.)

  let nextMonth = current.getUTCMonth() + 1;
  let nextYear = current.getUTCFullYear();
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear++;
  }

  const result = getNthWeekdayOfMonth(nextYear, nextMonth, dow, n);
  if (result) return result;

  // Fallback: if e.g. 5th Thursday doesn't exist, use 4th Thursday
  for (let fallback = n - 1; fallback >= 1; fallback--) {
    const fb = getNthWeekdayOfMonth(nextYear, nextMonth, dow, fallback);
    if (fb) return fb;
  }

  // Should never happen, but safety net
  return new Date(Date.UTC(nextYear, nextMonth, 1));
}

/**
 * Generate recurring dates from a start date.
 * Returns an array of ISO date strings ("2026-03-01").
 */
export function generateRecurringDates(
  startDate: string,
  pattern: RecurringPattern,
  months: number = 6,
): string[] {
  const dates: string[] = [];
  const start = calendarDate(startDate);
  const endLimit = addMonths(start, months);
  let current = start;

  while (current < endLimit) {
    dates.push(current.toISOString().split("T")[0]);
    switch (pattern) {
      case "weekly":
        current = addWeeks(current, 1);
        break;
      case "bimonthly":
        current = addWeeks(current, 2);
        break;
      case "monthly":
        current = nextMonthSameWeekday(current);
        break;
    }
  }

  return dates;
}

/**
 * Every date the pattern lands on between `startDate` and `endDate` (inclusive),
 * split into the ones that can be booked and the public holidays that cannot.
 *
 * The holidays are RETURNED rather than quietly dropped. Dropping them lost two
 * things at once: the admin was never told why a 12-week series produced 11
 * bookings, and — because the Outlook series is one recurring event that Graph
 * expands on its own pattern — the holiday kept its occurrence in the client's
 * calendar with no booking behind it. They arrive for a session that does not
 * exist, on a public holiday.
 */
export function expandRecurringDatesUntil(
  startDate: string,
  pattern: RecurringPattern,
  endDate: string,
): { dates: string[]; holidays: string[] } {
  const dates: string[] = [];
  const holidays: string[] = [];
  const start = calendarDate(startDate);
  const end = calendarDate(endDate);
  let current = start;

  while (current <= end) {
    const iso = current.toISOString().split("T")[0];
    if (isSAPublicHolidayOn(iso)) {
      holidays.push(iso);
    } else {
      dates.push(iso);
    }
    switch (pattern) {
      case "weekly":
        current = addWeeks(current, 1);
        break;
      case "bimonthly":
        current = addWeeks(current, 2);
        break;
      case "monthly":
        current = nextMonthSameWeekday(current);
        break;
    }
  }

  return { dates, holidays };
}

/**
 * Bookable recurring dates only — public holidays removed.
 * Callers that need to know WHAT was removed want expandRecurringDatesUntil().
 */
export function generateRecurringDatesUntil(
  startDate: string,
  pattern: RecurringPattern,
  endDate: string,
): string[] {
  return expandRecurringDatesUntil(startDate, pattern, endDate).dates;
}
