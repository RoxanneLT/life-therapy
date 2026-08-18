/**
 * Which calendar removal a booking needs.
 *
 * Getting this wrong in the master-as-single direction deleted fifty real sessions
 * in July 2026. The opposite direction is currently caught by a type check inside
 * `deleteRecurringEventOccurrences`, but that is a backstop two layers away, and a
 * rule whose correctness depends on a rescue elsewhere is not a rule.
 *
 * The old test inferred the EVENT's shape from `recurringSeriesId`, which answers a
 * question about the BOOKING. These fixtures pin the question that actually decides
 * it: how many bookings hold this event id.
 *
 * Run: npm run test:removal  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { removalMode } from "./calendar-removal";

test("an event held by one booking is that booking's own — cancel it whole", () => {
  // Cheslon's shape: a series whose bookings each carry a standalone event.
  // `recurringSeriesId` is set, so the old branch reached for the occurrence delete
  // on an id that has no occurrences.
  assert.equal(removalMode(1), "whole-event");
});

test("an event shared by siblings is a series master — remove only the occurrence", () => {
  // The post-refactor shape: every booking in the series holds the master id.
  // Cancelling the master here would take every session with it.
  assert.equal(removalMode(2), "occurrence");
  assert.equal(removalMode(25), "occurrence");
});

test("an impossible count fails in the harmless direction", () => {
  // 0 should not happen — the booking being removed holds the id itself. If it
  // does, prefer the mistake that destroys nothing: deleting one occurrence from a
  // non-master is a no-op, cancelling a master takes the whole series.
  assert.equal(removalMode(0), "whole-event");
});
