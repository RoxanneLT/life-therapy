/**
 * The first test IS the incident: a campaign activated 156 days ago, every step long past
 * its offset, and a contact who received a step two hours ago. Before this rule that
 * contact was sent the next step immediately, because the only clock consulted was the
 * schedule and the schedule had run out of opinions.
 *
 * Run: npm run test:pacing (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { stepIsDue, intendedGapDays, MIN_STEP_GAP_DAYS } from "./send-pacing";

const now = new Date("2026-08-19T18:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400 * 1000);

test("the incident: an overdue schedule does not permit a second step the same day", () => {
  // 156 days since activation, step 2 configured for day 14, previous step day 7 — so the
  // schedule says "long overdue" and says nothing useful. The contact was emailed 2h ago.
  const v = stepIsDue({
    daysSinceStart: 156,
    dayOffset: 14,
    prevDayOffset: 7,
    lastSentAt: hoursAgo(2),
    now,
  });
  assert.equal(v.due, false);
  assert.match(v.reason, /spaced 7d/);
});

test("cron frequency cannot become the cadence", () => {
  // The same contact, checked again at every 2-hourly run through one day. None may send.
  for (const h of [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]) {
    const v = stepIsDue({ daysSinceStart: 156, dayOffset: 14, prevDayOffset: 7, lastSentAt: hoursAgo(h), now });
    assert.equal(v.due, false, `a step went out ${h}h after the previous one`);
  }
});

test("once the spacing has elapsed, it sends", () => {
  const v = stepIsDue({ daysSinceStart: 156, dayOffset: 14, prevDayOffset: 7, lastSentAt: daysAgo(7), now });
  assert.equal(v.due, true);
});

test("the first step for a contact is governed by the schedule alone", () => {
  // No lastSentAt: nothing to space from, and the campaign is due.
  const v = stepIsDue({ daysSinceStart: 156, dayOffset: 0, prevDayOffset: null, lastSentAt: null, now });
  assert.equal(v.due, true);
  assert.match(v.reason, /first step/);
});

test("a step not yet reached by the schedule still waits", () => {
  // The negative-space half: without this, a rule that only ever consults lastSentAt would
  // fire every step of a NEW campaign as fast as the gap allows, ignoring its schedule.
  const v = stepIsDue({ daysSinceStart: 3, dayOffset: 14, prevDayOffset: 7, lastSentAt: daysAgo(30), now });
  assert.equal(v.due, false);
  assert.match(v.reason, /scheduled for day 14/);
});

test("two steps sharing an offset are still a day apart", () => {
  // A misconfigured campaign — offsets equal, so the configured gap is zero. The floor is
  // what makes the rule independent of how often the processor runs.
  assert.equal(intendedGapDays(14, 14), MIN_STEP_GAP_DAYS);
  const sameDay = stepIsDue({ daysSinceStart: 156, dayOffset: 14, prevDayOffset: 14, lastSentAt: hoursAgo(3), now });
  assert.equal(sameDay.due, false);
  const nextDay = stepIsDue({ daysSinceStart: 156, dayOffset: 14, prevDayOffset: 14, lastSentAt: daysAgo(1), now });
  assert.equal(nextDay.due, true);
});

test("a descending offset cannot produce a negative gap", () => {
  // Defensive: an admin reordering steps could leave step N with a smaller offset than
  // N-1. A negative gap would mean "always due", which is the burst again.
  assert.equal(intendedGapDays(7, 30), MIN_STEP_GAP_DAYS);
  const v = stepIsDue({ daysSinceStart: 156, dayOffset: 7, prevDayOffset: 30, lastSentAt: hoursAgo(1), now });
  assert.equal(v.due, false);
});

test("spacing is measured in calendar days, not 24-hour blocks", () => {
  // 23:00 Monday to 08:00 Tuesday is one calendar day but floors to zero by division —
  // which would let every step through a few hours early, every time.
  const lateMonday = new Date("2026-08-17T21:00:00Z"); // 23:00 SAST
  const tuesdayMorning = new Date("2026-08-18T06:00:00Z"); // 08:00 SAST
  const v = stepIsDue({
    daysSinceStart: 156,
    dayOffset: 1,
    prevDayOffset: 0,
    lastSentAt: lateMonday,
    now: tuesdayMorning,
  });
  assert.equal(v.due, true, "one calendar day apart should satisfy a 1-day gap");
});
