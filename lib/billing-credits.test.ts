import { test } from "node:test";
import assert from "node:assert/strict";
import { planCredits } from "./billing-credits";

const credit = (bookingId: string, amountCents: number, currency = "ZAR") => ({
  bookingId,
  amountCents,
  currency,
  billedIn: "2026-09",
});

test("a credit within the charges is applied whole", () => {
  const r = planCredits(90000, "ZAR", [credit("a", 45000)]);
  assert.deepEqual(r.applied.map((c) => c.bookingId), ["a"]);
  assert.equal(r.totalCents, 45000);
});

test("credits may use the whole of the charges, and no more", () => {
  const r = planCredits(90000, "ZAR", [credit("a", 45000), credit("b", 45000), credit("c", 45000)]);
  assert.deepEqual(r.applied.map((c) => c.bookingId), ["a", "b"]);
  assert.equal(r.totalCents, 90000);
});

test("a credit larger than the charges waits — it is never half-applied", () => {
  const r = planCredits(30000, "ZAR", [credit("a", 45000)]);
  assert.deepEqual(r.applied, []);
  assert.equal(r.totalCents, 0);
});

test("a smaller later credit still fits after a larger one is skipped", () => {
  const r = planCredits(40000, "ZAR", [credit("big", 45000), credit("small", 20000)]);
  assert.deepEqual(r.applied.map((c) => c.bookingId), ["small"]);
});

test("a credit in another currency is never applied to this request", () => {
  const r = planCredits(90000, "ZAR", [credit("usd", 5000, "USD")]);
  assert.deepEqual(r.applied, []);
});

test("nothing to charge → nothing credited", () => {
  assert.deepEqual(planCredits(0, "ZAR", [credit("a", 100)]).applied, []);
});
