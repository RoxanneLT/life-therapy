/**
 * Calendar lifecycle simulation — every booking operation Roxanne can perform, driven
 * through the REAL payload builders against an in-memory fake of Microsoft Graph.
 *
 * The single invariant behind this entire incident, asserted after every step:
 *
 *     the set of (date, time, client) on the calendar
 *   == the set of confirmed bookings
 *
 * What this CAN prove: our translation layer — booking → Graph payload → expanded
 * occurrences. That is exactly where every shipped bug lived (the "e" weekday token,
 * the reconciler's matching).
 *
 * What this CANNOT prove: that Graph/Outlook actually behaves the way FakeGraph models
 * it. That last mile is covered by (a) a live smoke booking after risky changes and
 * (b) the 4-hourly check-only reconcile, whose missing≈0 / orphaned=0 is the permanent
 * production invariant.
 *
 * Run: npm run test:lifecycle  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { addSaDays } from "./dates";
import { graphDayOfWeek } from "./graph-recurrence";
import {
  buildSingleEventPayload,
  buildRecurringEventPayload,
  type GraphEventBody,
  type GraphRecurrence,
} from "./graph-payloads";

// ── The fake calendar ───────────────────────────────────────────────────────

/** A materialised occurrence as calendarView would return it. */
interface Occurrence {
  eventId: string;
  subject: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  client: string;
}

const weekdayOf = (date: string) => graphDayOfWeek(new Date(`${date}T10:00:00Z`));
const timeOf = (dateTime: string) => dateTime.slice(11, 16);
const dayOf = (dateTime: string) => dateTime.slice(0, 10);
const clientOf = (subject: string) => subject.split(" — ").slice(1).join(" — ").trim();

/**
 * In-memory Microsoft Graph. Accepts the real payloads and implements only the
 * semantics we depend on: store an event, expand a recurrence into occurrences,
 * delete a single occurrence (an exception), delete a whole event/master, and list.
 */
class FakeGraph {
  private readonly events = new Map<string, GraphEventBody>();
  private readonly exceptions = new Map<string, Set<string>>();
  private seq = 0;

  /** POST /events — returns the new event id. */
  create(payload: GraphEventBody): string {
    const id = `evt-${++this.seq}`;
    this.events.set(id, payload);
    this.exceptions.set(id, new Set());
    return id;
  }

  /** DELETE /events/{id} — removes a single event, or an entire series master. */
  delete(id: string): void {
    this.events.delete(id);
    this.exceptions.delete(id);
  }

  /** Remove ONE occurrence of a series, leaving the master and its siblings intact. */
  deleteOccurrence(id: string, date: string): void {
    this.exceptions.get(id)?.add(date);
  }

  /** GET /calendarView — recurrences expanded, exceptions removed. */
  view(): Occurrence[] {
    const out: Occurrence[] = [];
    for (const [id, ev] of this.events) {
      const skip = this.exceptions.get(id) ?? new Set<string>();
      const base = {
        eventId: id,
        subject: ev.subject,
        start: timeOf(ev.start.dateTime),
        end: timeOf(ev.end.dateTime),
        client: clientOf(ev.subject),
      };
      const dates = ev.recurrence
        ? expand(ev.recurrence)
        : [dayOf(ev.start.dateTime)];
      for (const date of dates) {
        if (!skip.has(date)) out.push({ ...base, date });
      }
    }
    return out;
  }
}

/**
 * Expand a Graph recurrence into occurrence dates. Emits every date in the range whose
 * weekday is listed in `daysOfWeek`, in every `interval`-th week from the range start.
 *
 * Note it reads the date's REAL weekday — so if the payload names the wrong weekday
 * (the "e" token bug) the expansion lands on the wrong days and the invariant below
 * fails. That is precisely what makes the recurring test a real regression test.
 */
function expand(rec: GraphRecurrence): string[] {
  if (rec.pattern.type !== "weekly") {
    // relativeMonthly isn't simulated — its index mapping is asserted directly in
    // lib/graph-payloads.test.ts. Fail loudly rather than pretend to cover it.
    throw new Error(`FakeGraph: ${rec.pattern.type} expansion not simulated`);
  }
  const wanted = new Set(rec.pattern.daysOfWeek);
  const out: string[] = [];
  let date = rec.range.startDate;
  let offset = 0;
  while (date <= rec.range.endDate) {
    if (wanted.has(weekdayOf(date)) && Math.floor(offset / 7) % rec.pattern.interval === 0) {
      out.push(date);
    }
    date = addSaDays(date, 1);
    offset++;
  }
  return out;
}

