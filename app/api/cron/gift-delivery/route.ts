import { withCronRun } from "@/lib/cron/with-cron-run";
import { processGiftDelivery } from "@/lib/cron/gift-delivery";

async function handler() {
  const result = await processGiftDelivery();
  return Response.json({ ok: true, ...result });
}

export const GET = withCronRun("gift_delivery", handler);
