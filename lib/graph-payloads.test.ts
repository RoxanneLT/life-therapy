/**
 * lib/graph-payloads.ts — the booking → Graph payload contract.
 *
 * This is the layer where every calendar bug this project shipped actually lived, so
 * the matrix below is deliberately exhaustive: all seven weekdays, every recurrence
 * pattern, the range, the wall-clock times, in-person, and attendee suppression.
 *
 * Run: npm run test:payloads  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSingleEventPayload,
  buildRecurringEventPayload,
  buildRecurrence,
} from "./graph-payloads";

const SAST = "Africa/Johannesburg";

const baseSingle = {
  subject: "1:1 Individual Session — Mia Pretorius",
  startDateTime: "2026-08-11T09:00:00",
  endDateTime: "2026-08-11T10:00:00",
  clientName: "Mia Pretorius",
  clientEmail: "mia@example.com",
};

const baseRecurring = {
  ...baseSingle,
  recurrencePattern: "weekly" as const,
  seriesEndDate: "2027-07-27",
};

// ── Single events ────────────────────────────────────────────────────────────

test("single: wall-clock times are passed through with the SAST timezone on BOTH ends", () => {
  const p = buildSingleEventPayload(baseSingle);
  assert.deepEqual(p.start, { dateTime: "2026-08-11T09:00:00", timeZone: SAST });
  assert.deepEqual(p.end, { dateTime: "2026-08-11T10:00:00", timeZone: SAST });
});

test("single: defaults to a Teams online meeting", () => {
  const p = buildSingleEventPayload(baseSingle);
  assert.equal(p.isOnlineMeeting, true);
  assert.equal(p.onlineMeetingProvider, "teamsForBusiness");
});

test("single: in-person omits BOTH online-meeting keys", () => {
  const p = buildSingleEventPayload({ ...baseSingle, isOnlineMeeting: false });
  assert.ok(!("isOnlineMeeting" in p), "isOnlineMeeting must be absent");
  assert.ok(!("onlineMeetingProvider" in p), "onlineMeetingProvider must be absent");
});

test("single: exactly one required attendee — the client", () => {
  const p = buildSingleEventPayload(baseSingle);
  assert.equal(p.attendees?.length, 1);
  assert.deepEqual(p.attendees?.[0], {
    emailAddress: { address: "mia@example.com", name: "Mia Pretorius" },
    type: "required",
  });
});

test("single: suppressAttendees omits the attendees key entirely (no invite email)", () => {
  const p = buildSingleEventPayload({ ...baseSingle, suppressAttendees: true });
  assert.ok(!("attendees" in p), "attendees must be absent so Outlook sends no invite");
});

// ── Recurrence: the weekday matrix (the "e" vs "i" regression) ───────────────

// Seven consecutive days from a known Tuesday. Under the old locale token "e" every
// one of these would land one weekday late.
const WEEKDAYS: Array<[string, string]> = [
  ["2026-08-11T09:00:00", "tuesday"],
  ["2026-08-12T09:00:00", "wednesday"],
  ["2026-08-13T09:00:00", "thursday"],
  ["2026-08-14T09:00:00", "friday"],
  ["2026-08-15T09:00:00", "saturday"],
  ["2026-08-16T09:00:00", "sunday"],
  ["2026-08-17T09:00:00", "monday"],
];

for (const [startDateTime, expected] of WEEKDAYS) {
  test(`recurrence: ${startDateTime.slice(0, 10)} → daysOfWeek ["${expected}"]`, () => {
    const r = buildRecurrence({
      startDateTime,
      recurrencePattern: "weekly",
      seriesEndDate: "2027-07-27",
    });
    assert.deepEqual(r.pattern.daysOfWeek, [expected]);
  });
}

// ── Recurrence: patterns, interval, range ───────────────────────────────────

test("recurrence: weekly → type weekly, interval 1", () => {
  const r = buildRecurrence({ ...baseRecurring, recurrencePattern: "weekly" });
  assert.equal(r.pattern.type, "weekly");
  assert.equal(r.pattern.interval, 1);
});

test("recurrence: bimonthly → type weekly, interval 2 (every other week)", () => {
  const r = buildRecurrence({ ...baseRecurring, recurrencePattern: "bimonthly" });
  assert.equal(r.pattern.type, "weekly");
  assert.equal(r.pattern.interval, 2);
});

test("recurrence: monthly → relativeMonthly on the same weekday", () => {
  const r = buildRecurrence({ ...baseRecurring, recurrencePattern: "monthly" });
  assert.equal(r.pattern.type, "relativeMonthly");
  assert.equal(r.pattern.interval, 1);
  assert.deepEqual(r.pattern.daysOfWeek, ["tuesday"]);
});

test("recurrence: monthly week-of-month index maps across the whole month", () => {
  // days 1-7 → first, 8-14 → second, 15-21 → third, 22-28 → fourth, 29-31 → last
  const cases: Array<[string, string]> = [
    ["2026-08-04T09:00:00", "first"],
    ["2026-08-11T09:00:00", "second"],
    ["2026-08-18T09:00:00", "third"],
    ["2026-08-25T09:00:00", "fourth"],
    ["2026-08-31T09:00:00", "last"],
  ];
  for (const [startDateTime, expected] of cases) {
    const r = buildRecurrence({
      startDateTime,
      recurrencePattern: "monthly",
      seriesEndDate: "2027-07-27",
    });
    assert.equal(r.pattern.index, expected, `${startDateTime} should be ${expected}`);
  }
});

test("recurrence: range starts on the first occurrence and ends on the series end — no off-by-one", () => {
  const r = buildRecurrence(baseRecurring);
  assert.equal(r.range.type, "endDate");
  assert.equal(r.range.startDate, "2026-08-11", "startDate is the first occurrence's DAY");
  assert.equal(r.range.endDate, "2027-07-27");
});

// ── Recurring payload as a whole ────────────────────────────────────────────

test("recurring: carries the recurrence, the attendee, and the Teams flags", () => {
  const p = buildRecurringEventPayload(baseRecurring);
  assert.equal(p.subject, baseRecurring.subject);
  assert.deepEqual(p.start, { dateTime: "2026-08-11T09:00:00", timeZone: SAST });
  assert.deepEqual(p.end, { dateTime: "2026-08-11T10:00:00", timeZone: SAST });
  assert.deepEqual(p.recurrence?.pattern.daysOfWeek, ["tuesday"]);
  assert.equal(p.attendees?.length, 1);
  assert.equal(p.isOnlineMeeting, true);
});

test("recurring: in-person series omits the online-meeting keys", () => {
  const p = buildRecurringEventPayload({ ...baseRecurring, isOnlineMeeting: false });
  assert.ok(!("isOnlineMeeting" in p));
  assert.ok(!("onlineMeetingProvider" in p));
  assert.deepEqual(p.recurrence?.pattern.daysOfWeek, ["tuesday"]);
});

test("THE regression: Chanene's real Tuesday series never yields wednesday", () => {
  const p = buildRecurringEventPayload({
    ...baseRecurring,
    subject: "1:1 Individual Session — Chanene Norman",
    startDateTime: "2026-08-11T11:30:00",
    endDateTime: "2026-08-11T12:30:00",
  });
  assert.deepEqual(p.recurrence?.pattern.daysOfWeek, ["tuesday"]);
  assert.notDeepEqual(p.recurrence?.pattern.daysOfWeek, ["wednesday"]);
});
