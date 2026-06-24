import { withCronRun } from "@/lib/cron/with-cron-run";
import { processCampaigns } from "@/lib/campaign-process";

async function handler() {
  const result = await processCampaigns();
  return Response.json({ ok: true, ...result });
}

export const GET = withCronRun("campaign_steps", handler);
