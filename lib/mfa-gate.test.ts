/**
 * The admin 2FA gate fails closed: an assurance level that cannot be read sends the admin to the
 * challenge, never into the admin area. The known-good case (AAL2 is let in) is here too, so a gate
 * that refuses everyone fails as surely as one that admits everyone.
 *
 * Run: npm run test  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mfaGateTarget } from "./mfa-gate";

const client = (result: () => Promise<{ data: { currentLevel: string | null; nextLevel: string | null } | null; error: unknown }>) => ({
  auth: { mfa: { getAuthenticatorAssuranceLevel: result } },
});
const level = (currentLevel: string | null, nextLevel: string | null) => client(async () => ({ data: { currentLevel, nextLevel }, error: null }));

test("an admin verified this session is let in", async () => {
  assert.equal(await mfaGateTarget(level("aal2", "aal2")), null);
});

test("an admin with a factor who has not stepped up is challenged", async () => {
  assert.equal(await mfaGateTarget(level("aal1", "aal2")), "/login/mfa");
});

test("an admin with no factor is sent to set one up", async () => {
  assert.equal(await mfaGateTarget(level("aal1", "aal1")), "/login/mfa/setup");
});

test("a level that cannot be read is challenged, never let in", async () => {
  // Returned, not thrown: how the lookup reports a failure, and the case the old catch never saw.
  assert.equal(await mfaGateTarget(client(async () => ({ data: null, error: new Error("session missing") }))), "/login/mfa");
  assert.equal(await mfaGateTarget(client(async () => { throw new Error("network"); })), "/login/mfa");
  assert.equal(await mfaGateTarget(level(null, null)), "/login/mfa");
});
