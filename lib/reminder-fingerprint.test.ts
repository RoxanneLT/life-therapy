import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderDue, reminderFingerprint } from "./reminder-fingerprint";

const booking = {
  date: new Date("2026-09-30T00:00:00.000Z"),
  startTime: "13:00",
  teamsMeetingUrl: "https://teams.microsoft.com/l/meetup-join/old",
};
const sent = new Date("2026-09-29T12:00:07.077Z");

test("never sent → due", () => {
  assert.equal(reminderDue(null, null, reminderFingerprint("email", booking)), true);
});

test("sent for exactly this session → not due", () => {
  const fp = reminderFingerprint("email", booking);
  assert.equal(reminderDue(sent, fp, fp), false);
});

test("INCIDENT 2026-09-30: sent for 30 Sep, booking now on 1 Oct → due again", () => {
  const sentFor = reminderFingerprint("email", booking);
  const moved = { ...booking, date: new Date("2026-10-01T00:00:00.000Z") };
  assert.equal(reminderDue(sent, sentFor, reminderFingerprint("email", moved)), true);
});

test("same day, new start time → due again, for every kind", () => {
  const later = { ...booking, startTime: "15:00" };
  for (const kind of ["email", "whatsapp24h", "whatsappImminent"] as const) {
    assert.equal(reminderDue(sent, reminderFingerprint(kind, booking), reminderFingerprint(kind, later)), true, kind);
  }
});

test("a recreated meeting (new Teams link) re-sends the EMAIL — the old link in it is dead", () => {
  const relinked = { ...booking, teamsMeetingUrl: "https://teams.microsoft.com/l/meetup-join/new" };
  assert.equal(reminderDue(sent, reminderFingerprint("email", booking), reminderFingerprint("email", relinked)), true);
});

test("…but NOT the WhatsApp reminders, which only name the day and time", () => {
  const relinked = { ...booking, teamsMeetingUrl: "https://teams.microsoft.com/l/meetup-join/new" };
  for (const kind of ["whatsapp24h", "whatsappImminent"] as const) {
    assert.equal(reminderDue(sent, reminderFingerprint(kind, booking), reminderFingerprint(kind, relinked)), false, kind);
  }
});

test("a legacy stamp with no fingerprint counts as current — the deploy re-sends nothing", () => {
  const moved = { ...booking, date: new Date("2026-10-01T00:00:00.000Z") };
  assert.equal(reminderDue(sent, null, reminderFingerprint("email", moved)), false);
});
