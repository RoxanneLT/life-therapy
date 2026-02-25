/**
 * Deliver scheduled gifts whose delivery date has arrived.
 * Extracted from app/api/cron/gift-delivery/route.ts for the combined cron dispatcher.
 */

import { prisma } from "@/lib/prisma";
import { sendGiftEmail } from "@/lib/gift";

export async function processGiftDelivery(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> {
  const now = new Date();
  const pendingGifts = await prisma.gift.findMany({
    where: {
      status: "pending",
      deliveryDate: { lte: now },
    },
  });

  let delivered = 0;
  let failed = 0;

  for (const gift of pendingGifts) {
    try {
      await sendGiftEmail(gift.id);
      delivered++;
    } catch (err) {
      console.error(`Failed to deliver gift ${gift.id}:`, err);
      failed++;
    }
  }

  return { processed: pendingGifts.length, delivered, failed };
}