// ── The invariant ───────────────────────────────────────────────────────────

interface Booking {
  date: string;
  start: string;
  end: string;
  client: string;
}

const key = (o: { date: string; start: string; end: string; client: string }) =>
  `${o.date}|${o.start}-${o.end}|${o.client}`;

/** The whole point: calendar occurrences must equal confirmed bookings, exactly. */
function assertCalendarMatches(fake: FakeGraph, bookings: Booking[], label: string) {
  const onCalendar = fake.view().map(key).sort();
  const expected = bookings.map(key).sort();
  assert.deepEqual(onCalendar, expected, `${label}: calendar ≠ bookings`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const CLIENT = "Chanene Norman";
const SUBJECT = `1:1 Individual Session — ${CLIENT}`;
/** Five consecutive Tuesdays — Chanene's real pattern. */
const TUESDAYS = ["2026-08-11", "2026-08-18", "2026-08-25", "2026-09-01", "2026-09-08"];
const booking = (date: string, client = CLIENT, start = "11:30", end = "12:30"): Booking => ({
  date,
  start,
  end,
  client,
});

function createSeries(fake: FakeGraph, dates: string[], client = CLIENT) {
  const payload = buildRecurringEventPayload({
    subject: `1:1 Individual Session — ${client}`,
    startDateTime: `${dates[0]}T11:30:00`,
    endDateTime: `${dates[0]}T12:30:00`,
    clientName: client,
    clientEmail: "client@example.com",
    recurrencePattern: "weekly",
    seriesEndDate: dates[dates.length - 1],
  });
  return fake.create(payload);
}

// ── Single-booking lifecycle ────────────────────────────────────────────────

test("single: book → the calendar shows exactly that session", () => {
  const fake = new FakeGraph();
  fake.create(
    buildSingleEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-11T11:30:00",
      endDateTime: "2026-08-11T12:30:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
    }),
  );
  assertCalendarMatches(fake, [booking("2026-08-11")], "after booking");
});

test("single: book → cancel leaves the calendar empty", () => {
  const fake = new FakeGraph();
  const id = fake.create(
    buildSingleEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-11T11:30:00",
      endDateTime: "2026-08-11T12:30:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
    }),
  );
  fake.delete(id);
  assertCalendarMatches(fake, [], "after cancel");
});

test("single: reschedule moves the session and leaves NO duplicate", () => {
  const fake = new FakeGraph();
  const id = fake.create(
    buildSingleEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-11T11:30:00",
      endDateTime: "2026-08-11T12:30:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
    }),
  );
  // Reschedule = delete the old event, create the new one.
  fake.delete(id);
  fake.create(
    buildSingleEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-13T14:00:00",
      endDateTime: "2026-08-13T15:00:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
    }),
  );
  assertCalendarMatches(
    fake,
    [booking("2026-08-13", CLIENT, "14:00", "15:00")],
    "after reschedule",
  );
  assert.equal(fake.view().length, 1, "exactly one event — no ghost left behind");
});

// ── Recurring series ────────────────────────────────────────────────────────

test("recurring: THE regression — expanded occurrences land on the booking weekdays", () => {
  // This is the test that fails under the old "e" token: the payload would say
  // "wednesday", the expansion would emit Wednesdays, and the invariant would break.
  const fake = new FakeGraph();
  createSeries(fake, TUESDAYS);
  assertCalendarMatches(fake, TUESDAYS.map((d) => booking(d)), "after series create");
  for (const occ of fake.view()) {
    assert.equal(weekdayOf(occ.date), "tuesday", `${occ.date} must be a Tuesday`);
  }
});

