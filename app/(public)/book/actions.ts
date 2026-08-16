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
import { phoneError, normalizePhoneForStorage } from "@/lib/phone";
import { acceptRequiredDocuments } from "@/lib/legal-documents";
import { getSessionPrice } from "@/lib/pricing";
import { rateLimitBookingDb } from "@/lib/rate-limit-db";
import { getOptionalStudent } from "@/lib/student-auth";
import { getBalance, deductCredit } from "@/lib/credits";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SessionType } from "@/lib/generated/prisma/client";
import { upsertContact } from "@/lib/contacts";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { calendarDate } from "@/lib/dates";

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

type CreditIntent =
  | { ok: true; useCredit: false }
  | { ok: true; useCredit: true; studentId: string }
  | { ok: false; error: string };

/**
 * Decide whether this booking will be paid with a session credit — BEFORE anything
 * is created. Read-only on purpose.
 *
 * This used to run AFTER the booking row and the Graph calendar event existed, and
 * signalled refusal by throwing: "not logged in" or "no credits left" therefore left
 * a confirmed booking and a real diary event behind, for a session nobody had paid
 * for. Resolving first means a refusal costs nothing.
 */
async function resolveCreditIntent(wantsCredit: boolean, isFree: boolean): Promise<CreditIntent> {
  if (!wantsCredit || isFree) return { ok: true, useCredit: false };

  const student = await getOptionalStudent();
  if (!student) return { ok: false, error: "You must be logged in to use session credits." };

  // Postpaid clients don't use credits — their sessions are invoiced monthly, so the
  // booking must keep its full price. The price was previously zeroed on the caller's
  // `useSessionCredit` flag alone, which for a postpaid client both charged nothing
  // and deducted nothing: a free session.
  if (student.billingType === "postpaid") return { ok: true, useCredit: false };

  const balance = await getBalance(student.id);
  if (balance < 1) return { ok: false, error: "Insufficient session credits." };

  return { ok: true, useCredit: true, studentId: student.id };
}

/** Auto-provision portal access for free consultation bookings */
async function provisionFreeConsultation(
  bookingId: string,
  booking: { date: Date; startTime: string; endTime: string },
  client: { email: string; firstName: string; lastName: string; phone: string | null },
): Promise<string | null> {
  const existingStudent = await prisma.student.findUnique({
    where: { email: client.email },
  });

  if (existingStudent) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { studentId: existingStudent.id },
    });
    return existingStudent.id;
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
    return null;
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

  return student.id;
}

/**
 * Link booking to its student + sync to the Student list. Logged-in clients link to
 * their own record; otherwise the contact is upserted (a "potential" student) and the
 * booking is linked to it. Returns the studentId so the caller can record agreements.
 */
async function linkPaidBookingToStudent(
  bookingId: string,
  client: { email: string; firstName: string; lastName: string; phone: string | null },
): Promise<string | null> {
  const loggedInStudent = await getOptionalStudent();
  if (loggedInStudent) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { studentId: loggedInStudent.id },
    });
    return loggedInStudent.id;
  }

  try {
    const student = await upsertContact({
      email: client.email,
      firstName: client.firstName,
      lastName: client.lastName || undefined,
      phone: client.phone || undefined,
      source: "booking",
      consentGiven: true,
      consentMethod: "booking_form",
    });
    await prisma.booking.update({
      where: { id: bookingId },
      data: { studentId: student.id },
    });
    return student.id;
  } catch (err) {
    console.error("Failed to sync booking contact:", err);
    return null;
  }
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

/**
 * Refusals are RETURNED; only success redirects.
 *
 * Everything below used to throw. A thrown server-action message is stripped in
 * production — React replaces it with "An error occurred in the Server Components
 * render… a digest property is included" — and the booking form renders
 * `err.message` straight to the client. So a client who simply hadn't ticked the
 * Terms box was shown that wall of text, on the public booking page.
 */
export type CreateBookingResult = { error: string };

