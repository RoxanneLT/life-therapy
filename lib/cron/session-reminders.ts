/**
 * Session reminder processor — runs on a frequent (every ~2h) cron so
 * reminders fire relative to each session's actual start time, not at a
 * fixed daily hour.
 *
 * Two windows per booking (deduped by tracking fields):
 *   • Day-before (~24h out): email `booking_reminder` + WhatsApp `session_reminder_24h`
 *   • Imminent  (~2h out):   WhatsApp `session_reminder_today`
 *
 * Email is sent for the day-before window only; the 2h nudge is WhatsApp
 * (the immediate channel). All sends are idempotent via the booking's
 * reminder flags, so running this alongside the daily safety-net run never
 * double-sends.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSiteSettings } from "@/lib/settings";
import { sendAndLogTemplate } from "@/lib/whatsapp";
import { getSessionTypeConfig, TIMEZONE } from "@/lib/booking-config";
import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// Hours-before-start window boundaries
const DAY_BEFORE_MAX = 24; // start sending the day-before reminder once within 24h
const IMMINENT_MAX = 3; // ~2h nudge: fire when within 3h (2h cron cadence guarantees catch)

export async function processSessionReminders(): Promise<{
  emailSent: number;
  wa24hSent: number;
  waImminentSent: number;
  failed: number;
  checked: number;
}> {
  const settings = await getSiteSettings();
  const waSessionOn = !!settings.whatsappEnabled && !!settings.whatsappSessionReminders;

  const now = new Date();
  const todayStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const windowStart = new Date(`${todayStr}T00:00:00Z`);
  const windowEnd = addDays(windowStart, 2);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      date: { gte: windowStart, lte: windowEnd },
      OR: [
        { reminderSentAt: null },
        { whatsappReminder24hSentAt: null },
        { whatsappReminderMorningSentAt: null },
      ],
    },
    include: { student: true },
  });

  let emailSent = 0;
  let wa24hSent = 0;
  let waImminentSent = 0;
  let failed = 0;

  for (const booking of bookings) {
    const dateStr = booking.date.toISOString().slice(0, 10);
    const startInstant = fromZonedTime(`${dateStr}T${booking.startTime}:00`, TIMEZONE);
    const hoursUntil = (startInstant.getTime() - now.getTime()) / 3_600_000;

    const isDayBefore = hoursUntil <= DAY_BEFORE_MAX && hoursUntil > IMMINENT_MAX;
    const isImminent = hoursUntil <= IMMINENT_MAX && hoursUntil > 0;
    if (!isDayBefore && !isImminent) continue;

    const config = getSessionTypeConfig(booking.sessionType);
    const waReady =
      waSessionOn && !!booking.student?.smsOptIn && !!booking.student?.phone;

    // ── Day-before: email ──────────────────────────────────────
    if (isDayBefore && booking.reminderSentAt === null) {
      try {
        const teamsButton = booking.teamsMeetingUrl
          ? `<div style="text-align: center; margin: 24px 0;"><a href="${booking.teamsMeetingUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Join Microsoft Teams Meeting</a></div>`
          : "";
        const email = await renderEmail("booking_reminder", {
          clientName: booking.clientName,
          sessionType: config.label,
          date: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
          time: `${booking.startTime} – ${booking.endTime} (SAST)`,
          startTime: booking.startTime,
          teamsButton,
        });
        const result = await sendEmail({
          to: booking.clientEmail,
          ...email,
          templateKey: "booking_reminder",
          metadata: { bookingId: booking.id },
        });
        if (result.success) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSentAt: new Date() },
          });
          emailSent++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`[session-reminders] email failed for ${booking.id}:`, err);
        failed++;
      }
    }

    // ── Day-before: WhatsApp 24h ───────────────────────────────
    if (isDayBefore && waReady && booking.whatsappReminder24hSentAt === null) {
      try {
        const result = await sendAndLogTemplate({
          studentId: booking.student!.id,
          phone: booking.student!.phone!,
          templateName: "session_reminder_24h",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: booking.student!.firstName },
                { type: "text", text: config.label },
                { type: "text", text: format(new Date(booking.date), "EEEE d MMMM") },
                { type: "text", text: booking.startTime },
              ],
            },
          ],
          metadata: { bookingId: booking.id },
        });
        if (result.success) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { whatsappReminder24hSentAt: new Date() },
          });
          wa24hSent++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`[session-reminders] WA 24h failed for ${booking.id}:`, err);
        failed++;
      }
    }

    // ── Imminent: WhatsApp ~2h nudge ───────────────────────────
    if (isImminent && waReady && booking.whatsappReminderMorningSentAt === null) {
      try {
        const result = await sendAndLogTemplate({
          studentId: booking.student!.id,
          phone: booking.student!.phone!,
          templateName: "session_reminder_today",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: booking.student!.firstName },
                { type: "text", text: booking.startTime },
              ],
            },
          ],
          metadata: { bookingId: booking.id },
        });
        if (result.success) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { whatsappReminderMorningSentAt: new Date() },
          });
          waImminentSent++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`[session-reminders] WA imminent failed for ${booking.id}:`, err);
        failed++;
      }
    }
  }

  return { emailSent, wa24hSent, waImminentSent, failed, checked: bookings.length };
}