test("recurring: bimonthly yields every OTHER week", () => {
  const fake = new FakeGraph();
  fake.create(
    buildRecurringEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-11T11:30:00",
      endDateTime: "2026-08-11T12:30:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
      recurrencePattern: "bimonthly",
      seriesEndDate: "2026-09-08",
    }),
  );
  assertCalendarMatches(
    fake,
    ["2026-08-11", "2026-08-25", "2026-09-08"].map((d) => booking(d)),
    "bimonthly",
  );
});

test("recurring: skipping a holiday removes ONLY that occurrence", () => {
  const fake = new FakeGraph();
  const id = createSeries(fake, TUESDAYS);
  fake.deleteOccurrence(id, "2026-08-25"); // public holiday
  const remaining = TUESDAYS.filter((d) => d !== "2026-08-25");
  assertCalendarMatches(fake, remaining.map((d) => booking(d)), "after holiday skip");
});

test("recurring: cancel ONE occurrence — siblings untouched (CLAUDE.md pitfall #7)", () => {
  const fake = new FakeGraph();
  const id = createSeries(fake, TUESDAYS);
  fake.deleteOccurrence(id, "2026-08-18");
  const remaining = TUESDAYS.filter((d) => d !== "2026-08-18");
  assertCalendarMatches(fake, remaining.map((d) => booking(d)), "after cancelling one");
  assert.equal(fake.view().length, 4, "the rest of the series survives");
});

test("recurring: reschedule ONE occurrence — that date moves, the series stays", () => {
  const fake = new FakeGraph();
  const id = createSeries(fake, TUESDAYS);
  // Move 2026-08-18 to the Thursday at 14:00: drop the occurrence, add a standalone.
  fake.deleteOccurrence(id, "2026-08-18");
  fake.create(
    buildSingleEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-20T14:00:00",
      endDateTime: "2026-08-20T15:00:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
    }),
  );
  const expected = [
    ...TUESDAYS.filter((d) => d !== "2026-08-18").map((d) => booking(d)),
    booking("2026-08-20", CLIENT, "14:00", "15:00"),
  ];
  assertCalendarMatches(fake, expected, "after moving one occurrence");
});

test("recurring: reschedule ALL — old series fully gone, new day throughout", () => {
  const fake = new FakeGraph();
  const id = createSeries(fake, TUESDAYS);
  fake.delete(id); // drop the whole master
  const wednesdays = TUESDAYS.map((d) => addSaDays(d, 1));
  createSeries(fake, wednesdays);
  assertCalendarMatches(fake, wednesdays.map((d) => booking(d)), "after reschedule-all");
  for (const occ of fake.view()) {
    assert.equal(weekdayOf(occ.date), "wednesday");
  }
});

test("recurring: cancel ALL — that client is cleared, other clients untouched", () => {
  const fake = new FakeGraph();
  const mine = createSeries(fake, TUESDAYS);
  createSeries(fake, ["2026-08-13", "2026-08-20"], "Lisa Toms"); // a different client
  fake.delete(mine);
  const lisa = ["2026-08-13", "2026-08-20"].map((d) => booking(d, "Lisa Toms"));
  assertCalendarMatches(fake, lisa, "after cancel-all for one client");
  assert.ok(
    fake.view().every((o) => o.client === "Lisa Toms"),
    "no trace of the cancelled client remains",
  );
});

test("recurring: removing every occurrence leaves no orphan on the calendar", () => {
  const fake = new FakeGraph();
  const id = createSeries(fake, TUESDAYS);
  for (const d of TUESDAYS) fake.deleteOccurrence(id, d);
  assertCalendarMatches(fake, [], "all occurrences removed");
  fake.delete(id); // master cleaned up
  assertCalendarMatches(fake, [], "master deleted");
});

test("in-person series still expands onto the right weekdays (no Teams keys)", () => {
  const fake = new FakeGraph();
  fake.create(
    buildRecurringEventPayload({
      subject: SUBJECT,
      startDateTime: "2026-08-11T11:30:00",
      endDateTime: "2026-08-11T12:30:00",
      clientName: CLIENT,
      clientEmail: "c@example.com",
      recurrencePattern: "weekly",
      seriesEndDate: "2026-08-25",
      isOnlineMeeting: false,
    }),
  );
  assertCalendarMatches(
    fake,
    ["2026-08-11", "2026-08-18", "2026-08-25"].map((d) => booking(d)),
    "in-person series",
  );
});
