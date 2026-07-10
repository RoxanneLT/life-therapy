/**
 * Boundary tests for lib/dates.ts.
 *
 * Every fixture probes a specific edge and says which side of it it sits on.
 * The point is not coverage — it's that a future green run proves the *spec*
 * still holds, so nobody "simplifies" a guard back into a silent Invalid Date.
 *
 * Run: npm run test:dates   (runs under several server timezones)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saDateStr,
  saInstant,
  saDayStart,
  saDayEnd,
  calendarDate,
  addSaDays,
  diffSaDays,
  saMonthStart,
  saFormat,
  isSameSaDay,
  isSaDateStr,
  bookingStartsAt,
} from "./dates";

const TZ = process.env.TZ ?? "(host default)";

// ── The 22:00 UTC day-flip: SAST midnight, not UTC midnight ──────────────────

test(`[${TZ}] SAST day flips at 22:00 UTC, not midnight`, () => {
  // 21:59:59Z is 23:59:59 SAST — still "today".
  assert.equal(saDateStr(new Date("2026-07-08T21:59:59Z")), "2026-07-08");
  // 22:00:00Z is 00:00:00 SAST — already "tomorrow". The old .slice(0,10) said the 8th.
  assert.equal(saDateStr(new Date("2026-07-08T22:00:00Z")), "2026-07-09");
  // 23:59Z is still inside the danger window: SAST says the 9th, UTC says the 8th.
  assert.equal(saDateStr(new Date("2026-07-08T23:59:00Z")), "2026-07-09");
  // Past 00:00Z both agree again.
  assert.equal(saDateStr(new Date("2026-07-09T00:00:00Z")), "2026-07-09");
});

test(`[${TZ}] isSameSaDay follows the SAST day, not the UTC day`, () => {
  const before = new Date("2026-07-08T21:59:59Z"); // 23:59:59 SAST, the 8th
  const after = new Date("2026-07-08T22:00:01Z"); // 00:00:01 SAST, the 9th
  // 2 seconds apart, different SAST days. A UTC-getter check would say `true`.
  assert.equal(isSameSaDay(before, after), false);
  // 8 hours apart, same SAST day. A UTC-getter check would say `false`.
  assert.equal(isSameSaDay(after, new Date("2026-07-09T06:00:00Z")), true);
});

// ── Zone-less strings are rejected, not silently reinterpreted ───────────────

test(`[${TZ}] a zone-less datetime string throws instead of resolving locally`, () => {
  // This is the whole reason the module exists: on a UTC server this parses to
  // 23:30Z (SAST day = the 9th); on a SAST dev box, 21:30Z (day = the 8th).
  assert.throws(() => saDateStr("2026-07-08T23:30"), /has no timezone/);
  assert.throws(() => saDateStr("2026-07-08 23:30"), /has no timezone/);
});

test(`[${TZ}] strings that DO carry a zone are accepted`, () => {
  assert.equal(saDateStr("2026-07-08T22:00:00Z"), "2026-07-09");
  assert.equal(saDateStr("2026-07-09T00:00:00+02:00"), "2026-07-09");
  assert.equal(saDateStr("2026-07-08"), "2026-07-08"); // date-only = a day, unambiguous
});

// ── Fail closed: never hand back an Invalid Date ─────────────────────────────

test(`[${TZ}] malformed calendar dates throw rather than yielding Invalid Date`, () => {
  // An Invalid Date compares false both ways, so a Prisma `where` built from one
  // silently matches nothing — a failure that reads exactly like "no results".
  assert.throws(() => calendarDate("2026-7-8"), /YYYY-MM-DD/); // unpadded
  assert.throws(() => calendarDate("08-07-2026"), /YYYY-MM-DD/); // wrong order
  assert.throws(() => calendarDate(""), /YYYY-MM-DD/);
  assert.throws(() => calendarDate("2026-13-01"), /not a real date/); // month 13 -> NaN
  assert.throws(() => calendarDate("2026-01-32"), /not a real date/); // day 32 -> NaN
});

test(`[${TZ}] an overflowing day is rejected, not silently rolled forward`, () => {
  // THE trap: V8 does not return Invalid Date for a day that overflows its month.
  // It rolls over. A NaN guard cannot see this; only a round-trip can.
  assert.equal(new Date("2026-02-30T00:00:00Z").toISOString().slice(0, 10), "2026-03-02");
  assert.equal(new Date("2025-02-29T00:00:00Z").toISOString().slice(0, 10), "2025-03-01");

  assert.throws(() => calendarDate("2026-02-30"), /not a real date/);
  assert.throws(() => calendarDate("2025-02-29"), /not a real date/); // 2025 isn't a leap year
  assert.throws(() => calendarDate("2026-04-31"), /not a real date/); // April has 30
  assert.throws(() => saInstant("2025-02-29", "09:00"), /not a real date/);
  assert.throws(() => addSaDays("2025-02-29", 1), /not a real date/);

  // ...while the real leap day is accepted.
  assert.equal(calendarDate("2024-02-29").toISOString(), "2024-02-29T00:00:00.000Z");
});

test(`[${TZ}] isSaDateStr is the guard for untrusted input`, () => {
  assert.equal(isSaDateStr("2026-07-08"), true);
  assert.equal(isSaDateStr("2024-02-29"), true); // real leap day
  assert.equal(isSaDateStr("2025-02-29"), false); // not a leap year
  assert.equal(isSaDateStr("2026-7-8"), false);
  assert.equal(isSaDateStr("garbage"), false);
  assert.equal(isSaDateStr(undefined), false);
  assert.equal(isSaDateStr(20260708), false);
});

// ── Time-of-day parsing is shape-based, not length-based ────────────────────

test(`[${TZ}] saInstant validates the time, and pads a single-digit hour`, () => {
  assert.equal(saInstant("2026-07-08", "09:00").toISOString(), "2026-07-08T07:00:00.000Z");
  assert.equal(saInstant("2026-07-08", "09:00:00").toISOString(), "2026-07-08T07:00:00.000Z");
  // "9:30" is length 4 — the old length===5 check let it through unpadded.
  assert.equal(saInstant("2026-07-08", "9:30").toISOString(), "2026-07-08T07:30:00.000Z");
  assert.throws(() => saInstant("2026-07-08", "24:00"), /not a time of day/); // wraps, doesn't wander
  assert.throws(() => saInstant("2026-07-08", "09:60"), /not a time of day/);
  assert.throws(() => saInstant("2026-07-08", "0900"), /not a time of day/);
  assert.throws(() => saInstant("2026-07-08", ""), /not a time of day/);
});

// ── saFormat takes a Date, so it can't render a carrier as a time ────────────

test(`[${TZ}] saFormat renders in SAST regardless of the server timezone`, () => {
  // 22:00Z on 28 Feb is 1 March in SAST. A server-local format() would say "Feb".
  assert.equal(saFormat(saMonthStart(2025, 3), "MMM"), "Mar");
  assert.equal(saFormat(saMonthStart(2025, 3), "yyyy-MM"), "2025-03");
  assert.throws(() => saFormat(new Date("nonsense"), "MMM"), /not a real date/);
});

// ── Day boundaries ──────────────────────────────────────────────────────────

test(`[${TZ}] saDayStart/saDayEnd bracket the SAST day`, () => {
  assert.equal(saDayStart("2026-07-08").toISOString(), "2026-07-07T22:00:00.000Z");
  assert.equal(saDayEnd("2026-07-08").toISOString(), "2026-07-08T21:59:59.000Z");
  assert.equal(saDateStr(saDayStart("2026-07-08")), "2026-07-08");
  assert.equal(saDateStr(saDayEnd("2026-07-08")), "2026-07-08");
});

test(`[${TZ}] saDayEnd is inclusive-to-the-second, so ranges use an exclusive next-day start`, () => {
  const end = saDayEnd("2026-07-08");
  const hole = new Date(end.getTime() + 500); // 23:59:59.500 SAST — still the 8th
  assert.equal(saDateStr(hole), "2026-07-08");
  assert.equal(hole > end, true); // ...yet past saDayEnd. This is the documented gap.
  // The recommended bound has no gap:
  const exclusiveEnd = saDayStart(addSaDays("2026-07-08", 1));
  assert.equal(hole < exclusiveEnd, true);
});

// ── Calendar arithmetic ─────────────────────────────────────────────────────

test(`[${TZ}] addSaDays crosses months, leap days and years`, () => {
  assert.equal(addSaDays("2026-02-28", 1), "2026-03-01"); // non-leap
  assert.equal(addSaDays("2024-02-28", 1), "2024-02-29"); // leap
  assert.equal(addSaDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addSaDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addSaDays("2026-07-08", 0), "2026-07-08");
});

test(`[${TZ}] addSaDays rejects a fractional shift instead of truncating`, () => {
  assert.throws(() => addSaDays("2026-07-08", 2.5), /whole number/);
  assert.throws(() => addSaDays("2026-07-08", NaN), /whole number/);
});

test(`[${TZ}] diffSaDays counts calendar days, not 24-hour spans`, () => {
  // 23:00 Mon → 08:00 Tue is 9 hours: a ms-division floors to 0, the calendar says 1.
  const monEvening = new Date("2026-07-06T21:00:00Z"); // 23:00 SAST Mon
  const tueMorning = new Date("2026-07-07T06:00:00Z"); // 08:00 SAST Tue
  assert.equal(Math.floor((tueMorning.getTime() - monEvening.getTime()) / 86_400_000), 0);
  assert.equal(diffSaDays(monEvening, tueMorning), 1);

  assert.equal(diffSaDays("2026-07-08", "2026-07-08"), 0);
  assert.equal(diffSaDays("2026-07-08", "2026-08-07"), 30);
  assert.equal(diffSaDays("2026-08-07", "2026-07-08"), -30); // sign is from → to
});

// ── Month boundaries ────────────────────────────────────────────────────────

test(`[${TZ}] saMonthStart is a SAST boundary and normalises month overflow`, () => {
  assert.equal(saMonthStart(2025, 3).toISOString(), "2025-02-28T22:00:00.000Z");
  assert.equal(saDateStr(saMonthStart(2026, 13)), "2027-01-01"); // Dec + 1
  assert.equal(saDateStr(saMonthStart(2026, 0)), "2025-12-01"); // Jan - 1
  assert.equal(saDateStr(saMonthStart(2026, 14)), "2027-02-01");
  assert.equal(saDateStr(saMonthStart(2026, -11)), "2025-01-01");
});

test(`[${TZ}] saMonthStart rejects fractional inputs instead of building "2026-1.5-01"`, () => {
  assert.throws(() => saMonthStart(2026, 1.5), /whole number/);
  assert.throws(() => saMonthStart(2026.5, 1), /whole number/);
});

test(`[${TZ}] a financial year's months tile with no gap and no overlap`, () => {
  const months = Array.from({ length: 12 }, (_, i) => ({
    start: saMonthStart(2025, 3 + i),
    end: saMonthStart(2025, 4 + i),
  }));
  for (let i = 1; i < 12; i++) {
    assert.equal(months[i - 1].end.getTime(), months[i].start.getTime());
  }
  assert.equal(months[11].end.getTime(), saMonthStart(2026, 3).getTime());

  // A payment at 00:30 SAST on 1 Mar 2026 belongs to the NEXT financial year.
  const paidAt = new Date("2026-02-28T22:30:00Z");
  assert.equal(saDateStr(paidAt), "2026-03-01");
  assert.equal(paidAt >= months[11].start && paidAt < months[11].end, false);
});

// ── @db.Date columns and bookings ───────────────────────────────────────────

test(`[${TZ}] a @db.Date value (UTC midnight) lands inside its own SAST day`, () => {
  const stored = calendarDate("2026-07-08"); // how Prisma holds a @db.Date
  assert.equal(stored >= saDayStart("2026-07-08"), true);
  assert.equal(stored < saDayStart("2026-07-09"), true);
  assert.equal(saDateStr(stored), "2026-07-08");
});

test(`[${TZ}] bookingStartsAt matches the "+02:00" form it replaced`, () => {
  const booking = { date: calendarDate("2026-07-08"), startTime: "14:15" };
  assert.equal(bookingStartsAt(booking).toISOString(), "2026-07-08T12:15:00.000Z");
  assert.equal(
    bookingStartsAt(booking).getTime(),
    new Date("2026-07-08T14:15:00+02:00").getTime(),
  );
});

test(`[${TZ}] bookingStartsAt is unfazed by an accidental real instant in .date`, () => {
  // 22:30Z is already the 9th in SAST, so the booking resolves onto the 9th.
  const booking = { date: new Date("2026-07-08T22:30:00Z"), startTime: "09:00" };
  assert.equal(bookingStartsAt(booking).toISOString(), "2026-07-09T07:00:00.000Z");
});
