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
export async function addCredits(
  studentId: string,
  amount: number,
  description: string,
  orderId?: string
): Promise<number> {
  const bal = await prisma.sessionCreditBalance.upsert({
    where: { studentId },
    create: { studentId, balance: amount },
    update: { balance: { increment: amount } },
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
  const bal = await prisma.sessionCreditBalance.upsert({
    where: { studentId },
    create: { studentId, balance: 1 },
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
