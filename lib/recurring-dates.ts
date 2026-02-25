import { addWeeks, addMonths } from "date-fns";

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
