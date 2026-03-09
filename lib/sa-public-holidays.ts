/**
 * South African public holidays calculator.
 * Returns a Set of ISO date strings ("YYYY-MM-DD") for a given year.
 *
 * Fixed holidays:
 *   Jan 1  – New Year's Day
 *   Mar 21 – Human Rights Day
 *   Apr 27 – Freedom Day
 *   May 1  – Workers' Day
 *   Jun 16 – Youth Day
 *   Aug 9  – National Women's Day
 *   Sep 24 – Heritage Day
 *   Dec 16 – Day of Reconciliation
 *   Dec 25 – Christmas Day
 *   Dec 26 – Day of Goodwill
 *
 * Easter-dependent:
 *   Good Friday (Easter - 2 days)
 *   Family Day  (Easter + 1 day = Easter Monday)
 *
 * Sunday rule: if a fixed holiday falls on Sunday, the following Monday is observed.
 */

/** Compute Easter Sunday for a given year using the Anonymous Gregorian algorithm */
function easterSunday(year: number): Date {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function getSAPublicHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  const fixed: [number, number][] = [
    [0, 1],   // New Year's Day
    [2, 21],  // Human Rights Day
    [3, 27],  // Freedom Day
    [4, 1],   // Workers' Day
    [5, 16],  // Youth Day
    [7, 9],   // National Women's Day
    [8, 24],  // Heritage Day
    [11, 16], // Day of Reconciliation
    [11, 25], // Christmas Day
    [11, 26], // Day of Goodwill
  ];

  for (const [month, day] of fixed) {
    const d = new Date(Date.UTC(year, month, day));
    holidays.add(isoDate(d));
    // If it falls on Sunday, the Monday is also observed
    if (d.getUTCDay() === 0) {
      holidays.add(isoDate(addDays(d, 1)));
    }
  }

  // Easter-dependent
  const easter = easterSunday(year);
  holidays.add(isoDate(addDays(easter, -2))); // Good Friday
  holidays.add(isoDate(addDays(easter, 1)));  // Family Day (Easter Monday)

  return holidays;
}

/** Check if a given ISO date string is a SA public holiday */
export function isSAPublicHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return getSAPublicHolidays(year).has(dateStr);
}
