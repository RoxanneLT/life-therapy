/**
 * The first test is the incident: a Teams "Join your session" link, wrapped by
 * the tracker, pointing at a redirector that refuses every foreign host — so the
 * client clicked Join and got `{"error":"Untrusted URL"}` (§6, 2026-08-19).
 *
 * The second is the one that keeps the fix honest. A suite that only proves
 * "external links are left alone" would also pass if the wrapper stopped
 * wrapping anything at all, and click tracking would silently die.
 *
 * Run: npm run test:tracking (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { injectTracking, isTrackableTarget } from "./email-tracking";

const TEAMS = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0";
const BASE = "https://life-therapy.co.za";

test("an external link is left exactly as it was", () => {
  const html = `<a href="${TEAMS}">Join your session</a>`;
  const out = injectTracking(html, "tid-1", BASE);
  assert.ok(out.includes(`href="${TEAMS}"`), "the Teams link must reach the client untouched");
  assert.ok(!out.includes("/api/track/click"), "and must not be wrapped");
});

test("our own links are still tracked", () => {
  // The negative-space half: without this, deleting the wrapper entirely passes.
  const html = `<a href="https://life-therapy.co.za/portal/bookings">My bookings</a>`;
  const out = injectTracking(html, "tid-2", BASE);
  assert.ok(out.includes("/api/track/click?t=tid-2&url="), "internal links keep click tracking");
  assert.ok(
    out.includes(encodeURIComponent("https://life-therapy.co.za/portal/bookings")),
    "with the destination encoded"
  );
});

test("both domains count as ours, not just the SA one", () => {
  // The dual-domain trap: a hand-written host list once had .co.za and not
  // .online, which made every international client's links the foreign ones.
  const out = injectTracking(`<a href="https://life-therapy.online/portal">P</a>`, "t", BASE);
  assert.ok(out.includes("/api/track/click"), "life-therapy.online is ours too");
});

test("the pixel is injected either way", () => {
  const external = injectTracking(`<a href="${TEAMS}">J</a>`, "t", BASE);
  assert.ok(external.includes("/api/track/open?t=t"), "open tracking survives an external-only email");
});

test("unsubscribe and track links are never re-wrapped", () => {
  const html = `<a href="${BASE}/api/unsubscribe?e=x">Unsubscribe</a>`;
  assert.equal(injectTracking(html, "t", BASE).includes("/api/track/click"), false);
});

test("isTrackableTarget agrees with what the redirector accepts", () => {
  assert.equal(isTrackableTarget("https://life-therapy.co.za/x"), true);
  assert.equal(isTrackableTarget("https://www.life-therapy.online/x"), true);
  assert.equal(isTrackableTarget(TEAMS), false);
  assert.equal(isTrackableTarget("https://paystack.com/pay/abc"), false);
  // Not a URL at all, and a non-http scheme: the redirector rejects both, so
  // wrapping either would only change which error the client reads.
  assert.equal(isTrackableTarget("not a url"), false);
  assert.equal(isTrackableTarget("javascript:alert(1)"), false);
});

test("a lookalike domain is not ours", () => {
  // endsWith(`.${host}`) must not be reachable by suffix alone.
  assert.equal(isTrackableTarget("https://life-therapy.co.za.evil.com/x"), false);
  assert.equal(isTrackableTarget("https://notlife-therapy.co.za/x"), false);
});
