"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePasswordChanged } from "@/lib/student-auth";
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
import { getBalance, deductCredit } from "@/lib/credits";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SessionType } from "@/lib/generated/prisma/client";
import { z } from "zod";

const portalBookingSchema = z.object({
  sessionType: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  clientNotes: z.string().max(1000).optional(),
  useSessionCredit: z.boolean().optional(),
  partnerName: z.string().min(2).optional(),
  partnerEmail: z.email().optional(),
  partnerPhone: z.string().optional(),
});

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Resolve couples partner name from linked relationship or form input */
async function resolveCouplesPartner(
  studentId: string,
  partnerName?: string,
): Promise<string | null> {
  const partnerRel = await prisma.clientRelationship.findFirst({
    where: { studentId, relationshipType: "partner" },
    include: { relatedStudent: { select: { firstName: true, lastName: true } } },
  });
  if (partnerRel?.relatedStudent) {
    return `${partnerRel.relatedStudent.firstName} ${partnerRel.relatedStudent.lastName || ""}`.trim();
  }
  return partnerName || null;
}

/** Send booking confirmation + admin notification emails */
async function sendPortalBookingEmails(opts: {
  booking: { id: string; date: Date; startTime: string; endTime: string; priceZarCents: number; priceCurrency: string | null; teamsMeetingUrl: string | null };
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientNotes: string | null;
  sessionLabel: string;
  durationMinutes: number;
  confirmationToken: string;
  notifyAddress: string;
}) {
  const { booking, clientName, clientEmail, clientPhone, clientNotes, sessionLabel, durationMinutes, confirmationToken, notifyAddress } = opts;
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
    clientName,
    sessionType: sessionLabel,
    date: dateStr,
    time: timeStr,
    duration: String(durationMinutes),
    priceSection,
    teamsSection,
    confirmationUrl: `${baseUrl}/portal/book/confirmation?token=${confirmationToken}`,
  }, baseUrl);

  const clientDetails = [
    `<p style="margin: 4px 0;"><strong>Client:</strong> ${escapeHtml(clientName)}</p>`,
    `<p style="margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(clientEmail)}</p>`,
    clientPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${escapeHtml(clientPhone)}</p>` : "",
    clientNotes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${escapeHtml(clientNotes)}</p>` : "",
  ].join("");

  const teamsLink = booking.teamsMeetingUrl
    ? `<p><strong>Teams link:</strong> <a href="${booking.teamsMeetingUrl}">${booking.teamsMeetingUrl}</a></p>`
    : "";

  const notifyEmail = await renderEmail("booking_notification", {
    sessionType: sessionLabel,
    clientName,
    date: dateStr,
    time: timeStr,
    duration: String(durationMinutes),
    clientDetails,
    teamsLink,
  }, baseUrl);

  await Promise.allSettled([
    sendEmail({ to: clientEmail, ...confirmEmail, templateKey: "booking_confirmation", metadata: { bookingId: booking.id } }),
    sendEmail({ to: notifyAddress, ...notifyEmail, templateKey: "booking_notification", metadata: { bookingId: booking.id } }),
  ]);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { confirmationSentAt: new Date() },
  });
}

export async function createPortalBooking(formData: FormData) {
  const { student } = await requirePasswordChanged();

  const raw = Object.fromEntries(formData.entries());
  const parsed = portalBookingSchema.parse({
    sessionType: raw.sessionType,
    date: raw.date,
    startTime: raw.startTime,
    clientNotes: raw.clientNotes || undefined,
    useSessionCredit: raw.useSessionCredit === "true",
  });

  const sessionConfig = getSessionTypeConfig(parsed.sessionType as SessionType);

  // Fetch full student record for name/email
  const studentRecord = await prisma.student.findUniqueOrThrow({
    where: { id: student.id },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, billingType: true, clientStatus: true },
  });

  // One free consultation per client — check if they've ever had one (any status)
  if (sessionConfig.isFree) {
    const existingFree = await prisma.booking.findFirst({
      where: { studentId: studentRecord.id, sessionType: "free_consultation" },
      select: { id: true },
    });
    if (existingFree) {
      throw new Error("You have already used your free consultation.");
    }
  }

  const clientName = `${studentRecord.firstName} ${studentRecord.lastName || ""}`.trim();

  // Compute session price
  const settings = await getSiteSettings();
  const currency = await getCurrency();
  const sessionPriceCents = sessionConfig.isFree
    ? 0
    : getSessionPrice(parsed.sessionType as "individual" | "couples", currency, settings);

  // Re-validate slot availability (race condition guard)
  const slots = await getAvailableSlots(parsed.date, sessionConfig);
  const slotAvailable = slots.some((s) => s.start === parsed.startTime);
  if (!slotAvailable) {
    throw new Error("This time slot is no longer available. Please choose another.");
  }

  // Calculate end time
  const startMins = parseTimeToMinutes(parsed.startTime);
  const endTime = formatMinutesToTime(startMins + sessionConfig.durationMinutes);

  // Create Exchange calendar event with Teams link
  const graphResult = await createCalendarEvent({
    subject: `${sessionConfig.label} — ${clientName}`,
    startDateTime: `${parsed.date}T${parsed.startTime}:00`,
    endDateTime: `${parsed.date}T${endTime}:00`,
    clientName,
    clientEmail: studentRecord.email,
    description: parsed.clientNotes || "",
  });

  const confirmationToken = randomUUID();
  const wantsCredit = parsed.useSessionCredit ?? false;

  // Couples partner name (from linked partner or form input)
  const couplesPartnerName = parsed.sessionType === "couples"
    ? await resolveCouplesPartner(studentRecord.id, parsed.partnerName)
    : null;

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
      clientName,
      clientEmail: studentRecord.email,
      clientPhone: studentRecord.phone || null,
      clientNotes: parsed.clientNotes || null,
      couplesPartnerName,
      status: "confirmed",
      graphEventId: graphResult?.eventId || null,
      teamsMeetingUrl: graphResult?.teamsMeetingUrl || null,
      confirmationToken,
      originalDate: bookingDate,
      originalStartTime: parsed.startTime,
      studentId: studentRecord.id,
    },
  });

  // Handle session credit deduction
  if (wantsCredit && !sessionConfig.isFree && studentRecord.billingType !== "postpaid") {
    const balance = await getBalance(studentRecord.id);
    if (balance < 1) throw new Error("Insufficient session credits.");
    await deductCredit(studentRecord.id, booking.id, `Session booking: ${sessionConfig.label}`);
  }

  // Send emails
  await sendPortalBookingEmails({
    booking,
    clientName,
    clientEmail: studentRecord.email,
    clientPhone: studentRecord.phone || null,
    clientNotes: parsed.clientNotes || null,
    sessionLabel: sessionConfig.label,
    durationMinutes: sessionConfig.durationMinutes,
    confirmationToken,
    notifyAddress: settings.email || "hello@life-therapy.co.za",
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/portal/bookings");
  redirect(`/portal/book/confirmation?token=${confirmationToken}`);
}
