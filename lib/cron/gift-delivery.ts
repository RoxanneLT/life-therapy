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

  // Claim each gift before sending it.
  //
  // This was read-then-send-then-stamp: the list is fetched with status "pending",
  // the email goes out, and `sendGiftEmail` marks "delivered" only afterwards. Two
  // runners inside that gap both send — and there ARE two, this processor has its
  // own cron AND the daily route calls it. The recipient gets the same gift twice
  // and the buyer gets two "delivered" notices, for something they paid for once.
  //
  // `emailSentAt` is the claim: it is only ever set by a send, so a pending gift
  // with one set means somebody is mid-flight. A claim older than the window is
  // treated as abandoned, so a run killed between claiming and sending does not
  // strand the gift forever — the failure mode a naive claim introduces.
  const STALE_CLAIM_MS = 15 * 60 * 1000;
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

  for (const gift of pendingGifts) {
    const claimed = await prisma.gift.updateMany({
      where: {
        id: gift.id,
        status: "pending",
        OR: [{ emailSentAt: null }, { emailSentAt: { lt: staleBefore } }],
      },
      data: { emailSentAt: new Date() },
    });
    if (claimed.count !== 1) continue; // another runner has it

    try {
      await sendGiftEmail(gift.id);
      delivered++;
    } catch (err) {
      console.error(`Failed to deliver gift ${gift.id}:`, err);
      // Hand the claim back, or a failed send looks exactly like one in flight
      // and waits out the stale window before anything retries it.
      await prisma.gift
        .updateMany({ where: { id: gift.id, status: "pending" }, data: { emailSentAt: null } })
        .catch((e) => console.error(`Could not release gift claim ${gift.id}:`, e));
      failed++;
    }
  }

  return { processed: pendingGifts.length, delivered, failed };
}
