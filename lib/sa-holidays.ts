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
    return new Date(Date.UTC(year, precomputed[0] - 1, precomputed[1]));
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
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // UTC-midnight anchor → exact
}

/**
 * Returns all SA public holidays for the given year as Date objects (midnight local).
 * Includes the "Sunday → Monday" substitution rule.
 */
/**
 * Once-off holidays PROCLAIMED BY THE PRESIDENT under s2A of the Public Holidays
 * Act 36 of 1994. **No algorithm can derive these** — they are political acts,
 * announced in the Government Gazette. Election days have done it; so has the
 * Christmas-on-a-Sunday gap.
 *
 * They matter here because business-day arithmetic drives billing: the monthly
 * run date (last business day), payment due dates, reminders (2 business days
 * before) and overdue triggers (1 after). Miss a proclaimed day and a reminder
 * goes out on a public holiday, or a client is marked overdue a day early.
 *
 * **Every entry needs a Gazette reference.** If you cannot cite it, do not add it
 * — a fabricated holiday is worse than a missing one, because it silently moves
 * a real due date.
 *
 * Known recurrence to watch: when 25 December falls on a Sunday, s2(1) shifts it
 * to the Monday — but that Monday is ALREADY Day of Goodwill, so the shift has no
 * work to do (the algorithm below correctly produces no extra day). Historically
 * the gap was then filled by a separate proclamation on the 27th. Next occurrence:
 * **2033**.
 */
const PROCLAIMED_HOLIDAYS: Record<string, string> = {
  // date: Gazette reference
  "2022-12-27": "GG 45832, Proc R.63 of 2022 — Christmas fell on a Sunday; 26 Dec was already Day of Goodwill",
};

export function getSAPublicHolidays(year: number): Date[] {
  const easter = getEasterSunday(year);

  // Fixed holidays (month is 0-indexed)
  const fixed: Date[] = [
    new Date(Date.UTC(year, 0, 1)),   // New Year's Day
    new Date(Date.UTC(year, 2, 21)),  // Human Rights Day
    new Date(Date.UTC(year, 3, 27)),  // Freedom Day
    new Date(Date.UTC(year, 4, 1)),   // Workers' Day
    new Date(Date.UTC(year, 5, 16)),  // Youth Day
    new Date(Date.UTC(year, 7, 9)),   // National Women's Day
    new Date(Date.UTC(year, 8, 24)),  // Heritage Day
    new Date(Date.UTC(year, 11, 16)), // Day of Reconciliation
    new Date(Date.UTC(year, 11, 25)), // Christmas Day
    new Date(Date.UTC(year, 11, 26)), // Day of Goodwill
  ];

  // Easter-dependent holidays
  const dynamic: Date[] = [
    addDays(easter, -2), // Good Friday
    addDays(easter, 1),  // Family Day (Easter Monday)
  ];

  const all = [...fixed, ...dynamic];

  // Public Holidays Act s2(1): a holiday falling on a SUNDAY moves to the Monday.
  // (Saturday holidays are NOT shifted.) When Christmas lands on a Sunday the
  // Monday is already Day of Goodwill, so this legitimately produces a duplicate
  // rather than a new day — dedupe below, never fabricate a Tuesday.
  const extras: Date[] = [];
  for (const h of all) {
    if (h.getUTCDay() === 0) {
      extras.push(addDays(h, 1));
    }
  }

  // s2A proclamations for this year — the days no algorithm can know.
  const proclaimed = Object.keys(PROCLAIMED_HOLIDAYS)
    .filter((d) => d.startsWith(`${year}-`))
    .map((d) => new Date(`${d}T00:00:00Z`));

  // Dedupe: the Sunday shift can land on a day that is already a holiday.
  const seen = new Set<string>();
  return [...all, ...extras, ...proclaimed].filter((d) => {
    const k = d.toISOString().slice(0, 10);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Checks if the date is a SA public holiday */
export function isSAPublicHoliday(date: Date): boolean {
  return getHolidaySet(date.getUTCFullYear()).has(dateKey(date));
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

/**
 * Returns the last business day of the given month.
 * month is 1-indexed (1 = Jan, 12 = Dec).
 */
export function getLastBusinessDayOfMonth(year: number, month: number): Date {
  // new Date(Date.UTC(year, month, 0)) = last calendar day of the month (month is 1-indexed here)
  const lastCalendarDay = new Date(Date.UTC(year, month, 0));
  return getPrecedingBusinessDay(lastCalendarDay);
}
