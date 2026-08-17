/**
 * Money invariants.
 *
 * Each fixture pins a rule that money depends on, and several of them exist
 * because the rule was broken in production code before this pass. A test that
 * only asserts current behaviour is worthless — these assert the RULE.
 *
 * Run: npm run test:money  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vatApplies,
  calculateInvoiceTotals,
  toCurrency,
  getOverdueDate,
  getReminderDate,
  getEffectiveBillingDate,
  calculateDueDate,
} from "./billing";
import { isSAPublicHoliday, isBusinessDay, getNextBusinessDay } from "./sa-holidays";
import { receivedCents, balanceCents } from "./billing";
import { calendarDate, saDateStr } from "./dates";
import { CURRENCIES } from "./region";
import { formatPrice, formatByCurrency } from "./utils";

// ── VAT is ZAR-only ─────────────────────────────────────────────────────────

test("VAT never applies to a non-ZAR invoice, even when registered", () => {
  // THE bug this pass fixed: createInvoiceRecord took `settings.vatRegistered`
  // raw, with `currency` sitting right there in scope. The moment VAT
  // registration is switched on, every USD/EUR/GBP invoice would have picked up
  // 15% South African VAT — real money, charged to a real client, silently.
  assert.equal(vatApplies("USD", true), false);
  assert.equal(vatApplies("EUR", true), false);
  assert.equal(vatApplies("GBP", true), false);

  // ZAR + registered is the ONLY combination that charges VAT.
  assert.equal(vatApplies("ZAR", true), true);
  assert.equal(vatApplies("ZAR", false), false);
  assert.equal(vatApplies("ZAR", null), false);
  assert.equal(vatApplies("ZAR", undefined), false);
});

test("a USD invoice is zero-rated end-to-end, a ZAR one is not", () => {
  const line = [{ unitPriceCents: 100_000, quantity: 1 }];
  const vatPct = 15;

  const zar = calculateInvoiceTotals(line, undefined, undefined, vatApplies("ZAR", true), vatPct);
  assert.equal(zar.vatAmountCents, 15_000);
  assert.equal(zar.totalCents, 115_000);

  const usd = calculateInvoiceTotals(line, undefined, undefined, vatApplies("USD", true), vatPct);
  assert.equal(usd.vatAmountCents, 0);
  assert.equal(usd.totalCents, 100_000); // exported service — zero-rated
});

// ── Discount and VAT ordering ───────────────────────────────────────────────

test("VAT is charged on the DISCOUNTED amount, not the subtotal", () => {
  const totals = calculateInvoiceTotals(
    [{ unitPriceCents: 100_000, quantity: 1 }],
    10, // 10% invoice discount
    undefined,
    true,
    15,
  );
  assert.equal(totals.subtotalCents, 100_000);
  assert.equal(totals.discountCents, 10_000);
  // 15% of 90 000, not of 100 000. Charging VAT on the pre-discount figure would
  // overcharge the client and over-declare output VAT to SARS.
  assert.equal(totals.vatAmountCents, 13_500);
  assert.equal(totals.totalCents, 103_500);
});

test("a percent and a fixed discount take the LARGER, they do not stack", () => {
  // Surprising, and load-bearing: a client with both a standing 10% and a fixed
  // R50 discount gets whichever is better for them — never both.
  const totals = calculateInvoiceTotals(
    [{ unitPriceCents: 100_000, quantity: 1 }],
    10, // → 10 000
    3_000, // → 3 000
    false,
    0,
  );
  assert.equal(totals.discountCents, 10_000); // the larger, not 13 000
  assert.equal(totals.totalCents, 90_000);
});

test("a discount larger than the subtotal clamps at zero, never negative", () => {
  const totals = calculateInvoiceTotals(
    [{ unitPriceCents: 5_000, quantity: 1 }],
    undefined,
    999_999, // absurd fixed discount
    true,
    15,
  );
  assert.equal(totals.totalCents, 0);
  assert.equal(totals.vatAmountCents, 0); // no VAT on a zero invoice
  assert.ok(totals.totalCents >= 0, "an invoice can never total a negative amount");
});

// ── The currency boundary: validate, never assert ───────────────────────────

test("toCurrency rejects anything outside the union instead of trusting the DB", () => {
  // `Booking.priceCurrency` is a plain Postgres String. `as Currency` on one is a
  // lie TypeScript cannot catch: it flows into getSessionPrice, whose switch has
  // no default, which returns `undefined` despite a `: number` signature — and the
  // client is shown a late-cancellation fee of R0,00. Fails toward "free".
  assert.equal(toCurrency("USD"), "USD");
  assert.equal(toCurrency("ZAR"), "ZAR");

  assert.equal(toCurrency("usd"), "ZAR", "lowercase is not the union member");
  assert.equal(toCurrency("BTC"), "ZAR", "an unknown currency must not pass through");
  assert.equal(toCurrency(""), "ZAR");
  assert.equal(toCurrency(null), "ZAR");
  assert.equal(toCurrency(undefined), "ZAR");
});

test("every Currency union member survives the round trip", () => {
  // Guards the other direction: if someone adds a currency to the union but not to
  // CURRENCIES, toCurrency would silently downgrade it to ZAR.
  for (const c of CURRENCIES) {
    assert.equal(toCurrency(c), c, `${c} must survive validation`);
  }
});

// ── Currencies cannot be added ──────────────────────────────────────────────

test("formatByCurrency keeps currencies separate instead of fusing them", () => {
  // The dashboard summed paidAmountCents across every currency and rendered the
  // result as Rands: a USD invoice and a ZAR invoice became one fabricated
  // number. Money in different currencies cannot be added.
  const out = formatByCurrency([
    { currency: "USD", cents: 56_000 },
    { currency: "ZAR", cents: 1_240_000 },
  ]);
  assert.ok(out.includes("+"), "two currencies must render as two amounts");
  assert.match(out, /^R/, "ZAR sorts first — it is the primary book");
  assert.ok(out.includes("$"), "the USD amount must survive");
});

test("formatByCurrency drops zero balances and survives an empty set", () => {
  assert.equal(formatByCurrency([]), formatPrice(0, "ZAR"));
  const out = formatByCurrency([
    { currency: "ZAR", cents: 10_000 },
    { currency: "USD", cents: 0 },
  ]);
  assert.ok(!out.includes("$"), "a dormant currency must not clutter the tile");
});

test("formatPrice renders the currency it is given, not always Rands", () => {
  assert.ok(formatPrice(10_000, "ZAR").includes("R"));
  assert.ok(formatPrice(10_000, "USD").includes("$"));
  assert.ok(formatPrice(10_000, "GBP").includes("£"));
  assert.ok(formatPrice(10_000, "EUR").includes("€"));
  // The default exists for genuinely ZAR-only records (Order, Course.price).
  assert.equal(formatPrice(10_000), formatPrice(10_000, "ZAR"));
});

// ── Business-day arithmetic is timezone-independent ─────────────────────────

test("overdue falls AFTER the due date, never on it", () => {
  // The bug: dueDate was stored as a SAST-midnight instant (22:00 UTC the day
  // BEFORE), while lib/billing.ts read it with LOCAL getters. On a UTC server the
  // 19th came back as the 18th, so the overdue trigger landed ON the due date —
  // the client was told "due the 19th" and marked overdue that same morning.
  // Both halves were individually defensible; together they were wrong.
  const due = calendarDate("2026-07-19"); // a Sunday
  const overdue = getOverdueDate(due);
  assert.equal(saDateStr(overdue), "2026-07-20"); // Monday, strictly after
  assert.ok(overdue > due, "overdue must be strictly after the due date");
});

test("business-day arithmetic skips weekends and SA public holidays", () => {
  assert.equal(isSAPublicHoliday(calendarDate("2026-12-16")), true); // Reconciliation
  assert.equal(isBusinessDay(calendarDate("2026-12-16")), false);
  assert.equal(saDateStr(getNextBusinessDay(calendarDate("2026-12-16"))), "2026-12-17");

  // Reminder = 2 business days before the due date, not 2 calendar days.
  assert.equal(saDateStr(getReminderDate(calendarDate("2026-07-19"))), "2026-07-16");
});

test("the effective billing date is the last BUSINESS day of the month", () => {
  assert.equal(saDateStr(getEffectiveBillingDate(2026, 7)), "2026-07-31"); // Friday
  assert.equal(saDateStr(getEffectiveBillingDate(2026, 2)), "2026-02-27"); // 28th is a Saturday
});

test("a calendar-day due date landing on a weekend shifts to Monday", () => {
  // 13 Jul + 5 calendar days = Sat 18 Jul → must move to Mon 20 Jul.
  assert.equal(saDateStr(calculateDueDate(calendarDate("2026-07-13"), 5, "calendar")), "2026-07-20");
});

// ── What has arrived against a payment request ──────────────────────────────

test(`received takes the larger of the two records, never the sum`, () => {
  // The SAME money can be written in two places: `payment_requests.paidAmountCents`
  // (Paystack short payments, and settlement) and `invoices.paidAmountCents` (the
  // admin Record Payment flow). They are two records of one payment, not two
  // payments — summing them would report a request as settled when it is short,
  // which is the dangerous direction to be wrong in.
  assert.equal(receivedCents({ paidAmountCents: 60000 }, { paidAmountCents: 60000 }), 60000);
  assert.equal(receivedCents({ paidAmountCents: 60000 }, null), 60000);
  assert.equal(receivedCents({ paidAmountCents: null }, { paidAmountCents: 60000 }), 60000);
  assert.equal(receivedCents({ paidAmountCents: null }, null), 0);
});

test(`a legacy row with the amount only on the invoice still counts`, () => {
  // Requests settled before payment_requests.paidAmountCents existed carry the
  // figure on the invoice alone. Reading the request alone would call them unpaid
  // and chase a client who has paid in full.
  assert.equal(receivedCents({ paidAmountCents: null }, { paidAmountCents: 179000 }), 179000);
});

test(`the balance is what is still owed, and never negative`, () => {
  assert.equal(balanceCents({ totalCents: 100000, paidAmountCents: 40000 }, null), 60000);
  assert.equal(balanceCents({ totalCents: 100000, paidAmountCents: null }, null), 100000);
  assert.equal(balanceCents({ totalCents: 100000, paidAmountCents: 100000 }, null), 0);
  // An overpayment is a reconciliation question for a human, not a credit this
  // function invents by returning a negative balance.
  assert.equal(balanceCents({ totalCents: 100000, paidAmountCents: 150000 }, null), 0);
});
