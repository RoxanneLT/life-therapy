/**
 * The digest only sends when something is an issue, so `isIssue` decides what a
 * person ever hears about. An auto-pause was invisible here for months: it is not a
 * failure, not a drift count, and the job reporting it says "ok".
 *
 * Run: npm run test:digest (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isIssue } from "./cron-digest";

test("an auto-paused client is an issue even on a job that succeeded", () => {
  // The exact shape the drip job now returns: everything worked, and two clients
  // silently stopped receiving email.
  assert.equal(isIssue({ status: "ok", sent: 12, failed: 0, autoPaused: 2 }), true);
});

test("a clean run is still silent", () => {
  // The digest's whole contract: nothing wrong, no email. Breaking this turns a
  // signal into daily noise, after which nobody reads it.
  assert.equal(isIssue({ status: "ok", sent: 12, failed: 0 }), false);
  assert.equal(isIssue({ status: "ok", sent: 0, failed: 0, autoPaused: 0 }), false);
  assert.equal(isIssue({ status: "skipped" }), false);
});

test("the older signals still fire", () => {
  assert.equal(isIssue({ status: "failed" }), true);
  assert.equal(isIssue({ status: "error", error: "boom" }), true);
  assert.equal(isIssue({ status: "partial" }), true);
  assert.equal(isIssue({ status: "ok", failed: 1 }), true);
  assert.equal(isIssue({ status: "ok", observed: 3 }), true);
});
