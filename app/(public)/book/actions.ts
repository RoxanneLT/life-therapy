"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { bookingFormSchema } from "@/lib/validations";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { createCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { formatPrice, escapeHtml } from "@/lib/utils";
import { format } from "date-fns";
import type { Currency } from "@/lib/region";
import { getSiteSettings } from "@/lib/settings";
import { getCurrency, getBaseUrl } from "@/lib/get-region";
import { getSessionPrice } from "@/lib/pricing";
import { rateLimitBooking } from "@/lib/rate-limit";
import { getOptionalStudent } from "@/lib/student-auth";
import { getBalance, deductCredit } from "@/lib/credits";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SessionType } from "@/lib/generated/prisma/client";
import { upsertContact } from "@/lib/contacts";

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
  const headersList = await headers();
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

  // Compute session price in the user's currency
  const settings = await getSiteSettings();
  const currency = await getCurrency();
  const sessionPriceCents = sessionConfig.isFree
    ? 0
    : getSessionPrice(parsed.sessionType as "individual" | "couples", currency, settings);

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

  if (wantsCredit && !sessionConfig.isFree) {
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
      priceZarCents: paidWithCredit ? 0 : sessionPriceCents,
      priceCurrency: currency,
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

  // Sync booking client to Contact list (non-blocking)
  const nameParts = parsed.clientName.trim().split(/\s+/);
  upsertContact({
    email: parsed.clientEmail,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || undefined,
    phone: parsed.clientPhone || undefined,
    source: "booking",
    consentGiven: true,
    consentMethod: "booking_form",
  }).catch((err) => console.error("Failed to sync booking contact:", err));

  // Send emails (don't block redirect on failure)
  const baseUrl = await getBaseUrl();
  const dateStr = format(new Date(booking.date), "EEEE, d MMMM yyyy");
  const timeStr = `${booking.startTime} – ${booking.endTime} (SAST)`;
  const bookingCurrency = (booking.priceCurrency || "ZAR") as Currency;

  const teamsSection = booking.teamsMeetingUrl
    ? `<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p>
        <a href="${booking.teamsMeetingUrl}" style="color: #8BA889; font-weight: 600; word-break: break-all;">${booking.teamsMeetingUrl}</a>
      </div>`
    : "";

  const priceSection =
    booking.priceZarCents > 0
      ? `<p style="margin: 8px 0;"><strong>Session fee:</strong> ${formatPrice(booking.priceZarCents, bookingCurrency)} (payment details will be sent separately)</p>`
      : "";

  const confirmEmail = await renderEmail("booking_confirmation", {
    clientName: booking.clientName,
    sessionType: sessionConfig.label,
    date: dateStr,
    time: timeStr,
    duration: String(sessionConfig.durationMinutes),
    priceSection,
    teamsSection,
    confirmationUrl: `${baseUrl}/book/confirmation?token=${confirmationToken}`,
  }, baseUrl);

  const clientDetails = [
    `<p style="margin: 4px 0;"><strong>Client:</strong> ${escapeHtml(booking.clientName)}</p>`,
    `<p style="margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(booking.clientEmail)}</p>`,
    booking.clientPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${escapeHtml(booking.clientPhone)}</p>` : "",
    booking.clientNotes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${escapeHtml(booking.clientNotes)}</p>` : "",
  ].join("");

  const teamsLink = booking.teamsMeetingUrl
    ? `<p><strong>Teams link:</strong> <a href="${booking.teamsMeetingUrl}">${booking.teamsMeetingUrl}</a></p>`
    : "";

  const notifyEmail = await renderEmail("booking_notification", {
    sessionType: sessionConfig.label,
    clientName: booking.clientName,
    date: dateStr,
    time: timeStr,
    duration: String(sessionConfig.durationMinutes),
    clientDetails,
    teamsLink,
  }, baseUrl);

  await Promise.allSettled([
    sendEmail({ to: booking.clientEmail, ...confirmEmail, templateKey: "booking_confirmation", metadata: { bookingId: booking.id } }),
    sendEmail({
      to: settings.email || "hello@life-therapy.co.za",
      ...notifyEmail,
      templateKey: "booking_notification",
      metadata: { bookingId: booking.id },
    }),
  ]);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { confirmationSentAt: new Date() },
  });

  revalidatePath("/admin/bookings");
  redirect(`/book/confirmation?token=${confirmationToken}`);
}
