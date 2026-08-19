/**
 * The fixture that matters is the first one: `seanteres9@gmailcom` shipped, was sent,
 * and was refused by the provider. Everything else here exists so the rule that catches
 * it cannot be tightened into rejecting a real client's address.
 *
 * Run: npm run test:email-address (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeliverableEmail, emailRefusal } from "./email-address";

test("the address that actually failed is rejected", () => {
  // No dot before `com`. Valid per HTML5 `type="email"`, refused by the mail provider.
  assert.equal(isDeliverableEmail("seanteres9@gmailcom"), false);
  // The same address, correct, must pass — the fix is one character.
  assert.equal(isDeliverableEmail("seanteres9@gmail.com"), true);
});

test("ordinary addresses are accepted", () => {
  // The negative-space half. A validator that rejects a real address costs more than
  // the bug it prevents, because it blocks booking a session for a real client.
  for (const ok of [
    "cassiel@cassiel.org",
    "hello@life-therapy.co.za",
    "first.last@sub.domain.co.za",
    "user+tag@gmail.com",
    "a@b.io",
    "someone@x-y-z.com",
  ]) {
    assert.equal(isDeliverableEmail(ok), true, `should accept ${ok}`);
  }
});

test("the shapes a typo actually takes", () => {
  for (const bad of [
    "seanteres9@gmailcom", // the incident
    "sean@gmail", // no TLD at all
    "sean@gmail.c", // single-character final label
    "seangmail.com", // no @
    "sean@@gmail.com", // two @
    "sean @gmail.com", // space in the local part
    "sean@gmail .com", // space in the domain
    " sean@gmail.com", // leading whitespace — a paste artefact
    "sean@gmail.com ", // trailing whitespace
    "sean@.com", // empty domain label
    "@gmail.com", // no local part
  ]) {
    assert.equal(isDeliverableEmail(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

test("absent is not the same question as malformed", () => {
  // The partner email is optional. Empty must not produce a refusal — only a value
  // that was typed and cannot work.
  assert.equal(emailRefusal("", "Partner email"), null);
  assert.equal(emailRefusal(null, "Partner email"), null);
  assert.equal(emailRefusal(undefined, "Partner email"), null);
  assert.equal(emailRefusal("   ", "Partner email"), null);
});

test("a refusal names the field and quotes the value back", () => {
  const r = emailRefusal("seanteres9@gmailcom", "Partner email");
  assert.ok(r, "should refuse");
  assert.match(r, /Partner email/);
  // Quoting the value is the point: the admin cannot see the typo without it.
  assert.match(r, /seanteres9@gmailcom/);
});
