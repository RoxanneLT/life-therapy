import { test } from "node:test";
import assert from "node:assert/strict";

import { paymentShortfallCents } from "./payment-shortfall";

const order = { expectedCents: 25_000, expectedCurrency: "ZAR" };

test("the exact amount covers the order", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: 25_000, receivedCurrency: "ZAR" }), 0);
});

test("more than the amount covers the order", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: 30_000, receivedCurrency: "ZAR" }), 0);
});

test("one cent short is short — the guard is not a rounding tolerance", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: 24_999, receivedCurrency: "ZAR" }), 1);
});

test("nothing received is the whole amount short", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: 0, receivedCurrency: "ZAR" }), 25_000);
});

test("a missing charge currency is compared as the order's own, never waved through", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: 100, receivedCurrency: null }), 24_900);
});

test("a malformed amount reads as nothing received, not as covered", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: Number.NaN, receivedCurrency: "ZAR" }), 25_000);
});

test("a different currency is not compared", () => {
  assert.equal(paymentShortfallCents({ ...order, receivedCents: 100, receivedCurrency: "USD" }), 0);
});

test("a free order is never short", () => {
  assert.equal(paymentShortfallCents({ expectedCents: 0, expectedCurrency: "ZAR", receivedCents: 0, receivedCurrency: "ZAR" }), 0);
});
