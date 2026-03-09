import { addWeeks, addMonths } from "date-fns";
import { isSAPublicHoliday } from "@/lib/sa-public-holidays";

export type RecurringPattern = "weekly" | "bimonthly" | "monthly";

export const RECURRING_PATTERNS: { value: RecurringPattern; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "bimonthly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

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
  const start = new Date(startDate + "T00:00:00Z");
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
        current = addMonths(current, 1);
        break;
    }
  }

  return dates;
}

/**
 * Generate recurring dates from a start date up to (and including) an end date.
 * Skips South African public holidays.
 * Returns an array of ISO date strings ("2026-03-01").
 */
export function generateRecurringDatesUntil(
  startDate: string,
  pattern: RecurringPattern,
  endDate: string,
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  let current = start;

  while (current <= end) {
    const iso = current.toISOString().split("T")[0];
    if (!isSAPublicHoliday(iso)) {
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
        current = addMonths(current, 1);
        break;
    }
  }

  return dates;
}
