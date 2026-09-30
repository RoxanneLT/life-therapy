/**
 * Which credits for billed-then-cancelled sessions fit on a payment request.
 *
 * A credit is carried as the request's discount (a line total cannot be negative), and the
 * totals function floors at zero — so a credit larger than the charges would silently vanish
 * into that floor while the booking was stamped as credited. Instead a credit is applied
 * whole or not at all, oldest first, while the running total stays within the charges; one
 * that does not fit is left unstamped and waits for the next request. Same currency only.
 */

export interface PendingCredit {
  bookingId: string;
  /** What the session was charged on its request, pre-VAT, in `currency` cents. */
  amountCents: number;
  currency: string;
  /** billingMonth of the request that charged it, for the explanation line. */
  billedIn: string;
}

export function planCredits<C extends PendingCredit>(
  chargesCents: number,
  currency: string,
  credits: readonly C[],
): { applied: C[]; totalCents: number } {
  const applied: C[] = [];
  let totalCents = 0;
  for (const c of credits) {
    if (c.currency !== currency || c.amountCents <= 0) continue;
    if (totalCents + c.amountCents > chargesCents) continue;
    applied.push(c);
    totalCents += c.amountCents;
  }
  return { applied, totalCents };
}
