/**
 * Recurring series expansion — what gets booked, and what gets NAMED as skipped.
 *
 * The skipped list is not cosmetic. The Outlook series is ONE recurring event that
 * Graph expands on its own pattern, so any date we decline to book keeps its
 * occurrence in the client's calendar unless something removes it. Series creation
 * prunes against the dates it actually created; these tests pin the input to that.
 *
 * Run: npm run test:recurring  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expandRecurringDatesUntil, generateRecurringDatesUntil } from "./recurring-dates";

const TZ = process.env.TZ ?? "(host default)";

test(`[${TZ}] a weekly series names the public holiday it skips`, () => {
  // Fridays over Christmas 2026: 25 Dec 2026 is a Friday and Christmas Day.
  const { dates, holidays } = expandRecurringDatesUntil("2026-12-11", "weekly", "2027-01-01");

  assert.deepEqual(holidays, ["2026-12-25", "2027-01-01"]);
  assert.deepEqual(dates, ["2026-12-11", "2026-12-18"]);
});

test(`[${TZ}] every pattern date lands in exactly one of the two lists`, () => {
  // Nothing may vanish: a date that is neither booked nor reported as skipped is
  // precisely the ghost occurrence this split exists to prevent.
  const { dates, holidays } = expandRecurringDatesUntil("2026-03-02", "weekly", "2026-05-04");
  const all = [...dates, ...holidays].sort((a, b) => a.localeCompare(b));

  const expected: string[] = [];
  for (let d = new Date(Date.UTC(2026, 2, 2)); d <= new Date(Date.UTC(2026, 4, 4)); d.setUTCDate(d.getUTCDate() + 7)) {
    expected.push(d.toISOString().slice(0, 10));
  }

  assert.deepEqual(all, expected);
  assert.deepEqual(holidays, ["2026-04-06", "2026-04-27"], "Family Day and Freedom Day");
  // Human Rights Day 2026 falls on a SATURDAY. s2(1) moves a holiday only when it
  // lands on a Sunday, so the following Monday is an ordinary working day and the
  // series must keep its session. Skipping it would cancel a session for a holiday
  // that does not exist.
  assert.ok(dates.includes("2026-03-23"), "the Monday after a Saturday holiday is bookable");
});

test(`[${TZ}] bi-weekly and monthly patterns keep their step`, () => {
  const fortnightly = expandRecurringDatesUntil("2026-02-03", "bimonthly", "2026-03-31").dates;
  assert.deepEqual(fortnightly, ["2026-02-03", "2026-02-17", "2026-03-03", "2026-03-17", "2026-03-31"]);

  // Monthly holds the weekday occurrence, not the day number: 1st Tuesday onward.
  const monthly = expandRecurringDatesUntil("2026-02-03", "monthly", "2026-05-31").dates;
  assert.deepEqual(monthly, ["2026-02-03", "2026-03-03", "2026-04-07", "2026-05-05"]);
});

test(`[${TZ}] generateRecurringDatesUntil returns the bookable dates only`, () => {
  const both = expandRecurringDatesUntil("2026-12-11", "weekly", "2027-01-01");
  assert.deepEqual(generateRecurringDatesUntil("2026-12-11", "weekly", "2027-01-01"), both.dates);
});

test(`[${TZ}] a series that is entirely holidays books nothing and says why`, () => {
  const { dates, holidays } = expandRecurringDatesUntil("2026-12-25", "weekly", "2026-12-25");
  assert.deepEqual(dates, []);
  assert.deepEqual(holidays, ["2026-12-25"]);
});
