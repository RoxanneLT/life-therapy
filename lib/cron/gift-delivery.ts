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
      // Scheduled gifts that are due, OR immediate gifts (deliveryDate null) still
      // sitting pending — which now means their send genuinely failed.
      //
      // `deliveryDate: { lte: now }` alone silently excluded every immediate gift,
      // because NULL is not <= anything in SQL. Combined with sendGiftEmail marking
      // "delivered" regardless of outcome, an immediate gift had two independent
      // reasons never to be retried. Both are fixed; this is the half that lets the
      // retry actually reach them.
      OR: [{ deliveryDate: { lte: now } }, { deliveryDate: null }],
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
