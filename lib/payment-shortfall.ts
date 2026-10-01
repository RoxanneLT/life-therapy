/**
 * How much a payment falls short of what it is paying for, in the order's minor units. 0 when it
 * covers it, and 0 when the two are in different currencies — `receivedCents` is minor units of
 * the CHARGE currency, so cross-currency amounts cannot be compared and are left to the human
 * reconciling them. A missing charge currency is taken as the order's own: Paystack reports one on
 * every charge, and an order is only ever charged in its own.
 *
 * Pure, so the arithmetic has a test (payment-shortfall.test.ts). The call site in
 * `lib/order-paid.ts` — `if (shortfallCents > 0)` refuses to fulfil — is not under test: it
 * needs a database, and this project has no DB test harness.
 */
export function paymentShortfallCents(input: {
  expectedCents: number;
  expectedCurrency: string;
  receivedCents: number;
  receivedCurrency: string | null;
}): number {
  const sameCurrency = !input.receivedCurrency || input.receivedCurrency === input.expectedCurrency;
  if (!sameCurrency) return 0;
  // A non-number (a malformed webhook body) must not read as "covered": NaN compares false both
  // ways, so `expected - NaN > 0` is false and would fulfil. Treat it as nothing received.
  const received = Number.isFinite(input.receivedCents) ? input.receivedCents : 0;
  return Math.max(0, input.expectedCents - received);
}
