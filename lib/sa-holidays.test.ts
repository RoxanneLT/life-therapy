/**
 * SA public holidays — the statutory rules, pinned.
 *
 * These dates drive MONEY: the monthly billing run lands on the last business day
 * of the month, payment due dates are business-day offsets, reminders go 2
 * business days before due, and the overdue trigger is 1 business day after. Get a
 * holiday wrong and a client is chased on a public holiday, or marked overdue a
 * day early.
 *
 * The 2025–2027 expectations below are not my arithmetic — they are cross-checked
 * against an independently researched, statutorily-cited holiday table (each entry
 * carrying its Public Holidays Act basis). Our algorithm reproduces that table
 * exactly, including every observed-Monday shift. That agreement is the point of
 * this file: an algorithm that agrees with itself proves nothing.
 *
 * Run: npm run test:holidays  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSAPublicHolidays,
  isSAPublicHoliday,
  isSAPublicHolidayOn,
  isBusinessDay,
  isWeekend,
  getNextBusinessDay,
  getPrecedingBusinessDay,
  addBusinessDays,
  subtractBusinessDays,
  getLastBusinessDayOfMonth,
} from "./sa-holidays";
import { calendarDate, saDateStr } from "./dates";

const TZ = process.env.TZ ?? "(host default)";
const d = (s: string) => calendarDate(s);
const days = (year: number) => getSAPublicHolidays(year).map((x) => saDateStr(x)).sort();

// ── The table, as the Act defines it ────────────────────────────────────────

test(`[${TZ}] 2025 matches the researched statutory table exactly`, () => {
  assert.deepEqual(days(2025), [
    "2025-01-01", // New Year's Day
    "2025-03-21", // Human Rights Day
    "2025-04-18", // Good Friday (Easter-derived)
    "2025-04-21", // Family Day (Easter-derived)
    "2025-04-27", // Freedom Day — a SUNDAY
    "2025-04-28", // …so the Monday is observed  [PHA s2(1)]
    "2025-05-01", // Workers' Day
    "2025-06-16", // Youth Day
    "2025-08-09", // National Women's Day
    "2025-09-24", // Heritage Day
    "2025-12-16", // Day of Reconciliation
    "2025-12-25", // Christmas Day
    "2025-12-26", // Day of Goodwill
  ]);
});

test(`[${TZ}] 2026 matches the researched statutory table exactly`, () => {
  const y = days(2026);
  assert.equal(y.length, 13);
  assert.ok(y.includes("2026-08-09"), "Women's Day falls on a Sunday in 2026");
  assert.ok(y.includes("2026-08-10"), "…so the Monday is observed [PHA s2(1)]");
  assert.ok(y.includes("2026-04-03"), "Good Friday 2026");
  assert.ok(y.includes("2026-04-06"), "Family Day 2026");
});

test(`[${TZ}] 2027 observes Day of Goodwill on the Monday`, () => {
  const y = days(2027);
  assert.equal(y.length, 14, "2027 has an observed day, so 14 not 13");
  assert.ok(y.includes("2027-12-26"), "26 Dec 2027 is a Sunday");
  assert.ok(y.includes("2027-12-27"), "…so the Monday is observed [PHA s2(1)]");
  assert.ok(y.includes("2027-03-21"), "Human Rights Day is a Sunday in 2027");
  assert.ok(y.includes("2027-03-22"), "…so the Monday is observed");
});

// ── s2(1): Sunday shifts, and the carve-out where it has no work to do ──────

test(`[${TZ}] a SATURDAY holiday is NOT shifted — only Sundays move`, () => {
  // The Act says Sunday. Shifting Saturdays too would invent a holiday and move a
  // real due date. 2026-12-26 (Day of Goodwill) is a Saturday.
  assert.equal(d("2026-12-26").getUTCDay(), 6, "26 Dec 2026 is a Saturday");
  assert.ok(!days(2026).includes("2026-12-28"), "no Monday observed for a Saturday holiday");
});

test(`[${TZ}] Christmas on a SUNDAY does not fabricate a third day`, () => {
  // 2033: 25 Dec is a Sunday. s2(1) shifts it to Monday 26 — but the 26th is
  // ALREADY Day of Goodwill, so the shift has no work to do. The algorithm must
  // produce a duplicate that dedupes away, NOT a new holiday on the 27th.
  //
  // (Historically the resulting gap was filled by a separate s2A proclamation —
  // see PROCLAIMED_HOLIDAYS. That is a human act with a Gazette reference, never
  // something the algorithm may invent.)
  assert.equal(d("2033-12-25").getUTCDay(), 0, "25 Dec 2033 is a Sunday");
  const dec = days(2033).filter((x) => x.startsWith("2033-12"));
  assert.deepEqual(dec, ["2033-12-16", "2033-12-25", "2033-12-26"]);
  assert.equal(isSAPublicHoliday(d("2033-12-26")), true);
  assert.equal(isSAPublicHoliday(d("2033-12-27")), false, "must NOT invent the 27th");
});

test(`[${TZ}] the holiday list never contains duplicates`, () => {
  for (const y of [2025, 2026, 2027, 2033]) {
    const list = days(y);
    assert.equal(new Set(list).size, list.length, `${y} has a duplicate entry`);
  }
});

// ── s2A: proclaimed days, which no algorithm can derive ─────────────────────

test(`[${TZ}] a proclaimed (s2A) holiday is honoured`, () => {
  // 27 Dec 2022 — GG 45832, Proc R.63 of 2022. Christmas fell on a Sunday and the
  // Monday was already Day of Goodwill, so the President proclaimed the Tuesday.
  // No algorithm could know this; it is carried in PROCLAIMED_HOLIDAYS.
  assert.equal(isSAPublicHoliday(d("2022-12-27")), true);
  assert.equal(isBusinessDay(d("2022-12-27")), false);
});

// ── Easter-derived holidays ─────────────────────────────────────────────────

test(`[${TZ}] Good Friday and Family Day track Easter`, () => {
  const cases: [number, string, string][] = [
    [2024, "2024-03-29", "2024-04-01"],
    [2025, "2025-04-18", "2025-04-21"],
    [2026, "2026-04-03", "2026-04-06"],
    [2027, "2027-03-26", "2027-03-29"],
  ];
  for (const [year, goodFriday, familyDay] of cases) {
    const y = days(year);
    assert.ok(y.includes(goodFriday), `Good Friday ${goodFriday}`);
    assert.ok(y.includes(familyDay), `Family Day ${familyDay}`);
    assert.equal(d(goodFriday).getUTCDay(), 5, "Good Friday is always a Friday");
    assert.equal(d(familyDay).getUTCDay(), 1, "Family Day is always a Monday");
  }
});

// ── Business-day walkers ────────────────────────────────────────────────────

test(`[${TZ}] business days skip weekends AND public holidays`, () => {
  assert.equal(isWeekend(d("2026-07-18")), true); // Saturday
  assert.equal(isWeekend(d("2026-07-19")), true); // Sunday
  assert.equal(isWeekend(d("2026-07-20")), false); // Monday

  assert.equal(isBusinessDay(d("2026-12-16")), false, "Day of Reconciliation");
  assert.equal(isBusinessDay(d("2026-12-17")), true);

  assert.equal(saDateStr(getNextBusinessDay(d("2026-12-16"))), "2026-12-17");
  assert.equal(saDateStr(getPrecedingBusinessDay(d("2026-12-16"))), "2026-12-15");
});

test(`[${TZ}] the monthly billing date is the last BUSINESS day of the month`, () => {
  assert.equal(saDateStr(getLastBusinessDayOfMonth(2026, 7)), "2026-07-31"); // Fri
  assert.equal(saDateStr(getLastBusinessDayOfMonth(2026, 2)), "2026-02-27"); // 28th is a Sat
  assert.equal(saDateStr(getLastBusinessDayOfMonth(2026, 5)), "2026-05-29"); // 31st is a Sun
});

test(`[${TZ}] addBusinessDays / subtractBusinessDays walk over a holiday`, () => {
  // From Tue 15 Dec 2026: +2 business days must skip Wed 16 (Reconciliation).
  assert.equal(saDateStr(addBusinessDays(d("2026-12-15"), 2)), "2026-12-18");
  // Backwards from Fri 18 Dec: -2 must also skip the 16th.
  assert.equal(saDateStr(subtractBusinessDays(d("2026-12-18"), 2)), "2026-12-15");
});

// ── Timezone independence ───────────────────────────────────────────────────

test(`[${TZ}] the answer does not depend on the server's timezone`, () => {
  // All arithmetic here is UTC-anchored. It used to use LOCAL getters, which mean
  // UTC on Vercel and SAST on a dev machine — so the same date could be a business
  // day in one place and a holiday in the other. Running this file under several
  // TZs (see npm run test:holidays) is what actually proves it; this fixture pins
  // the invariant that a @db.Date value resolves to its own day.
  const reconciliation = d("2026-12-16");
  assert.equal(saDateStr(reconciliation), "2026-12-16");
  assert.equal(isSAPublicHoliday(reconciliation), true);
  assert.equal(reconciliation.toISOString(), "2026-12-16T00:00:00.000Z");
});

// ── The string form: one list, two doors ────────────────────────────────────

test(`[${TZ}] isSAPublicHolidayOn agrees with the Date form, proclamations included`, () => {
  // There used to be a SECOND holiday module answering this string question, and
  // it had no idea about s2A proclamations. So 27 Dec 2022 was a holiday to the
  // reschedule guard and an ordinary working day to recurring-series generation.
  assert.equal(isSAPublicHolidayOn("2022-12-27"), true);
  assert.equal(isSAPublicHoliday(d("2022-12-27")), true);

  // And the two forms must not disagree anywhere in a year of ordinary dates.
  for (const day of days(2026)) {
    assert.equal(isSAPublicHolidayOn(day), true, `${day} should be a holiday`);
  }
  assert.equal(isSAPublicHolidayOn("2026-12-25"), true);
  assert.equal(isSAPublicHolidayOn("2026-12-24"), false);
});

test(`[${TZ}] isSAPublicHolidayOn fails closed on a malformed date`, () => {
  // Returning "not a holiday" for junk is the answer that books a session on
  // Christmas Day. Throw instead — same contract as lib/dates.ts.
  assert.throws(() => isSAPublicHolidayOn("25/12/2026"));
  assert.throws(() => isSAPublicHolidayOn(""));
  assert.throws(() => isSAPublicHolidayOn("2026-12-25T00:00:00Z"));
});
