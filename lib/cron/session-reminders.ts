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
import { getSessionTypeConfig } from "@/lib/booking-config";
import { addDays, format } from "date-fns";
import { saDateStr, saInstant, calendarDate } from "@/lib/dates";

// Hours-before-start window boundaries
const DAY_BEFORE_MAX = 24; // start sending the day-before reminder once within 24h
const IMMINENT_MAX = 3; // ~2h nudge: fire when within 3h (2h cron cadence guarantees catch)

/** The three one-per-booking reminder stamps. */
type ReminderField =
  | "reminderSentAt"
  | "whatsappReminder24hSentAt"
  | "whatsappReminderMorningSentAt";

/**
 * Take ownership of one reminder before sending it.
 *
 * The old shape was read-then-send-then-stamp: the booking list was fetched with
 * the stamp null, the email went out, and only afterwards was the column set. Two
 * runs inside that gap both saw null and both sent — and there are two runners by
 * design, the every-2h reminders cron and the daily safety-net pass, so the gap is
 * not hypothetical. The client gets the same reminder twice.
 *
 * `updateMany` with the null in the WHERE makes the claim atomic: the database
 * decides, and exactly one caller sees count === 1. Same approach the Paystack
 * fulfilment fix used against redelivery.
 */
async function claimReminder(bookingId: string, field: ReminderField): Promise<boolean> {
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, [field]: null },
    data: { [field]: new Date() },
  });
  return claimed.count === 1;
}

/**
 * Hand the claim back when the send did not happen.
 *
 * Claiming up front means a failed send would otherwise be recorded as sent and
 * never retried — the trap #9 was about. Releasing restores that. The remaining
 * window is a process killed between claim and release, which loses one reminder;
 * that is the better failure than emailing a client twice, and it is the trade
 * being made rather than an oversight.
 */
async function releaseReminder(bookingId: string, field: ReminderField): Promise<void> {
  await prisma.booking
    .updateMany({ where: { id: bookingId }, data: { [field]: null } })
    .catch((err) => console.error(`[session-reminders] could not release ${field}:`, err));
}

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
  const todayStr = saDateStr(now);
  const windowStart = calendarDate(todayStr);
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
    const startInstant = saInstant(dateStr, booking.startTime);
    const hoursUntil = (startInstant.getTime() - now.getTime()) / 3_600_000;

    const isDayBefore = hoursUntil <= DAY_BEFORE_MAX && hoursUntil > IMMINENT_MAX;
    const isImminent = hoursUntil <= IMMINENT_MAX && hoursUntil > 0;
    if (!isDayBefore && !isImminent) continue;

    const config = getSessionTypeConfig(booking.sessionType);
    const waReady =
      waSessionOn && !!booking.student?.smsOptIn && !!booking.student?.phone;

    // ── Day-before: email ──────────────────────────────────────
    if (isDayBefore && booking.reminderSentAt === null && (await claimReminder(booking.id, "reminderSentAt"))) {
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
          emailSent++;
        } else {
          await releaseReminder(booking.id, "reminderSentAt");
          failed++;
        }
      } catch (err) {
        console.error(`[session-reminders] email failed for ${booking.id}:`, err);
        await releaseReminder(booking.id, "reminderSentAt");
        failed++;
      }
    }

    // ── Day-before: WhatsApp 24h ───────────────────────────────
    if (isDayBefore && waReady && booking.whatsappReminder24hSentAt === null && (await claimReminder(booking.id, "whatsappReminder24hSentAt"))) {
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
          wa24hSent++;
        } else {
          await releaseReminder(booking.id, "whatsappReminder24hSentAt");
          failed++;
        }
      } catch (err) {
        console.error(`[session-reminders] WA 24h failed for ${booking.id}:`, err);
        await releaseReminder(booking.id, "whatsappReminder24hSentAt");
        failed++;
      }
    }

    // ── Imminent: WhatsApp ~2h nudge ───────────────────────────
    if (isImminent && waReady && booking.whatsappReminderMorningSentAt === null && (await claimReminder(booking.id, "whatsappReminderMorningSentAt"))) {
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
          waImminentSent++;
        } else {
          await releaseReminder(booking.id, "whatsappReminderMorningSentAt");
          failed++;
        }
      } catch (err) {
        console.error(`[session-reminders] WA imminent failed for ${booking.id}:`, err);
        await releaseReminder(booking.id, "whatsappReminderMorningSentAt");
        failed++;
      }
    }
  }

  return { emailSent, wa24hSent, waImminentSent, failed, checked: bookings.length };
}
