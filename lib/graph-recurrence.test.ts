/**
 * lib/graph-recurrence.ts — the regression scar for the "recurring series one weekday
 * late" incident (date-fns "e" locale token vs "i" ISO token).
 *
 * Pins graphDayOfWeek across all seven weekdays so the "e" token can never silently
 * come back: with "e", a Tuesday start would return "wednesday" and every one of these
 * assertions would fail.
 *
 * Run: npm run test:graph  (part of `npm run check`)
 */
import "./test-tz"; // MUST be first — pins TZ=UTC (see the module)
import { test } from "node:test";
import assert from "node:assert/strict";
import { graphDayOfWeek, GRAPH_DAY_NAMES, weeklyOccurrenceDates } from "./graph-recurrence";

// A run of seven consecutive days anchored on a KNOWN Tuesday — 2026-08-11 is the first
// occurrence of Chanene Norman's real weekly series. Noon SAST (10:00Z) keeps every date
// well clear of the 22:00-UTC SAST day boundary, so the weekday is unambiguous.
const CASES: Array<[string, string]> = [
  ["2026-08-11T10:00:00Z", "tuesday"],
  ["2026-08-12T10:00:00Z", "wednesday"],
  ["2026-08-13T10:00:00Z", "thursday"],
  ["2026-08-14T10:00:00Z", "friday"],
  ["2026-08-15T10:00:00Z", "saturday"],
  ["2026-08-16T10:00:00Z", "sunday"],
  ["2026-08-17T10:00:00Z", "monday"],
];

for (const [iso, expected] of CASES) {
  test(`graphDayOfWeek(${iso}) → ${expected}`, () => {
    assert.equal(graphDayOfWeek(new Date(iso)), expected);
  });
}

test("the exact regression: a Tuesday start maps to tuesday, NOT wednesday", () => {
  // This is the assertion that fails the instant the "e" (locale) token returns.
  assert.equal(graphDayOfWeek(new Date("2026-08-11T10:00:00Z")), "tuesday");
});

// ── weeklyOccurrenceDates — the pruning input for a series rebuild ──────────

test("weekly occurrences step 7 days and include the end date", () => {
  assert.deepEqual(weeklyOccurrenceDates("2026-08-11", "2026-09-01", 1), [
    "2026-08-11",
    "2026-08-18",
    "2026-08-25",
    "2026-09-01",
  ]);
});

test("bimonthly occurrences step 14 days", () => {
  assert.deepEqual(weeklyOccurrenceDates("2026-08-11", "2026-09-08", 2), [
    "2026-08-11",
    "2026-08-25",
    "2026-09-08",
  ]);
});

test("a range shorter than one step yields just the start", () => {
  assert.deepEqual(weeklyOccurrenceDates("2026-08-11", "2026-08-14", 1), ["2026-08-11"]);
});

test("REAL DATA: Chanene's series has 7 holes that a rebuild must prune", () => {
  // Her live bookings, 2026-08-11 → 2027-07-20 weekly Tuesdays. 43 bookings across 50
  // weekly slots: without pruning, a rebuilt recurrence would create 7 instant ghosts
  // on dates she has no booking for (holidays / cancelled sessions).
  const bookings = new Set([
    "2026-08-11","2026-08-18","2026-08-25","2026-09-01","2026-09-15","2026-09-22",
    "2026-09-29","2026-10-06","2026-10-20","2026-10-27","2026-11-03","2026-11-10",
    "2026-11-17","2026-11-24","2026-12-01","2026-12-15","2026-12-22","2026-12-29",
    "2027-01-05","2027-01-19","2027-01-26","2027-02-02","2027-02-16","2027-02-23",
    "2027-03-02","2027-03-16","2027-03-23","2027-03-30","2027-04-06","2027-04-13",
    "2027-04-20","2027-05-04","2027-05-11","2027-05-18","2027-05-25","2027-06-01",
    "2027-06-08","2027-06-15","2027-06-22","2027-06-29","2027-07-06","2027-07-13",
    "2027-07-20",
  ]);
  const generated = weeklyOccurrenceDates("2026-08-11", "2027-07-20", 1);
  const toPrune = generated.filter((d) => !bookings.has(d));

  assert.equal(bookings.size, 43);
  assert.equal(generated.length, 50);
  assert.deepEqual(toPrune, [
    "2026-09-08",
    "2026-10-13",
    "2026-12-08",
    "2027-01-12",
    "2027-02-09",
    "2027-03-09",
    "2027-04-27",
  ]);
});

test("all seven names are covered and distinct", () => {
  const got = new Set(CASES.map(([iso]) => graphDayOfWeek(new Date(iso))));
  assert.equal(got.size, 7);
  for (const name of GRAPH_DAY_NAMES) assert.ok(got.has(name), `missing ${name}`);
});
