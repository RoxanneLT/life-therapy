/**
 * lib/calendar-classify.ts — the reconciler's matching core, tested against literal
 * fixtures that replay the REAL incidents of 2026-06/07.
 *
 * Each fixture is a scar for a wound actually shipped:
 *   1. Chanene/Mia  — Tuesday bookings vs Wednesday events → missing + PROTECTED ghosts
 *   2. June-24      — matched bookings + duplicate events → duplicates stay deletable
 *   3. Bug #3       — "… — Name (In Person)" parses to Name and matches
 *   4. Duration     — same start, wrong end → mismatched (not missing)
 *
 * Run: npm run test:classify  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  parseClientName,
  isSessionSubject,
  normName,
  type ClassifyBooking,
  type ClassifyEvent,
} from "./calendar-classify";

const bk = (
  over: Partial<ClassifyBooking> & Pick<ClassifyBooking, "id" | "date" | "clientName">,
): ClassifyBooking => ({
  startTime: "11:30",
  endTime: "12:30",
  hasGraphEvent: true,
  isRecurring: true,
  ...over,
});

const ev = (
  over: Partial<ClassifyEvent> & Pick<ClassifyEvent, "id" | "date" | "clientName">,
): ClassifyEvent => ({
  subject: `1:1 Individual Session — ${over.clientName}`,
  start: "11:30",
  end: "12:30",
  ...over,
});

// ── Subject parsing ─────────────────────────────────────────────────────────

test("parseClientName pulls the name out of a session subject", () => {
  assert.equal(parseClientName("1:1 Individual Session — Chanene Norman"), "Chanene Norman");
});

test("BUG #3: the ' (In Person)' suffix is stripped so in-person events can match", () => {
  // Admin bookings append the suffix AFTER the name. Without stripping it the parsed
  // name was "Mia Pretorius (In Person)", which never equalled the booking's name — so
  // the booking read as missing AND its real event was deleted as a ghost.
  assert.equal(
    parseClientName("1:1 Individual Session — Mia Pretorius (In Person)"),
    "Mia Pretorius",
  );
  assert.equal(parseClientName("Couples Session — A B (in person)"), "A B");
});

test("isSessionSubject ignores personal/blocked entries", () => {
  assert.equal(isSessionSubject("1:1 Individual Session — X"), true);
  assert.equal(isSessionSubject("Dentist"), false);
  assert.equal(isSessionSubject("Blocked"), false);
});

test("normName is case- and whitespace-insensitive", () => {
  assert.equal(normName("  Chanene   NORMAN "), "chanene norman");
});

// ── Fixture 1: the Chanene / Mia incident ───────────────────────────────────

test("INCIDENT: Tuesday bookings + Wednesday events → all missing, all ghosts PROTECTED", () => {
  const bookings = ["2026-08-11", "2026-08-18", "2026-08-25"].map((d, i) =>
    bk({ id: `b${i}`, date: d, clientName: "Chanene Norman" }),
  );
  // The wrong-day twins: same client and time, one day later.
  const events = ["2026-08-12", "2026-08-19", "2026-08-26"].map((d, i) =>
    ev({ id: `e${i}`, date: d, clientName: "Chanene Norman" }),
  );

  const c = classify(bookings, events);

  assert.equal(c.matched, 0, "nothing matches across a day boundary");
  assert.equal(c.missing.length, 3, "every Tuesday booking is eventless");
  assert.equal(c.orphaned.length, 3, "every Wednesday event is a ghost");
  assert.ok(
    c.orphaned.every((o) => !o.deletable),
    "THE FIX: none may be deleted — the client still has missing bookings",
  );
});

test("INCIDENT: the guard is per-client, not global", () => {
  // Chanene is broken; Lisa is healthy. Lisa's stale duplicate must still be deletable.
  const bookings = [
    bk({ id: "b1", date: "2026-08-11", clientName: "Chanene Norman" }),
    bk({ id: "b2", date: "2026-08-13", clientName: "Lisa Toms" }),
  ];
  const events = [
    ev({ id: "e1", date: "2026-08-12", clientName: "Chanene Norman" }), // wrong-day twin
    ev({ id: "e2", date: "2026-08-13", clientName: "Lisa Toms" }), // Lisa's real event
    ev({ id: "e3", date: "2026-08-20", clientName: "Lisa Toms" }), // Lisa's stale dupe
  ];

  const c = classify(bookings, events);

  const chanene = c.orphaned.find((o) => o.clientName === "Chanene Norman");
  const lisaDupe = c.orphaned.find((o) => o.date === "2026-08-20");
  assert.equal(chanene?.deletable, false, "Chanene's twin is protected");
  assert.equal(lisaDupe?.deletable, true, "Lisa's duplicate is still cleanable");
});

// ── Fixture 2: the harmless June-24 cleanup ─────────────────────────────────

test("JUNE-24: matched bookings + duplicate events → duplicates remain deletable", () => {
  // Every booking has a real matching event; the extras are genuine stale duplicates
  // from the pre-refactor one-event-per-booking format. This cleanup must keep working.
  const bookings = ["2026-08-11", "2026-08-18"].map((d, i) =>
    bk({ id: `b${i}`, date: d, clientName: "Lisa Toms" }),
  );
  const events = [
    ev({ id: "real1", date: "2026-08-11", clientName: "Lisa Toms" }),
    ev({ id: "real2", date: "2026-08-18", clientName: "Lisa Toms" }),
    ev({ id: "stale1", date: "2026-07-30", clientName: "Lisa Toms" }),
    ev({ id: "stale2", date: "2026-07-23", clientName: "Lisa Toms" }),
  ];

  const c = classify(bookings, events);

  assert.equal(c.matched, 2, "both bookings matched");
  assert.equal(c.missing.length, 0, "nothing missing → guard stays out of the way");
  assert.equal(c.orphaned.length, 2, "the two stale events are ghosts");
  assert.ok(c.orphaned.every((o) => o.deletable), "and they are still deletable");
});

// ── Fixture 3: in-person end-to-end ─────────────────────────────────────────

test("BUG #3 end-to-end: an in-person event matches its booking (no false missing/ghost)", () => {
  const bookings = [bk({ id: "b1", date: "2026-08-11", clientName: "Mia Pretorius" })];
  const events = [
    ev({
      id: "e1",
      date: "2026-08-11",
      clientName: "Mia Pretorius",
      subject: "1:1 Individual Session — Mia Pretorius (In Person)",
    }),
  ];
  // Re-parse the subject the way the reconciler does, to exercise the real path.
  events[0].clientName = parseClientName(events[0].subject);

  const c = classify(bookings, events);

  assert.equal(c.matched, 1, "in-person matches");
  assert.equal(c.missing.length, 0, "no false 'missing'");
  assert.equal(c.orphaned.length, 0, "and its real event is NOT treated as a ghost");
});

// ── Fixture 4: duration drift ───────────────────────────────────────────────

test("same start, different end → mismatched (not missing, not a ghost)", () => {
  const bookings = [bk({ id: "b1", date: "2026-08-11", clientName: "Joe de Wet" })];
  const events = [ev({ id: "e1", date: "2026-08-11", clientName: "Joe de Wet", end: "13:30" })];

  const c = classify(bookings, events);

  assert.equal(c.mismatched.length, 1);
  assert.equal(c.missing.length, 0);
  assert.equal(c.orphaned.length, 0);
  assert.equal(c.mismatched[0].bookingTime, "11:30–12:30");
  assert.equal(c.mismatched[0].outlookTime, "11:30–13:30");
});

// ── Missing reasons ─────────────────────────────────────────────────────────

test("missing carries the right reason and the recurring flag", () => {
  const bookings = [
    bk({ id: "b1", date: "2026-08-11", clientName: "A", hasGraphEvent: true, isRecurring: true }),
    bk({ id: "b2", date: "2026-08-12", clientName: "B", hasGraphEvent: false, isRecurring: false }),
  ];
  const c = classify(bookings, []);

  assert.equal(c.missing.find((m) => m.bookingId === "b1")?.reason, "event_not_found");
  assert.equal(c.missing.find((m) => m.bookingId === "b2")?.reason, "no_graph_id");
  assert.equal(c.missing.find((m) => m.bookingId === "b1")?.isRecurring, true);
  assert.equal(c.missing.find((m) => m.bookingId === "b2")?.isRecurring, false);
});

test("a clean calendar classifies as all-matched, nothing missing or orphaned", () => {
  const dates = ["2026-08-11", "2026-08-18", "2026-08-25"];
  const bookings = dates.map((d, i) => bk({ id: `b${i}`, date: d, clientName: "Anika Roberts" }));
  const events = dates.map((d, i) => ev({ id: `e${i}`, date: d, clientName: "Anika Roberts" }));

  const c = classify(bookings, events);

  assert.equal(c.matched, 3);
  assert.deepEqual(c.missing, []);
  assert.deepEqual(c.orphaned, []);
  assert.deepEqual(c.mismatched, []);
});
