"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cancelCalendarEvent, createCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { getBalance, deductCredit } from "@/lib/credits";
import { getSiteSettings } from "@/lib/settings";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { generateRecurringDates, type RecurringPattern } from "@/lib/recurring-dates";
import type { BookingStatus, SessionType } from "@/lib/generated/prisma/client";

export async function updateBookingStatus(id: string, status: BookingStatus) {
  await requireRole("super_admin", "editor");

  const billingNote =
    status === "cancelled"
      ? "(cancelled)"
      : status === "no_show"
        ? "(no-show)"
        : undefined;

  const booking = await prisma.booking.update({
    where: { id },
    data: { status, ...(billingNote ? { billingNote } : {}) },
  });

  if (status === "cancelled") {
    if (booking.graphEventId) {
      await cancelCalendarEvent(booking.graphEventId).catch(console.error);
    }
    const config = getSessionTypeConfig(booking.sessionType);
    const email = await renderEmail("booking_cancellation", {
      clientName: booking.clientName,
      sessionType: config.label,
      date: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
      time: `${booking.startTime} – ${booking.endTime} (SAST)`,
      bookUrl: "https://life-therapy.co.za/book",
    });
    await sendEmail({ to: booking.clientEmail, ...email, templateKey: "booking_cancellation", metadata: { bookingId: id } }).catch(console.error);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
}

export async function updateBookingNotes(id: string, formData: FormData) {
  await requireRole("super_admin", "editor");

  const adminNotes = formData.get("adminNotes") as string;
  await prisma.booking.update({
    where: { id },
    data: { adminNotes },
  });

  revalidatePath(`/admin/bookings/${id}`);
}

export async function deleteBooking(id: string) {
  await requireRole("super_admin");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (booking?.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId).catch(console.error);
  }

  await prisma.booking.delete({ where: { id } });
  revalidatePath("/admin/bookings");
}

export async function rescheduleBooking(
  id: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
) {
  await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");

  // Cancel old calendar event
  if (booking.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId).catch(console.error);
  }

  // Create new calendar event
  const config = getSessionTypeConfig(booking.sessionType);
  const dateObj = new Date(newDate + "T00:00:00Z");
  const calResult = await createCalendarEvent({
    subject: `${config.label} — ${booking.clientName}`,
    startDateTime: `${newDate}T${newStartTime}:00`,
    endDateTime: `${newDate}T${newEndTime}:00`,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
  }).catch(() => null);

  // Update booking record
  await prisma.booking.update({
    where: { id },
    data: {
      originalDate: booking.originalDate || booking.date,
      originalStartTime: booking.originalStartTime || booking.startTime,
      rescheduledAt: new Date(),
      rescheduleCount: { increment: 1 },
      billingNote: "(rescheduled)",
      date: dateObj,
      startTime: newStartTime,
      endTime: newEndTime,
      graphEventId: calResult?.eventId || null,
      teamsMeetingUrl: calResult?.teamsMeetingUrl || booking.teamsMeetingUrl,
    },
  });

  // Notify client
  const email = await renderEmail("booking_reschedule", {
    clientName: booking.clientName,
    sessionType: config.label,
    oldDate: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
    oldTime: `${booking.startTime} – ${booking.endTime} (SAST)`,
    newDate: format(dateObj, "EEEE, d MMMM yyyy"),
    newTime: `${newStartTime} – ${newEndTime} (SAST)`,
    teamsUrl: calResult?.teamsMeetingUrl || booking.teamsMeetingUrl || "",
  }).catch(() => null);

  if (email) {
    await sendEmail({
      to: booking.clientEmail,
      ...email,
      templateKey: "booking_reschedule",
      metadata: { bookingId: id },
    }).catch(console.error);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  redirect(`/admin/bookings/${id}`);
}

// ────────────────────────────────────────────────────────────
// Admin: Create booking on behalf of a client
// ────────────────────────────────────────────────────────────

interface AdminCreateBookingData {
  studentId: string;
  sessionType: SessionType;
  date: string;
  startTime: string;
  endTime: string;
  useCredit: boolean;
  adminNotes?: string;
  couplesPartnerName?: string;
}

