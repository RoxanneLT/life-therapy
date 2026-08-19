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
import { injectTracking, isTrackableTarget, classifyTrackedTarget } from "./email-tracking";

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

// ── The reader: what the redirector will forward ──────────────────────────────
// The lookup is injected, so these run without a database. `known` stands for
// "this exact string is stored as a booking's teamsMeetingUrl".

const KNOWN = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_real%40thread.v2/0";
const lookup = async (url: string) => url === KNOWN;
const nothingKnown = async () => false;

test("a link to our own host is forwarded without any lookup", async () => {
  let asked = false;
  const v = await classifyTrackedTarget("https://life-therapy.co.za/portal", async () => {
    asked = true;
    return false;
  });
  assert.deepEqual(v, { forward: true, reason: "our-host" });
  assert.equal(asked, false, "our own hosts must not cost a database round trip");
});

test("a Teams link we actually hold is forwarded — the legacy inbox repair", async () => {
  const v = await classifyTrackedTarget(KNOWN, lookup);
  assert.deepEqual(v, { forward: true, reason: "known-meeting" });
});

test("a Teams link we do NOT hold is still refused", async () => {
  // The whole security property: being on teams.microsoft.com earns nothing.
  const v = await classifyTrackedTarget(
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_attacker%40thread.v2/0",
    lookup,
  );
  assert.deepEqual(v, { forward: false, reason: "untrusted" });
});

test("an arbitrary external site is refused even when the lookup is generous", async () => {
  // A lookup that says yes to everything must not be able to open the redirector
  // to a non-meeting host by itself — but it IS the only gate for foreign hosts,
  // so this asserts the shape we depend on: the real lookup is an exact match
  // against stored Teams URLs, and nothing else may be substituted for it.
  const v = await classifyTrackedTarget("https://evil.example.com/phish", nothingKnown);
  assert.deepEqual(v, { forward: false, reason: "untrusted" });
});

test("a non-http scheme is refused before any lookup", async () => {
  let asked = false;
  const v = await classifyTrackedTarget("javascript:alert(1)", async () => {
    asked = true;
    return true;
  });
  assert.deepEqual(v, { forward: false, reason: "bad-protocol" });
  assert.equal(asked, false, "a bad scheme must never reach the database");
});

test("an unparseable target is refused and named as such", async () => {
  const v = await classifyTrackedTarget("not a url", lookup);
  assert.deepEqual(v, { forward: false, reason: "unparseable" });
});

test("the repair does not re-open the wrapper", async () => {
  // The reader forgives what the writer must never produce again. If this fails,
  // new emails have started carrying wrapped Teams links once more.
  assert.equal(isTrackableTarget(KNOWN), false);
  const out = injectTracking(`<a href="${KNOWN}">Join</a>`, "t", BASE);
  assert.ok(out.includes(`href="${KNOWN}"`), "still sent raw, still untracked");
});
