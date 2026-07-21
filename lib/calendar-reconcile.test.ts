/**
 * lib/calendar-reconcile.ts — the reverse-pass guard (bug #5), the scar for the
 * 2026-06/07 mass-deletion incident where wrong-day recurring occurrences were deleted
 * as "ghosts" with no recreation.
 *
 * These pin the ONE decision that separates a real duplicate (safe to delete) from a
 * wrong-day twin (must be protected): does the ghost's client still have a missing
 * booking this run?
 *
 * Run: npm run test:reconcile  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normName, isGhostDeletable } from "./calendar-reconcile";

test("normName lowercases and collapses whitespace", () => {
  assert.equal(normName("  Chanene   Norman "), "chanene norman");
  assert.equal(normName("MIA Pretorius"), "mia pretorius");
});

test("guard REFUSES to delete a ghost whose client has a missing booking (Mia/Chanene)", () => {
  // The incident: the client's Tuesday bookings are eventless (missing), and the ghost is
  // the wrong-day Wednesday twin. Deleting it is the silent data loss — must be refused.
  const missing = new Set(["mia pretorius", "chanene norman"]);
  assert.equal(isGhostDeletable("mia pretorius", missing), false);
  assert.equal(isGhostDeletable("chanene norman", missing), false);
});

test("guard ALLOWS deleting a ghost whose client's bookings all matched (June cleanup)", () => {
  // Lisa/Huibri on 2026-06-24: their real events existed and matched, so missing didn't
  // include them; the deleted events were true stale duplicates. Cleanup must keep working.
  const missing = new Set(["mia pretorius"]);
  assert.equal(isGhostDeletable("lisa toms", missing), true);
  assert.equal(isGhostDeletable("huibri smith", missing), true);
});

test("replaying the incident timeline", () => {
  // June-24/25 wave: missing was empty → every ghost deletable (correct duplicate sweep).
  assert.equal(isGhostDeletable("lisa toms", new Set()), true);
  assert.equal(isGhostDeletable("angela gohre", new Set()), true);
  // Jul-09 (Mia) and today (Chanene): the affected client is in the missing set → refused.
  assert.equal(isGhostDeletable("mia pretorius", new Set(["mia pretorius"])), false);
  assert.equal(
    isGhostDeletable("chanene norman", new Set(["chanene norman", "mia pretorius"])),
    false,
  );
});
