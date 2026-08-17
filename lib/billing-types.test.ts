/**
 * Invoice line items — the Json column that becomes a document a client reads.
 *
 * Nothing downstream re-derives these numbers: the PDF prints `totalCents`
 * verbatim and the portal renders `description` straight out of the column. So
 * a bad row is not a display glitch, it is a wrong invoice in someone's hands,
 * found weeks later by the person being billed.
 *
 * The asymmetry pinned here is deliberate. Writes are strict, because refusing
 * to create the row is the last cheap moment. Reads are lenient, because these
 * rows predate any validation and a strict read would turn one bad historical
 * row into a permanently broken invoice page — taking away the very view you
 * would use to diagnose it.
 *
 * Run: npm run test:lineitems  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLineItems, readLineItems, type InvoiceLineItem } from "./billing-types";

const good: InvoiceLineItem = {
  description: "Individual Session — 3 Feb 2026",
  quantity: 1,
  unitPriceCents: 85000,
  discountCents: 0,
  discountPercent: 0,
  totalCents: 85000,
};

test("a well-formed line passes through unchanged", () => {
  assert.deepEqual(parseLineItems([good], "test"), [good]);
});

test("a negative total is refused on write", () => {
  // The bug this schema exists for: manual entry computed
  // `unitPrice × qty − discount × qty` with no floor, so a discount larger than
  // the line wrote a negative total that the PDF then printed as-is.
  assert.throws(
    () => parseLineItems([{ ...good, totalCents: -5000 }], "test"),
    /cannot be negative/,
  );
});

test("the numbers a broken calculation produces are refused", () => {
  assert.throws(() => parseLineItems([{ ...good, totalCents: Number.NaN }], "test"));
  assert.throws(() => parseLineItems([{ ...good, unitPriceCents: Number.POSITIVE_INFINITY }], "test"));
  assert.throws(() => parseLineItems([{ ...good, quantity: 0 }], "test"));
  assert.throws(() => parseLineItems([{ ...good, description: "" }], "test"));
});

test("the error names the field, not just 'invalid'", () => {
  // An admin has to be able to act on this, and the message is what reaches them.
  assert.throws(
    () => parseLineItems([{ ...good, totalCents: -1 }], "payment request line items"),
    /payment request line items: line item 0\.totalCents/,
  );
});

test("reading never throws, whatever is in the column", () => {
  assert.deepEqual(readLineItems(null), []);
  assert.deepEqual(readLineItems("not an array"), []);
  assert.deepEqual(readLineItems(undefined), []);
  assert.equal(readLineItems([good]).length, 1);
});

test("an unreadable stored row renders as a visible placeholder", () => {
  // Degrade in a way someone can SEE. Throwing here would break the whole
  // invoice; returning nothing would silently drop a charge from the document.
  const [item] = readLineItems([{ quantity: 2 }]);
  assert.equal(item.description, "Line item (details unreadable)");
  assert.equal(item.totalCents, 0);
  assert.equal(item.quantity, 2, "whatever was salvageable is kept");
});

test("a legacy row missing only optional fields survives intact", () => {
  const legacy = { description: "Session", quantity: 1, unitPriceCents: 85000, discountCents: 0, discountPercent: 0, totalCents: 85000 };
  assert.deepEqual(readLineItems([legacy]), [legacy]);
});
