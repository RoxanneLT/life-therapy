/**
 * The re-verification gate on calendar repairs.
 *
 * Approval and execution are separated in time, and anything can happen in the gap: the
 * event is deleted in Outlook, the booking is cancelled, someone rebuilds the series, or
 * the page is simply left open and the button pressed an hour later. isStillProposed is
 * what stops a stale approval acting on a world that no longer exists.
 *
 * It is also the second enforcement of the wrong-day guard: a protected ghost never
 * carries proposal "delete", so an approval naming one can never be honoured — including
 * a hand-crafted request that never went near the UI.
 *
 * Run: npm run test:apply  (part of `npm run check`)
 */
import "./test-tz";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  isStillProposed,
  type ClassifyBooking,
  type ClassifyEvent,
  type RepairItem,
} from "./calendar-classify";

const bk = (
  over: Partial<ClassifyBooking> & Pick<ClassifyBooking, "id" | "date" | "clientName">,
): ClassifyBooking => ({
  startTime: "11:30",
  endTime: "12:30",
  graphEventId: null,
  isRecurring: false,
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

// ── The stale-approval replay ───────────────────────────────────────────────

test("STALE APPROVAL: a ghost deleted in Outlook after approval is no longer applied", () => {
  // At approval time the ghost exists and is proposed for deletion.
  const atApproval = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "Lisa Toms", graphEventId: "owned" })],
    [
      ev({ id: "owned", date: "2026-08-11", clientName: "Lisa Toms" }),
      ev({ id: "ghost", date: "2026-09-01", clientName: "Lisa Toms" }),
    ],
  );
  const approved: RepairItem = { action: "delete", graphEventId: "ghost" };
  assert.equal(isStillProposed(approved, atApproval), true, "valid when approved");

  // Someone removes it by hand before Apply is pressed.
  const atExecution = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "Lisa Toms", graphEventId: "owned" })],
    [ev({ id: "owned", date: "2026-08-11", clientName: "Lisa Toms" })],
  );
  assert.equal(
    isStillProposed(approved, atExecution),
    false,
    "the approval must NOT be honoured against changed state",
  );
});

test("STALE APPROVAL: a booking that gained an event is no longer created", () => {
  const atApproval = classify([bk({ id: "b1", date: "2026-08-11", clientName: "Joe de Wet" })], []);
  const approved: RepairItem = { action: "create", bookingId: "b1" };
  assert.equal(isStillProposed(approved, atApproval), true);

  // The series was rebuilt (or the event created another way) in the meantime.
  const atExecution = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "Joe de Wet" })],
    [ev({ id: "new", date: "2026-08-11", clientName: "Joe de Wet" })],
  );
  assert.equal(isStillProposed(approved, atExecution), false, "no longer missing → skip");
});

test("STALE APPROVAL: a ghost that became PROTECTED is no longer deletable", () => {
  // The nastiest replay: at approval the client was healthy so their stray event was a
  // safe duplicate. By execution the client has an eventless session, which makes that
  // same event a suspected wrong-day twin — exactly the July incident.
  const approved: RepairItem = { action: "delete", graphEventId: "stray" };

  const healthy = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "Mia Pretorius", graphEventId: "owned" })],
    [
      ev({ id: "owned", date: "2026-08-11", clientName: "Mia Pretorius" }),
      ev({ id: "stray", date: "2026-09-01", clientName: "Mia Pretorius" }),
    ],
  );
  assert.equal(isStillProposed(approved, healthy), true, "safe while the client is healthy");

  const brokenSince = classify(
    [
      bk({ id: "b1", date: "2026-08-11", clientName: "Mia Pretorius", graphEventId: "owned" }),
      bk({ id: "b2", date: "2026-08-18", clientName: "Mia Pretorius", graphEventId: "owned" }),
    ],
    [
      ev({ id: "owned", date: "2026-08-11", clientName: "Mia Pretorius" }),
      ev({ id: "stray", date: "2026-09-01", clientName: "Mia Pretorius" }),
    ],
  );
  assert.equal(
    isStillProposed(approved, brokenSince),
    false,
    "the guard re-applies at execution — a wrong-day twin is never deleted",
  );
});

// ── Hand-crafted requests ───────────────────────────────────────────────────

test("a protected ghost can NEVER be applied, even if the request names it directly", () => {
  // Nothing in the UI offers this; the check is here for a request that bypasses it.
  const fresh = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "Chanene Norman" })],
    [ev({ id: "wrong-day", date: "2026-08-12", clientName: "Chanene Norman" })],
  );
  assert.equal(fresh.orphaned[0].deletable, false);
  assert.equal(
    isStillProposed({ action: "delete", graphEventId: "wrong-day" }, fresh),
    false,
  );
});

test("an unknown id is never applied", () => {
  const fresh = classify([], []);
  assert.equal(isStillProposed({ action: "delete", graphEventId: "nope" }, fresh), false);
  assert.equal(isStillProposed({ action: "create", bookingId: "nope" }, fresh), false);
});

test("a recurring gap is never proposed for create, so it cannot be applied as one", () => {
  // Creating a lone occurrence forks the series; the only repair is a series rebuild.
  const fresh = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "X", isRecurring: true })],
    [],
  );
  assert.equal(fresh.missing[0].proposal, "reschedule_series");
  assert.equal(isStillProposed({ action: "create", bookingId: "b1" }, fresh), false);
});

// ── The happy path still works ──────────────────────────────────────────────

test("an unchanged approval is applied", () => {
  const fresh = classify(
    [bk({ id: "b1", date: "2026-08-11", clientName: "Lisa Toms", graphEventId: "owned" })],
    [
      ev({ id: "owned", date: "2026-08-11", clientName: "Lisa Toms" }),
      ev({ id: "ghost", date: "2026-09-01", clientName: "Lisa Toms" }),
    ],
  );
  assert.equal(isStillProposed({ action: "delete", graphEventId: "ghost" }, fresh), true);
});

test("an approved duplicate deletion survives re-verification", () => {
  const fresh = classify(
    [bk({ id: "b1", date: "2026-07-23", clientName: "Mia Pretorius", graphEventId: "master" })],
    [
      ev({ id: "occ", date: "2026-07-23", clientName: "Mia Pretorius", seriesMasterId: "master" }),
      ev({ id: "manual", date: "2026-07-23", clientName: "Mia Pretorius" }),
    ],
  );
  assert.equal(fresh.duplicates[0].graphEventId, "manual");
  assert.equal(isStillProposed({ action: "delete", graphEventId: "manual" }, fresh), true);
});