export async function createBooking(formData: FormData): Promise<CreateBookingResult | void> {
  // Rate limit by IP — DURABLE (the `rate_limits` table), not the in-memory Map.
  //
  // This is the most consequential unauthenticated write in the app: it takes a
  // slot in a finite diary, creates a Microsoft Graph event, and sends email. The
  // in-memory limiter keeps its counter inside ONE lambda, so on Vercel every warm
  // instance has its own — the real ceiling was `10 × warm instances`, and it reset
  // on every cold start. That bounds a careless script; it does not bound anyone
  // who cares. Login and password-reset were already on the durable limiter; this
  // belongs there too.
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (await rateLimitBookingDb(ip)) {
    return { error: "Too many booking attempts. Please try again later." };
  }

  const raw = Object.fromEntries(formData.entries());
  // safeParse, not parse: a ZodError is masked in production exactly like any other
  // throw, so a bad field showed the client the digest string instead of the field.
  const parsedResult = bookingFormSchema.safeParse({
    ...raw,
    clientPhone: raw.clientPhone || undefined,
    clientNotes: raw.clientNotes || undefined,
  });
  if (!parsedResult.success) {
    const issue = parsedResult.error.issues[0];
    const field = issue?.path?.join(".");
    return { error: field ? `${field}: ${issue.message}` : (issue?.message ?? "Please check the booking details and try again.") };
  }
  const parsed = parsedResult.data;

  // Validate + canonicalise the phone (E.164) once, reused for the booking + student
  const phoneErr = phoneError(parsed.clientPhone, false);
  if (phoneErr) return { error: `Phone number: ${phoneErr}` };
  const clientPhone = normalizePhoneForStorage(parsed.clientPhone);

  const sessionConfig = getSessionTypeConfig(parsed.sessionType as SessionType);

  // Terms + commitment: required for paid sessions, optional for free consultations.
  const agreedToTerms = raw.agreedToTerms === "true";
  if (!sessionConfig.isFree && !agreedToTerms) {
    return { error: "Please accept the Terms & Conditions and Therapeutic Commitment to book this session." };
  }

  // Compute session price in the user's currency
  const settings = await getSiteSettings();
  const currency = await getCurrency();
  const sessionPriceCents = sessionConfig.isFree
    ? 0
    : getSessionPrice(parsed.sessionType as "individual" | "couples", currency, settings);

  // Re-validate slot availability (race condition guard)
  const { slots } = await getAvailableSlots(parsed.date, sessionConfig);
  const slotAvailable = slots.some((s) => s.start === parsed.startTime);
  if (!slotAvailable) {
    return { error: "This time slot is no longer available. Please choose another." };
  }

  // Resolve the credit decision while a refusal is still free — see resolveCreditIntent.
  const wantsCredit = raw.useSessionCredit === "true";
  const creditIntent = await resolveCreditIntent(wantsCredit, sessionConfig.isFree);
  if (!creditIntent.ok) return { error: creditIntent.error };

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

  // Create booking in DB
  const bookingDate = calendarDate(parsed.date);
  const booking = await prisma.booking.create({
    data: {
      sessionType: parsed.sessionType as SessionType,
      date: bookingDate,
      startTime: parsed.startTime,
      endTime,
      durationMinutes: sessionConfig.durationMinutes,
      priceZarCents: creditIntent.useCredit ? 0 : sessionPriceCents,
      priceCurrency: currency,
      clientName: parsed.clientName,
      clientEmail: parsed.clientEmail,
      clientPhone,
      clientNotes: parsed.clientNotes || null,
      status: "confirmed",
      graphEventId: graphResult?.eventId || null,
      teamsMeetingUrl: graphResult?.teamsMeetingUrl || null,
      confirmationToken,
      originalDate: bookingDate,
      originalStartTime: parsed.startTime,
    },
  });

  // Deduct the credit now that the booking it pays for exists.
  if (creditIntent.useCredit) {
    await deductCredit(creditIntent.studentId, booking.id, `Session booking: ${sessionConfig.label}`);
  }

  // Link booking to student / auto-provision portal
  const nameParts = parsed.clientName.trim().split(/\s+/);
  const client = {
    email: parsed.clientEmail,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || "",
    phone: clientPhone,
  };

  let studentId: string | null = null;
  if (sessionConfig.isFree) {
    studentId = await provisionFreeConsultation(booking.id, booking, client).catch((err) => {
      console.error("Auto-provisioning failed:", err);
      return null;
    });
  } else {
    studentId = await linkPaidBookingToStudent(booking.id, client);
  }

  // Record terms + commitment acceptance against the linked student (IP + timestamp).
  // Stored on the student, so it carries through to active once they convert.
  if (agreedToTerms && studentId) {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = hdrs.get("user-agent") ?? null;
    await acceptRequiredDocuments(studentId, ip, ua);
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

/**
 * Record terms + commitment acceptance from the booking confirmation page — the no-login
 * path for clients (typically free consultations) who didn't accept at booking. Resolves
 * the student from the booking's confirmation token, so no auth is required.
 */
export async function acceptBookingAgreementsAction(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    select: { studentId: true },
  });
  if (!booking?.studentId) {
    return { success: false, error: "We couldn't find your booking. Please use the link from your confirmation email." };
  }

  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = hdrs.get("user-agent") ?? null;
    await acceptRequiredDocuments(booking.studentId, ip, ua);
    revalidatePath("/book/confirmation");
    return { success: true };
  } catch (err) {
    console.error("Failed to record booking agreements:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
