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
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateTempPassword } from "@/lib/auth/temp-password";

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Handle session credit validation and deduction */
async function handleSessionCredit(
  wantsCredit: boolean,
  isFree: boolean,
  bookingId: string,
  sessionLabel: string,
): Promise<{ paidWithCredit: boolean }> {
  if (!wantsCredit || isFree) return { paidWithCredit: false };

  const student = await getOptionalStudent();
  if (!student) throw new Error("You must be logged in to use session credits.");

  // Postpaid clients don't use credits — sessions are invoiced monthly
  if (student.billingType === "postpaid") return { paidWithCredit: false };

  const balance = await getBalance(student.id);
  if (balance < 1) throw new Error("Insufficient session credits.");

  await deductCredit(student.id, bookingId, `Session booking: ${sessionLabel}`);
  return { paidWithCredit: true };
}

/** Auto-provision portal access for free consultation bookings */
async function provisionFreeConsultation(
  bookingId: string,
  booking: { date: Date; startTime: string; endTime: string },
  client: { email: string; firstName: string; lastName: string; phone: string | null },
) {
  const existingStudent = await prisma.student.findUnique({
    where: { email: client.email },
  });

  if (existingStudent) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { studentId: existingStudent.id },
    });
    return;
  }

  const tempPassword = generateTempPassword();
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: client.email,
      password: tempPassword,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    console.error("Failed to create auth user for booking:", authError?.message);
    return;
  }

  const student = await prisma.student.create({
    data: {
      supabaseUserId: authData.user.id,
      email: client.email,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      mustChangePassword: true,
      clientStatus: "potential",
      source: "booking",
      onboardingStep: 0,
      consentGiven: true,
      consentDate: new Date(),
      consentMethod: "booking_form",
      intake: { create: {} },
      bookings: { connect: { id: bookingId } },
    },
  });

  // Send portal welcome email (non-blocking)
  const baseUrlForEmail = await getBaseUrl();
  const dateStr = format(new Date(booking.date), "EEEE, d MMMM yyyy");
  const timeStr = `${booking.startTime} – ${booking.endTime} (SAST)`;

  renderEmail("portal_welcome", {
    firstName: client.firstName,
    email: client.email,
    tempPassword,
    loginUrl: `${baseUrlForEmail}/login`,
    sessionDate: dateStr,
    sessionTime: timeStr,
  }, baseUrlForEmail).then(({ subject, html }) =>
    sendEmail({
      to: client.email,
      subject,
      html,
      templateKey: "portal_welcome",
      studentId: student.id,
    })
  ).catch((err) =>
    console.error("Failed to send portal welcome email:", err)
  );
}

/** Link booking to logged-in student + sync to Student list */
async function linkPaidBookingToStudent(
  bookingId: string,
  client: { email: string; firstName: string; lastName: string; phone: string | null },
) {
  const loggedInStudent = await getOptionalStudent();
  if (loggedInStudent) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { studentId: loggedInStudent.id },
    });
  }

  upsertContact({
    email: client.email,
    firstName: client.firstName,
    lastName: client.lastName || undefined,
    phone: client.phone || undefined,
    source: "booking",
    consentGiven: true,
    consentMethod: "booking_form",
  }).catch((err) => console.error("Failed to sync booking contact:", err));
}

/** Send booking confirmation + admin notification emails */
async function sendBookingEmails(
  booking: {
    id: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string | null;
    clientNotes: string | null;
    date: Date;
    startTime: string;
    endTime: string;
    priceZarCents: number;
    priceCurrency: string | null;
    teamsMeetingUrl: string | null;
  },
  sessionLabel: string,
  durationMinutes: number,
  confirmationToken: string,
  notifyAddress: string,
) {
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
    sessionType: sessionLabel,
    date: dateStr,
    time: timeStr,
    duration: String(durationMinutes),
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
    sessionType: sessionLabel,
    clientName: booking.clientName,
    date: dateStr,
    time: timeStr,
    duration: String(durationMinutes),
    clientDetails,
    teamsLink,
  }, baseUrl);

  await Promise.allSettled([
    sendEmail({ to: booking.clientEmail, ...confirmEmail, templateKey: "booking_confirmation", metadata: { bookingId: booking.id } }),
    sendEmail({
      to: notifyAddress,
      ...notifyEmail,
      templateKey: "booking_notification",
      metadata: { bookingId: booking.id },
    }),
  ]);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { confirmationSentAt: new Date() },
  });
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
  const endTime = formatMinutesToTime(startMins + sessionConfig.durationMinutes);

  // Create Exchange calendar event with Teams link
  const graphResult = await createCalendarEvent({
    subject: `${sessionConfig.label} — ${parsed.clientName}`,
    startDateTime: `${parsed.date}T${parsed.startTime}:00`,
    endDateTime: `${parsed.date}T${endTime}:00`,
    clientName: parsed.clientName,
    clientEmail: parsed.clientEmail,
    description: parsed.clientNotes || "",
  });

  const confirmationToken = randomUUID();
  const wantsCredit = raw.useSessionCredit === "true";

  // Create booking in DB
  const bookingDate = new Date(`${parsed.date}T00:00:00Z`);
  const booking = await prisma.booking.create({
    data: {
      sessionType: parsed.sessionType as SessionType,
      date: bookingDate,
      startTime: parsed.startTime,
      endTime,
      durationMinutes: sessionConfig.durationMinutes,
      priceZarCents: wantsCredit && !sessionConfig.isFree ? 0 : sessionPriceCents,
      priceCurrency: currency,
      clientName: parsed.clientName,
      clientEmail: parsed.clientEmail,
      clientPhone: parsed.clientPhone || null,
      clientNotes: parsed.clientNotes || null,
      status: "confirmed",
      graphEventId: graphResult?.eventId || null,
      teamsMeetingUrl: graphResult?.teamsMeetingUrl || null,
      confirmationToken,
      originalDate: bookingDate,
      originalStartTime: parsed.startTime,
    },
  });

  // Handle session credit deduction
  await handleSessionCredit(wantsCredit, sessionConfig.isFree, booking.id, sessionConfig.label);

  // Link booking to student / auto-provision portal
  const nameParts = parsed.clientName.trim().split(/\s+/);
  const client = {
    email: parsed.clientEmail,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || "",
    phone: parsed.clientPhone || null,
  };

  if (sessionConfig.isFree) {
    await provisionFreeConsultation(booking.id, booking, client).catch((err) =>
      console.error("Auto-provisioning failed:", err)
    );
  } else {
    await linkPaidBookingToStudent(booking.id, client);
  }

  // Send emails
  await sendBookingEmails(
    booking,
    sessionConfig.label,
    sessionConfig.durationMinutes,
    confirmationToken,
    settings.email || "hello@life-therapy.co.za",
  );

  revalidatePath("/admin/bookings");
  redirect(`/book/confirmation?token=${confirmationToken}`);
}
