import { test } from "node:test";
import assert from "node:assert/strict";

import { BUY_NOW_REFERENCE, orderReference } from "./order-reference";

test("a buy-now reference is recognised as one", () => {
  assert.match(orderReference("LT-20261001-0007", "buy-now"), BUY_NOW_REFERENCE);
});

test("a cart reference is NOT — /checkout/success puts it where analytics reads it", () => {
  assert.doesNotMatch(orderReference("LT-20261001-0007", "cart"), BUY_NOW_REFERENCE);
});

test("the old timestamp reference is not — it can be guessed", () => {
  assert.doesNotMatch("LT-20261001-0007-1759312345678", BUY_NOW_REFERENCE);
});

test("anything around a valid reference is not", () => {
  const ref = orderReference("LT-20261001-0007", "buy-now");
  assert.doesNotMatch(`${ref}x`, BUY_NOW_REFERENCE);
  assert.doesNotMatch(`x${ref}`, BUY_NOW_REFERENCE);
});

test("two references for one order number differ", () => {
  assert.notEqual(orderReference("LT-20261001-0007", "buy-now"), orderReference("LT-20261001-0007", "buy-now"));
});
