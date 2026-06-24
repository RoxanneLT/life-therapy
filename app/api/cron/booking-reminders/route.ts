import { withCronRun } from "@/lib/cron/with-cron-run";
import { processBookingReminders } from "@/lib/cron/booking-reminders";

async function handler() {
  const result = await processBookingReminders();
  return Response.json({ ok: true, ...result });
}

export const GET = withCronRun("booking_reminders", handler);
