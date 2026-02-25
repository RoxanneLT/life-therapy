/**
 * Send email reminders for tomorrow's confirmed bookings.
 * Extracted from app/api/cron/booking-reminders/route.ts for the combined cron dispatcher.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig, TIMEZONE } from "@/lib/booking-config";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export async function processBookingReminders(): Promise<{
  sent: number;
  total: number;
}> {
  const todaySast = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const tomorrowDate = addDays(new Date(`${todaySast}T12:00:00Z`), 1);
  const tomorrowStr = formatInTimeZone(tomorrowDate, "UTC", "yyyy-MM-dd");
  const tomorrowUtc = new Date(`${tomorrowStr}T00:00:00Z`);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      date: tomorrowUtc,
      reminderSentAt: null,
    },
  });

  let sent = 0;
  for (const booking of bookings) {
    const config = getSessionTypeConfig(booking.sessionType);
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
      sent++;
    }
  }

  return { sent, total: bookings.length };
}
