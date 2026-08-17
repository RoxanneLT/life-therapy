/**
 * Redirect-target validation — the strings an attacker actually sends.
 *
 * Four call sites each hand-rolled `next.startsWith("/")` and all four were
 * bypassable, two of them without a leading slash at all. These fixtures are the
 * bypasses themselves, so a future "simplification" back to a startsWith check
 * fails here rather than in someone's inbox.
 *
 * Run: npm run test:redirect  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath, safeRedirectUrl } from "./safe-redirect";

const ORIGIN = "https://life-therapy.co.za";

test("the userinfo trick cannot rewrite the host", () => {
  // `${origin}${next}` produced https://life-therapy.co.za@evil.com — host evil.com.
  assert.equal(safeNextPath("@evil.com", "/portal"), "/portal");
  assert.equal(safeRedirectUrl("@evil.com", ORIGIN, "/portal").host, "life-therapy.co.za");
});

test("a suffixed domain cannot masquerade as ours", () => {
  // https://life-therapy.co.za.evil.com — an attacker subdomain that reads right.
  assert.equal(safeNextPath(".evil.com", "/portal"), "/portal");
  assert.equal(safeRedirectUrl(".evil.com", ORIGIN, "/portal").host, "life-therapy.co.za");
});

test("protocol-relative targets are refused", () => {
  for (const evil of ["//evil.com", "/\\evil.com", "///evil.com"]) {
    assert.equal(safeNextPath(evil, "/portal"), "/portal", `${evil} must not pass`);
    assert.equal(safeRedirectUrl(evil, ORIGIN, "/portal").host, "life-therapy.co.za");
  }
});

test("absolute URLs are refused even to our own domain", () => {
  // Nothing legitimate passes one, and allowing it invites a scheme swap.
  assert.equal(safeNextPath("https://life-therapy.co.za/portal", "/portal"), "/portal");
  assert.equal(safeNextPath("javascript:alert(1)", "/portal"), "/portal");
});

test("header-splitting characters are refused, not stripped", () => {
  assert.equal(safeNextPath("/portal\r\nSet-Cookie: a=b", "/portal"), "/portal");
  assert.equal(safeNextPath("/portal\nX-Injected: 1", "/portal"), "/portal");
});

test("the destinations the app actually uses still work", () => {
  // The whole point is that the legitimate flows keep functioning.
  assert.equal(safeNextPath("/reset-password", "/portal"), "/reset-password");
  assert.equal(safeNextPath("/portal/bookings?tab=upcoming", "/portal"), "/portal/bookings?tab=upcoming");
  assert.equal(
    safeRedirectUrl("/reset-password", ORIGIN, "/portal").toString(),
    "https://life-therapy.co.za/reset-password",
  );
});

test("an absent target falls back", () => {
  assert.equal(safeNextPath(null, "/portal"), "/portal");
  assert.equal(safeNextPath(undefined, "/portal"), "/portal");
  assert.equal(safeNextPath("", "/portal"), "/portal");
});
