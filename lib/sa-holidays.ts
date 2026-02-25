/**
 * South African public holidays and business day utilities.
 *
 * Fixed holidays + Easter-dependent dynamic holidays.
 * If a holiday falls on Sunday, the following Monday is observed.
 * Covers 2024–2035 for Easter dates.
 */

// Easter Sunday dates (Gregorian) — computed via the Anonymous Gregorian algorithm.
// Pre-computed for speed; extend as needed.
const EASTER_SUNDAYS: Record<number, [number, number]> = {
  2024: [3, 31],
  2025: [4, 20],
  2026: [4, 5],
  2027: [3, 28],
  2028: [4, 16],
  2029: [4, 1],
  2030: [4, 21],
  2031: [4, 13],
  2032: [3, 28],
  2033: [4, 17],
  2034: [4, 9],
  2035: [3, 25],
};

function getEasterSunday(year: number): Date {
  const precomputed = EASTER_SUNDAYS[year];
  if (precomputed) {
    return new Date(year, precomputed[0] - 1, precomputed[1]);
  }
  // Anonymous Gregorian algorithm fallback
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns all SA public holidays for the given year as Date objects (midnight local).
 * Includes the "Sunday → Monday" substitution rule.
 */
export function getSAPublicHolidays(year: number): Date[] {
  const easter = getEasterSunday(year);

  // Fixed holidays (month is 0-indexed)
  const fixed: Date[] = [
    new Date(year, 0, 1),   // New Year's Day
    new Date(year, 2, 21),  // Human Rights Day
    new Date(year, 3, 27),  // Freedom Day
    new Date(year, 4, 1),   // Workers' Day
    new Date(year, 5, 16),  // Youth Day
    new Date(year, 7, 9),   // National Women's Day
    new Date(year, 8, 24),  // Heritage Day
    new Date(year, 11, 16), // Day of Reconciliation
    new Date(year, 11, 25), // Christmas Day
    new Date(year, 11, 26), // Day of Goodwill
  ];

  // Easter-dependent holidays
  const dynamic: Date[] = [
    addDays(easter, -2), // Good Friday
    addDays(easter, 1),  // Family Day (Easter Monday)
  ];

  const all = [...fixed, ...dynamic];

  // If a holiday falls on a Sunday, the following Monday is a public holiday
  const extras: Date[] = [];
  for (const h of all) {
    if (h.getDay() === 0) {
      extras.push(addDays(h, 1));
    }
  }

  return [...all, ...extras];
}

// Cache holiday keys per year for fast lookup
const holidayCache = new Map<number, Set<string>>();

function getHolidaySet(year: number): Set<string> {
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(getSAPublicHolidays(year).map(dateKey));
    holidayCache.set(year, set);
  }
  return set;
}

/** Saturday (6) or Sunday (0) */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Checks if the date is a SA public holiday */
export function isSAPublicHoliday(date: Date): boolean {
  return getHolidaySet(date.getFullYear()).has(dateKey(date));
}

/** True if the date is a Mon–Fri working day and not a public holiday */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isSAPublicHoliday(date);
}

/** Returns the most recent preceding business day (or the date itself if it's a business day) */
export function getPrecedingBusinessDay(date: Date): Date {
  let d = new Date(date);
  while (!isBusinessDay(d)) {
    d = addDays(d, -1);
  }
  return d;
}

/** Returns the next business day on or after the given date */
export function getNextBusinessDay(date: Date): Date {
  let d = new Date(date);
  while (!isBusinessDay(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** Adds N business days to a date (skipping weekends and holidays) */
export function addBusinessDays(date: Date, days: number): Date {
  let d = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

/** Subtracts N business days from a date (skipping weekends and holidays) */
export function subtractBusinessDays(date: Date, days: number): Date {
  let d = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, -1);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}
