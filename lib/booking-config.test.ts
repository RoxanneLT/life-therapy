/**
 * An override opens a day at slot start times the admin ticked, and `parseSlotStartTimes` is the
 * only way one enters the system. The first test is the known-good half — every real slot time
 * survives, so the parse cannot be a filter that refuses everything and reports a quiet day.
 * The rest are the refusals and the two normalisations the stored value depends on.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_SLOT_START_TIMES, parseSlotStartTimes } from "./booking-config";

test("every real slot start time survives the parse", () => {
  assert.deepEqual(
    parseSlotStartTimes(ALLOWED_SLOT_START_TIMES),
    [...ALLOWED_SLOT_START_TIMES],
  );
  assert.deepEqual(parseSlotStartTimes("09:00,15:30"), ["09:00", "15:30"]);
});

test("a time no slot starts at is dropped, not corrected", () => {
  // 09:30 is a real clock time and not a slot: an override naming it would open the day to
  // nothing, which is indistinguishable from a day that is simply fully booked.
  assert.deepEqual(parseSlotStartTimes("09:30"), []);
  assert.deepEqual(parseSlotStartTimes("09:00,09:30"), ["09:00"]);
  assert.deepEqual(parseSlotStartTimes("9:00"), []);
  assert.deepEqual(parseSlotStartTimes("tomorrow"), []);
  assert.deepEqual(parseSlotStartTimes(""), []);
});

test("the result is ordered by the slot list, not by the order they were clicked", () => {
  assert.deepEqual(parseSlotStartTimes("15:30,09:00,11:30"), ["09:00", "11:30", "15:30"]);
});

test("duplicates collapse, so two overlapping ticks are one open slot", () => {
  assert.deepEqual(parseSlotStartTimes("13:00,13:00, 13:00"), ["13:00"]);
});

test("surrounding whitespace is not what makes a time unknown", () => {
  assert.deepEqual(parseSlotStartTimes(" 09:00 , 10:15 "), ["09:00", "10:15"]);
});
