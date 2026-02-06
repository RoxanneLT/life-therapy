"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { bookingFormSchema } from "@/lib/validations";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { createCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import {
  bookingConfirmationEmail,
  bookingNotificationEmail,
} from "@/lib/email-templates";
import { getSiteSettings } from "@/lib/settings";
import { rateLimitBooking } from "@/lib/rate-limit";
import { getOptionalStudent } from "@/lib/student-auth";
import { getBalance, deductCredit } from "@/lib/credits";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SessionType } from "@/lib/generated/prisma/client";

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function createBooking(formData: FormData) {
  // Rate limit by IP
  const headersList = headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { success } = rateLimitBooking(ip);
  if (!success) {
    throw new Error("Too many booking attempts. Please try again later.");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = bookingFormSchema.parse({
    ...raw,
    clientPhone: raw.clientPhone || undefined,
    clientNotes: raw.clientNotes || undefined,
  });

  const sessionConfig = getSessionTypeConfig(parsed.sessionType as SessionType);

  // Re-validate slot availability (race condition guard)
  const slots = await getAvailableSlots(parsed.date, sessionConfig);
  const slotAvailable = slots.some((s) => s.start === parsed.startTime);
  if (!slotAvailable) {
    throw new Error(
      "This time slot is no longer available. Please choose another."
    );
  }

  // Calculate end time
  const startMins = parseTimeToMinutes(parsed.startTime);
  const endTime = formatMinutesToTime(
    startMins + sessionConfig.durationMinutes
  );

  // Create Exchange calendar event with Teams link
  const graphResult = await createCalendarEvent({
    subject: `${sessionConfig.label} — ${parsed.clientName}`,
    startDateTime: `${parsed.date}T${parsed.startTime}:00`,
    endDateTime: `${parsed.date}T${endTime}:00`,
    clientName: parsed.clientName,
    clientEmail: parsed.clientEmail,
    description: parsed.clientNotes || "",
  });

  // Generate a secure confirmation token (not guessable like cuid)
  const confirmationToken = randomUUID();

  // Check if using session credit
  const wantsCredit = raw.useSessionCredit === "true";
  let paidWithCredit = false;
  let creditStudentId: string | null = null;

  if (wantsCredit && sessionConfig.priceZarCents > 0) {
    const student = await getOptionalStudent();
    if (!student) {
      throw new Error("You must be logged in to use session credits.");
    }
    const balance = await getBalance(student.id);
    if (balance < 1) {
      throw new Error("Insufficient session credits.");
    }
    creditStudentId = student.id;
    paidWithCredit = true;
  }

  // Create booking in DB
  const booking = await prisma.booking.create({
    data: {
      sessionType: parsed.sessionType as SessionType,
      date: new Date(`${parsed.date}T00:00:00Z`),
      startTime: parsed.startTime,
      endTime,
      durationMinutes: sessionConfig.durationMinutes,
      priceZarCents: paidWithCredit ? 0 : sessionConfig.priceZarCents,
      clientName: parsed.clientName,
      clientEmail: parsed.clientEmail,
      clientPhone: parsed.clientPhone || null,
      clientNotes: parsed.clientNotes || null,
      status: "confirmed",
      graphEventId: graphResult?.eventId || null,
      teamsMeetingUrl: graphResult?.teamsMeetingUrl || null,
      confirmationToken,
    },
  });

  // Deduct credit now that we have the booking ID
  if (paidWithCredit && creditStudentId) {
    await deductCredit(
      creditStudentId,
      booking.id,
      `Session booking: ${sessionConfig.label}`
    );
  }

  // Send emails (don't block redirect on failure)
  const settings = await getSiteSettings();
  const confirmEmail = bookingConfirmationEmail(booking, confirmationToken);
  const notifyEmail = bookingNotificationEmail(booking);

  await Promise.allSettled([
    sendEmail({ to: booking.clientEmail, ...confirmEmail }),
    sendEmail({
      to: settings.email || "hello@life-therapy.co.za",
      ...notifyEmail,
    }),
  ]);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { confirmationSentAt: new Date() },
  });

  revalidatePath("/admin/bookings");
  redirect(`/book/confirmation?token=${confirmationToken}`);
}
