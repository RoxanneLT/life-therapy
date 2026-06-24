import { withCronRun } from "@/lib/cron/with-cron-run";
import { processDripEmails } from "@/lib/drip-emails";

async function handler() {
  const result = await processDripEmails();
  return Response.json({ ok: true, ...result });
}

export const GET = withCronRun("drip_emails", handler);
