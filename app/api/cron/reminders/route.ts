import { withCronRun } from "@/lib/cron/with-cron-run";
import { processSessionReminders } from "@/lib/cron/session-reminders";

async function handler() {
  const result = await processSessionReminders();
  return Response.json({ ok: true, ...result });
}

export const GET = withCronRun("session_reminders", handler);
