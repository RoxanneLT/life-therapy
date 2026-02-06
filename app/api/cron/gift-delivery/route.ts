import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGiftEmail } from "@/lib/gift";

/**
 * GET /api/cron/gift-delivery
 * Delivers scheduled gifts whose delivery date has arrived.
 * Runs daily via Vercel cron.
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find pending gifts with delivery date in the past
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

  return NextResponse.json({
    processed: pendingGifts.length,
    delivered,
    failed,
  });
}
