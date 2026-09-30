/**
 * When a WhatsApp may arrive on a client's phone.
 *
 * Email is silent until opened; a WhatsApp buzzes. Until 2026-09-30 nothing held the hour:
 * the imminent session nudge fired on the first 2-hourly run inside 3h of the start, so a
 * 07:00 session's went out at 04:00 or 06:00 (whatsapp_logs: earliest 06:00 in 90 days).
 * The billing WhatsApps ride the daily job at ~08:46 SAST and are not gated here.
 *
 * Reading run times: cron_runs."startedAt" is `timestamp without time zone` holding UTC, so
 * `AT TIME ZONE 'Africa/Johannesburg'` on it SUBTRACTS two hours — it reads the value as
 * local time. Use `("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg'`.
 * whatsapp_logs."sentAt" is timestamptz and converts correctly. That trap produced a false
 * "the daily job runs at 04:46" on 2026-09-30.
 *
 * A session too early for its imminent nudge relies on the 24h reminder, which is the one
 * that leaves time to reschedule — Stéan, 2026-09-30.
 */
import { saFormat } from "@/lib/dates";

/** First SAST hour a WhatsApp may be sent, inclusive. */
const WHATSAPP_FROM_HOUR = 7;
/** SAST hour from which WhatsApps stop, exclusive. */
const WHATSAPP_UNTIL_HOUR = 21;

export function isWhatsAppHour(now: Date): boolean {
  const hour = Number(saFormat(now, "H"));
  return hour >= WHATSAPP_FROM_HOUR && hour < WHATSAPP_UNTIL_HOUR;
}