export async function adminCreateBookingAction(data: AdminCreateBookingData) {
  await requireRole("super_admin", "editor");

  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, billingType: true },
  });
  if (!student) throw new Error("Client not found");

  const config = getSessionTypeConfig(data.sessionType);
  const isPostpaid = student.billingType === "postpaid";

  // Validate slot availability (race condition guard)
  const slots = await getAvailableSlots(data.date, config);
  const slotAvailable = slots.some((s) => s.start === data.startTime);
  if (!slotAvailable) {
    throw new Error("This time slot is no longer available. Please choose another.");
  }

  // Credit check (skip for postpaid — session will be invoiced monthly)
  if (data.useCredit && !config.isFree && !isPostpaid) {
    const balance = await getBalance(student.id);
    if (balance < 1) throw new Error("Client has insufficient session credits.");
  }

  const clientName = `${student.firstName} ${student.lastName}`.trim();
  const bookingDate = new Date(`${data.date}T00:00:00Z`);
  const confirmationToken = randomUUID();

  // Create calendar event
  const calResult = await createCalendarEvent({
    subject: `${config.label} — ${clientName}`,
    startDateTime: `${data.date}T${data.startTime}:00`,
    endDateTime: `${data.date}T${data.endTime}:00`,
    clientName,
    clientEmail: student.email,
  }).catch(() => null);

  // Create booking record
  const booking = await prisma.booking.create({
    data: {
      sessionType: data.sessionType,
      date: bookingDate,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: config.durationMinutes,
      priceZarCents: 0,
      priceCurrency: "ZAR",
      clientName,
      clientEmail: student.email,
      clientPhone: student.phone || null,
      status: "confirmed",
      adminNotes: data.adminNotes || null,
      couplesPartnerName: data.couplesPartnerName || null,
      graphEventId: calResult?.eventId || null,
      teamsMeetingUrl: calResult?.teamsMeetingUrl || null,
      confirmationToken,
      originalDate: bookingDate,
      originalStartTime: data.startTime,
      studentId: student.id,
    },
  });

  // Deduct credit (skip for postpaid clients)
  if (data.useCredit && !config.isFree && !isPostpaid) {
    await deductCredit(
      student.id,
      booking.id,
      `${config.label} — ${format(bookingDate, "d MMM yyyy")}`,
    );
  }

  // Send confirmation email
  try {
    const settings = await getSiteSettings();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";
    const dateStr = format(bookingDate, "EEEE, d MMMM yyyy");
    const timeStr = `${data.startTime} – ${data.endTime} (SAST)`;

    const teamsSection = calResult?.teamsMeetingUrl
      ? `<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p>
          <a href="${calResult.teamsMeetingUrl}" style="color: #8BA889; font-weight: 600; word-break: break-all;">${calResult.teamsMeetingUrl}</a>
        </div>`
      : "";

    const confirmEmail = await renderEmail("booking_confirmation", {
      clientName,
      sessionType: config.label,
      date: dateStr,
      time: timeStr,
      duration: String(config.durationMinutes),
      priceSection: "",
      teamsSection,
      confirmationUrl: `${baseUrl}/book/confirmation?token=${confirmationToken}`,
    }, baseUrl);

    await sendEmail({
      to: student.email,
      ...confirmEmail,
      templateKey: "booking_confirmation",
      studentId: student.id,
      metadata: { bookingId: booking.id },
    });

    // Notify admin
    const notifyEmail = await renderEmail("booking_notification", {
      sessionType: config.label,
      clientName,
      date: dateStr,
      time: timeStr,
      duration: String(config.durationMinutes),
      clientDetails: `<p style="margin: 4px 0;"><strong>Client:</strong> ${clientName}</p><p style="margin: 4px 0;"><strong>Email:</strong> ${student.email}</p>${student.phone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${student.phone}</p>` : ""}`,
      teamsLink: calResult?.teamsMeetingUrl
        ? `<p><strong>Teams link:</strong> <a href="${calResult.teamsMeetingUrl}">${calResult.teamsMeetingUrl}</a></p>`
        : "",
    }, baseUrl);

    await sendEmail({
      to: settings.email || "hello@life-therapy.co.za",
      ...notifyEmail,
      templateKey: "booking_notification",
      metadata: { bookingId: booking.id },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmationSentAt: new Date() },
    });
  } catch {
    // Email failure shouldn't block booking creation
  }

  revalidatePath("/admin/bookings");
  return { success: true, bookingId: booking.id };
}

// ────────────────────────────────────────────────────────────
// Admin: Create recurring booking series
// ────────────────────────────────────────────────────────────

interface AdminCreateRecurringData {
  studentId: string;
  sessionType: SessionType;
  startDate: string;
  startTime: string;
  endTime: string;
  pattern: RecurringPattern;
  months: number;
  useCredits: boolean;
  adminNotes?: string;
  couplesPartnerName?: string;
}

export async function adminCreateRecurringBookingsAction(data: AdminCreateRecurringData) {
  await requireRole("super_admin", "editor");

  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, billingType: true },
  });
  if (!student) throw new Error("Client not found");

  const config = getSessionTypeConfig(data.sessionType);
  const isPostpaid = student.billingType === "postpaid";
  const clientName = `${student.firstName} ${student.lastName}`.trim();
  const dates = generateRecurringDates(data.startDate, data.pattern, data.months);

  // Check credits (skip for postpaid — sessions will be invoiced monthly)
  let creditsRemaining = 0;
  if (data.useCredits && !config.isFree && !isPostpaid) {
    creditsRemaining = await getBalance(student.id);
  }

  const recurringSeriesId = randomUUID();
  const createdDates: string[] = [];
  const skippedDates: { date: string; reason: string }[] = [];
  let creditsUsed = 0;

  for (const dateStr of dates) {
    // Validate slot availability
    const slots = await getAvailableSlots(dateStr, config);
    const slotAvailable = slots.some((s) => s.start === data.startTime);
    if (!slotAvailable) {
      skippedDates.push({ date: dateStr, reason: "Slot unavailable" });
      continue;
    }

    const bookingDate = new Date(`${dateStr}T00:00:00Z`);
    const confirmationToken = randomUUID();

    // Create calendar event
    const calResult = await createCalendarEvent({
      subject: `${config.label} — ${clientName}`,
      startDateTime: `${dateStr}T${data.startTime}:00`,
      endDateTime: `${dateStr}T${data.endTime}:00`,
      clientName,
      clientEmail: student.email,
    }).catch(() => null);

    // Create booking record
    const booking = await prisma.booking.create({
      data: {
        sessionType: data.sessionType,
        date: bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: config.durationMinutes,
        priceZarCents: 0,
        priceCurrency: "ZAR",
        clientName,
        clientEmail: student.email,
        clientPhone: student.phone || null,
        status: "confirmed",
        adminNotes: data.adminNotes || null,
        couplesPartnerName: data.couplesPartnerName || null,
        graphEventId: calResult?.eventId || null,
        teamsMeetingUrl: calResult?.teamsMeetingUrl || null,
        confirmationToken,
        originalDate: bookingDate,
        originalStartTime: data.startTime,
        studentId: student.id,
        recurringSeriesId,
        recurringPattern: data.pattern,
      },
    });

    // Deduct credit if available (skip for postpaid)
    if (data.useCredits && !config.isFree && !isPostpaid && creditsRemaining > 0) {
      await deductCredit(
        student.id,
        booking.id,
        `${config.label} — ${format(bookingDate, "d MMM yyyy")}`,
      );
      creditsRemaining--;
      creditsUsed++;
    }

    createdDates.push(dateStr);
  }

  // Send single summary email
  if (createdDates.length > 0) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";
      const patternLabels: Record<string, string> = {
        weekly: "weekly",
        bimonthly: "bi-monthly (every 2 weeks)",
        monthly: "monthly",
      };

      const dateListHtml = createdDates
        .map((d) => {
          const formatted = format(new Date(d + "T12:00:00"), "EEEE, d MMMM yyyy");
          return `<li style="margin: 4px 0;">${formatted} at ${data.startTime} – ${data.endTime} (SAST)</li>`;
        })
        .join("");

      const skippedHtml =
        skippedDates.length > 0
          ? `<p style="margin-top: 16px; color: #6b7280;">Note: ${skippedDates.length} date(s) were skipped due to unavailability.</p>`
          : "";

      const email = await renderEmail(
        "booking_recurring_series",
        {
          clientName,
          sessionType: config.label,
          pattern: patternLabels[data.pattern] || data.pattern,
          sessionCount: String(createdDates.length),
          dateList: `<ul style="padding-left: 20px; margin: 12px 0;">${dateListHtml}</ul>`,
          skippedNote: skippedHtml,
          portalUrl: `${baseUrl}/portal/bookings`,
        },
        baseUrl,
      );

      await sendEmail({
        to: student.email,
        ...email,
        templateKey: "booking_recurring_series",
        studentId: student.id,
        metadata: { recurringSeriesId },
      });
    } catch {
      // Email failure shouldn't block series creation
    }
  }

  revalidatePath("/admin/bookings");
  return {
    created: createdDates.length,
    skipped: skippedDates,
    creditsUsed,
    seriesId: recurringSeriesId,
  };
}

// ────────────────────────────────────────────────────────────
// Search clients for booking dialog
// ────────────────────────────────────────────────────────────

export async function getClientsForBookingAction(search?: string) {
  await requireRole("super_admin", "editor");

  const where: Record<string, unknown> = {
    clientStatus: { in: ["active", "potential"] },
  };

  if (search && search.trim()) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.student.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, email: true, clientStatus: true },
    take: 20,
    orderBy: { firstName: "asc" },
  });
}

// ────────────────────────────────────────────────────────────
// Get client credit balance for booking dialog
// ────────────────────────────────────────────────────────────

export async function getClientCreditBalance(studentId: string) {
  await requireRole("super_admin", "editor");
  return getBalance(studentId);
}

// ────────────────────────────────────────────────────────────
// Get linked partners for couples booking
// ────────────────────────────────────────────────────────────

export async function getClientPartnersAction(studentId: string) {
  await requireRole("super_admin", "editor");

  const relationships = await prisma.clientRelationship.findMany({
    where: {
      relationshipType: "partner",
      OR: [
        { studentId, relatedStudentId: { not: null } },
        { relatedStudentId: studentId },
      ],
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      relatedStudent: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Return the "other" person in each relationship
  const partners: { id: string; firstName: string; lastName: string }[] = [];
  for (const rel of relationships) {
    if (rel.studentId === studentId && rel.relatedStudent) {
      partners.push(rel.relatedStudent);
    } else if (rel.relatedStudentId === studentId && rel.student) {
      partners.push(rel.student);
    }
  }

  return partners;
}
