/**
 * Credit expiry — the two decisions that take money-equivalent value away.
 *
 * `hasLapsed` decides whether to ZERO a balance someone paid for, and
 * `warningDue` decides whether they hear about it first. Both are pure, so they
 * are pinned here rather than discovered on the night the job first runs.
 *
 * The case that matters most: a null `expiresAt` means "no expiry", and every
 * credit granted before the expiry window was configured has one. Reading null
 * as "expired" would wipe those balances on the first run.
 *
 * Run: npm run test:credits  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasLapsed, warningDue } from "./credit-expiry";

const TZ = process.env.TZ ?? "(host default)";
const NOW = new Date("2026-03-10T08:00:00Z"); // 10:00 SAST
const at = (iso: string) => new Date(iso);

test(`[${TZ}] a credit with no expiry date never lapses`, () => {
  assert.equal(hasLapsed({ balance: 5, expiresAt: null }, NOW), false);
  assert.equal(warningDue({ balance: 5, expiresAt: null }, NOW), null);
});

test(`[${TZ}] a zero balance is neither warned nor forfeited`, () => {
  assert.equal(hasLapsed({ balance: 0, expiresAt: at("2026-01-01T00:00:00Z") }, NOW), false);
  assert.equal(warningDue({ balance: 0, expiresAt: at("2026-03-12T00:00:00Z") }, NOW), null);
});

test(`[${TZ}] lapses on and after the moment, not before`, () => {
  assert.equal(hasLapsed({ balance: 1, expiresAt: at("2026-03-10T07:59:59Z") }, NOW), true);
  assert.equal(hasLapsed({ balance: 1, expiresAt: NOW }, NOW), true, "exactly now counts as lapsed");
  assert.equal(hasLapsed({ balance: 1, expiresAt: at("2026-03-10T08:00:01Z") }, NOW), false);
});

test(`[${TZ}] the warning windows are 3 days, then 14`, () => {
  // Distances measured in SAST calendar days, so an expiry late on the day still
  // reads as that many days away rather than one fewer.
  assert.equal(warningDue({ balance: 2, expiresAt: at("2026-03-11T09:00:00Z") }, NOW), "3d");
  assert.equal(warningDue({ balance: 2, expiresAt: at("2026-03-13T09:00:00Z") }, NOW), "3d");
  assert.equal(warningDue({ balance: 2, expiresAt: at("2026-03-14T09:00:00Z") }, NOW), "14d");
  assert.equal(warningDue({ balance: 2, expiresAt: at("2026-03-24T09:00:00Z") }, NOW), "14d");
  // Beyond the window: nothing yet.
  assert.equal(warningDue({ balance: 2, expiresAt: at("2026-03-25T09:00:00Z") }, NOW), null);
});

test(`[${TZ}] an already-lapsed credit is forfeited, never warned about`, () => {
  const lapsed = { balance: 2, expiresAt: at("2026-03-09T09:00:00Z") };
  assert.equal(hasLapsed(lapsed, NOW), true);
  assert.equal(
    warningDue(lapsed, NOW),
    null,
    "warning someone their credits 'will expire' the day after they did is worse than silence",
  );
});
