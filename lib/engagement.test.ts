/**
 * The tier table is the load-bearing part. An unsubscribed client must not get a
 * birthday wish, and must still be told their paid credits are expiring — those two
 * pull in opposite directions and a single "is this marketing?" flag gets one of
 * them wrong.
 *
 * Run: npm run test:engagement (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideCold,
  isAutoPaused,
  mayReceiveMarketing,
  mayReceiveGoodwill,
  mayReceiveAccountNotice,
  COLD_THRESHOLD,
} from "./engagement";

const base = {
  consentGiven: true,
  emailOptOut: false,
  emailPaused: false,
  emailPauseReason: null as string | null,
  clientStatus: "active",
};
const autoPaused = { ...base, emailPaused: true, emailPauseReason: "5_consecutive_unopened" };
const humanPaused = { ...base, emailPaused: true, emailPauseReason: "asked to stop for now" };
const unsubscribed = { ...base, emailOptOut: true };
const noConsent = { ...base, consentGiven: false };
const archived = { ...base, clientStatus: "archived" };

test("an auto-paused client still gets a birthday wish, but no marketing", () => {
  // The incident: the practice owner was auto-paused in March and her own system
  // stopped wishing her happy birthday.
  assert.equal(mayReceiveGoodwill(autoPaused), true);
  assert.equal(mayReceiveMarketing(autoPaused), false);
});

test("an unsubscribed client gets NO birthday wish", () => {
  // Explicitly requested: nobody who said "stop emailing me" wants a cheerful
  // birthday note as the exception.
  assert.equal(mayReceiveGoodwill(unsubscribed), false);
  assert.equal(mayReceiveMarketing(unsubscribed), false);
});

test("an unsubscribed client IS still told their credits are expiring", () => {
  // Their own money. You cannot unsubscribe from that.
  assert.equal(mayReceiveAccountNotice(unsubscribed), true);
  assert.equal(mayReceiveAccountNotice(autoPaused), true);
  assert.equal(mayReceiveAccountNotice(noConsent), true);
});

test("a pause a person applied is honoured everywhere marketing and goodwill are", () => {
  // Only the automatic reason is set aside. A human pause means a human decided.
  assert.equal(isAutoPaused(humanPaused), false);
  assert.equal(mayReceiveGoodwill(humanPaused), false);
  assert.equal(mayReceiveMarketing(humanPaused), false);
});

test("the auto-pause reason is matched as a pattern, not a fixed string", () => {
  // The reason embeds the threshold. Rows written as "5_consecutive_unopened" must
  // keep matching if COLD_THRESHOLD ever becomes 6, or every one of them silently
  // reclassifies as a human decision and those clients lose their birthday wish.
  assert.equal(isAutoPaused({ emailPaused: true, emailPauseReason: "5_consecutive_unopened" }), true);
  assert.equal(isAutoPaused({ emailPaused: true, emailPauseReason: "7_consecutive_unopened" }), true);
  assert.equal(isAutoPaused({ emailPaused: true, emailPauseReason: "manual" }), false);
  assert.equal(isAutoPaused({ emailPaused: true, emailPauseReason: null }), false);
  // Not paused at all is not auto-paused, whatever a stale reason says.
  assert.equal(isAutoPaused({ emailPaused: false, emailPauseReason: "5_consecutive_unopened" }), false);
});

test("consent is required for marketing and goodwill, never for account notices", () => {
  assert.equal(mayReceiveMarketing(noConsent), false);
  assert.equal(mayReceiveGoodwill(noConsent), false);
});

test("an ordinary client gets everything", () => {
  assert.equal(mayReceiveMarketing(base), true);
  assert.equal(mayReceiveGoodwill(base), true);
  assert.equal(mayReceiveAccountNotice(base), true);
});

// ── The cold decision ────────────────────────────────────────────────────────

const facts = {
  trackedCount: COLD_THRESHOLD,
  anyOpened: false,
  anyClicked: false,
  hasRecentActivity: false,
};

test("five unopened with nothing else is still cold", () => {
  // The rule has to keep working, or this is not a fix but a deletion.
  assert.equal(decideCold(facts).cold, true);
  assert.equal(decideCold(facts).reason, "5_consecutive_unopened");
});

test("a click beats a missing pixel", () => {
  // The whole point: an image blocker can suppress an open into non-existence.
  // It cannot suppress a click, because a click is a real request from a human.
  assert.equal(decideCold({ ...facts, anyClicked: true }).cold, false);
});

test("real activity in the account beats a missing pixel", () => {
  assert.equal(decideCold({ ...facts, hasRecentActivity: true }).cold, false);
});

test("an open still counts", () => {
  assert.equal(decideCold({ ...facts, anyOpened: true }).cold, false);
});

test("too few tracked emails is never cold", () => {
  // Judging someone on two emails is judging the sample, not the person.
  const v = decideCold({ ...facts, trackedCount: COLD_THRESHOLD - 1 });
  assert.equal(v.cold, false);
  assert.match(v.reason, /too few/);
});

test("the cold reason is the string the pause records", () => {
  // decideCold's reason is written to emailPauseReason, and isAutoPaused has to
  // recognise it. If these two drift, an auto-pause reads as a human decision.
  const v = decideCold(facts);
  assert.equal(isAutoPaused({ emailPaused: true, emailPauseReason: v.reason }), true);
});

test("an archived client receives no marketing and no goodwill", () => {
  // Archived means the practice has ended the relationship — the strongest signal here,
  // and the only one that is OURS rather than the client's. One archived client was
  // sitting at step 3 of "Welcome Back: Inactive Clients", due two more invitations to
  // return, because enrolment happens once and never re-checks.
  assert.equal(mayReceiveMarketing(archived), false);
  assert.equal(mayReceiveGoodwill(archived), false);
});

test("an archived client is STILL told about their own money", () => {
  // Ending the relationship does not erase what they paid for. Credits expiring, an
  // invoice outstanding — those are theirs, and archiving is our decision, not a waiver.
  assert.equal(mayReceiveAccountNotice(), true);
});

test("archived beats every other flag, in both directions", () => {
  // A perfectly consenting, unpaused, opted-in archived client still gets nothing
  // promotional; and a non-archived client is unaffected by the new condition.
  assert.equal(mayReceiveMarketing({ ...base, clientStatus: "archived" }), false);
  assert.equal(mayReceiveMarketing({ ...base, clientStatus: "inactive" }), true);
  assert.equal(mayReceiveGoodwill({ ...base, clientStatus: "potential" }), true);
});
