import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { bookingReminderEmail } from "@/lib/email-templates";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/booking-config";

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = toZonedTime(new Date(), TIMEZONE);
  const tomorrow = addDays(startOfDay(now), 1);
  const tomorrowEnd = endOfDay(tomorrow);

  // Find confirmed bookings for tomorrow that haven't had a reminder sent
  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      date: { gte: tomorrow, lte: tomorrowEnd },
      reminderSentAt: null,
    },
  });

  let sent = 0;
  for (const booking of bookings) {
    const email = bookingReminderEmail(booking);
    const result = await sendEmail({ to: booking.clientEmail, ...email });

    if (result.success) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    }
  }

  return NextResponse.json({ sent, total: bookings.length });
}
