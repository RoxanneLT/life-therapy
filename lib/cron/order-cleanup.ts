/**
 * Fail pending orders older than 24 hours (expired Paystack transactions).
 * Extracted from app/api/cron/order-cleanup/route.ts for the combined cron dispatcher.
 */

import { prisma } from "@/lib/prisma";

export async function processOrderCleanup(): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await prisma.order.updateMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
    },
    data: { status: "failed" },
  });

  return { expired: result.count };
}
