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
import { test } from "node:test";
import assert from "node:assert/strict";
import { graphDayOfWeek, GRAPH_DAY_NAMES } from "./graph-recurrence";

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

test("all seven names are covered and distinct", () => {
  const got = new Set(CASES.map(([iso]) => graphDayOfWeek(new Date(iso))));
  assert.equal(got.size, 7);
  for (const name of GRAPH_DAY_NAMES) assert.ok(got.has(name), `missing ${name}`);
});
