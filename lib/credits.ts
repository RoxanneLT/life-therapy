import { prisma } from "./prisma";

/**
 * A Prisma client OR a transaction handle. Same shape as `GiftDb` in lib/gift.ts,
 * for the same reason: work that must commit together has to share a handle.
 */
export type CreditDb = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

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
  description: string,
  /**
   * Transaction handle, so the deduction can commit or roll back WITH the
   * booking it pays for. Defaults to the global client for the single-booking
   * paths, which have nothing to tie themselves to.
   *
   * Without this, a recurring series that died between creating a booking and
   * deducting its credit left a confirmed session nobody was charged for — the
   * same free-session shape as the postpaid credit bug, arriving by a different
   * road.
   */
  db: CreditDb = prisma,
): Promise<number> {
  // Spend the credit CONDITIONALLY, in one statement.
  //
  // This was read-then-write: fetch the balance, check it was at least 1, then
  // decrement. Two bookings landing together both read 1, both pass the check and
  // both decrement — a balance of -1, or two sessions paid for with one credit.
  // Wrapping it in a transaction does not help, which is the trap: at read
  // committed isolation the second read still sees the pre-decrement value. The
  // database has to do the deciding, and `balance: { gte: 1 }` in the WHERE is how
  // it does — the same atomic-claim shape as the reminder and gift fixes.
  const spent = await db.sessionCreditBalance.updateMany({
    where: { studentId, balance: { gte: 1 } },
    data: { balance: { decrement: 1 } },
  });

  if (spent.count !== 1) {
    throw new Error("Insufficient session credits");
  }

  const after = await db.sessionCreditBalance.findUnique({
    where: { studentId },
    select: { balance: true },
  });

  await db.sessionCreditTransaction.create({
    data: {
      studentId,
      type: "used",
      amount: 1,
      // Read back rather than computed: under concurrency this is the balance as
      // it stands now, which is the honest thing for a ledger line to record.
      balanceAfter: after?.balance ?? 0,
      description,
      bookingId,
    },
  });

  return after?.balance ?? 0;
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
