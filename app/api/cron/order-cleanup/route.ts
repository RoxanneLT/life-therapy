import { withCronRun } from "@/lib/cron/with-cron-run";
import { processOrderCleanup } from "@/lib/cron/order-cleanup";

async function handler() {
  const result = await processOrderCleanup();
  return Response.json({ ok: true, ...result });
}

export const GET = withCronRun("order_cleanup", handler);
