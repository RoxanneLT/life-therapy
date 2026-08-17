import { prisma } from "./prisma";

/**
 * Get a student's current credit balance.
 */
export async function getBalance(studentId: string): Promise<number> {
  const bal = await prisma.sessionCreditBalance.findUnique({
    where: { studentId },
  });
  return bal?.balance ?? 0;
}

/**
 * Add credits to a student's balance.
 */
/**
 * When credits added right now should lapse — or null when no window is set.
 *
 * THE one place that answers this. It used to live inline in `addCredits`, and
 * every other path that hands out credits (a package purchase, a redeemed gift,
 * an admin grant, a refund that creates the row) simply did not stamp a date. So
 * the expiry window applied to one route in and to none of the others: credits
 * someone BOUGHT never expired, while the same credits granted by hand did.
 *
 * Adding credits deliberately extends the whole balance — the client bought more
 * time along with more sessions, and expiring the new ones on the old date would
 * be a rule nobody could explain. A refund is the exception: it returns a credit
 * that was already yours, so it must not buy a fresh window.
 */
export async function creditExpiry(): Promise<Date | null> {
  const { getSiteSettings } = await import("@/lib/settings");
  const settings = await getSiteSettings();
  return settings.creditExpiryDays
    ? new Date(Date.now() + settings.creditExpiryDays * 24 * 60 * 60 * 1000)
    : null;
}

export async function addCredits(
  studentId: string,
  amount: number,
  description: string,
  orderId?: string
): Promise<number> {
  const expiresAt = await creditExpiry();

  const bal = await prisma.sessionCreditBalance.upsert({
    where: { studentId },
    create: { studentId, balance: amount, expiresAt },
    update: {
      balance: { increment: amount },
      ...(expiresAt ? {
        expiresAt,
        expiryWarning14: false,
        expiryWarning3: false,
      } : {}),
    },
  });

  await prisma.sessionCreditTransaction.create({
    data: {
      studentId,
      type: "purchase",
      amount,
      balanceAfter: bal.balance,
      description,
      orderId: orderId || null,
    },
  });

  return bal.balance;
}

/**
 * Use one credit for a booking. Returns the new balance, or throws if insufficient.
 */
export async function deductCredit(
  studentId: string,
  bookingId: string,
  description: string
): Promise<number> {
  const bal = await prisma.sessionCreditBalance.findUnique({
    where: { studentId },
  });

  if (!bal || bal.balance < 1) {
    throw new Error("Insufficient session credits");
  }

  const updated = await prisma.sessionCreditBalance.update({
    where: { studentId },
    data: { balance: { decrement: 1 } },
  });

  await prisma.sessionCreditTransaction.create({
    data: {
      studentId,
      type: "used",
      amount: 1,
      balanceAfter: updated.balance,
      description,
      bookingId,
    },
  });

  return updated.balance;
}

/**
 * Refund one credit for a cancelled booking.
 * Credits are deducted at booking time, so this adds 1 back.
 */
export async function refundCredit(
  studentId: string,
  bookingId: string,
  description: string
): Promise<number> {
  // A refund returns a credit the client already held, so it does NOT extend the
  // window on an existing balance — cancel-and-rebook would otherwise renew the
  // expiry indefinitely. It only stamps a date when there is no row at all, since
  // a balance created without one can never lapse.
  const expiresAt = await creditExpiry();

  const bal = await prisma.sessionCreditBalance.upsert({
    where: { studentId },
    create: { studentId, balance: 1, expiresAt },
    update: { balance: { increment: 1 } },
  });

  await prisma.sessionCreditTransaction.create({
    data: {
      studentId,
      type: "refund",
      amount: 1,
      balanceAfter: bal.balance,
      description,
      bookingId,
    },
  });

  return bal.balance;
}

/**
 * Record a credit forfeit for a late-cancelled booking.
 * Credits are deducted at booking time so the balance is already correct —
 * this only creates an audit trail entry.
 */
export async function forfeitCredit(
  studentId: string,
  bookingId: string,
  description: string
): Promise<void> {
  const bal = await prisma.sessionCreditBalance.findUnique({
    where: { studentId },
  });

  await prisma.sessionCreditTransaction.create({
    data: {
      studentId,
      type: "used",
      amount: 0,
      balanceAfter: bal?.balance ?? 0,
      description,
      bookingId,
    },
  });
}
