"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelCalendarEvent, createCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { getBalance, deductCredit } from "@/lib/credits";
import { getSiteSettings } from "@/lib/settings";
import { format } from "date-fns";
import { randomUUID } from "node:crypto";
import { generateRecurringDatesUntil, type RecurringPattern } from "@/lib/recurring-dates";
import type { BookingStatus, SessionMode, SessionType } from "@/lib/generated/prisma/client";

export async function updateBookingStatus(id: string, status: BookingStatus) {
  await requireRole("super_admin", "editor");

  const billingNotes: Partial<Record<BookingStatus, string>> = {
    cancelled: "(cancelled)",
    no_show: "(no-show)",
  };
  const billingNote = billingNotes[status];

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
  redirect("/admin/bookings");
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
// Reschedule entire recurring series (future bookings only)
// ────────────────────────────────────────────────────────────

export async function rescheduleSeriesAction(
  seriesId: string,
  newDayOfWeek: number, // 1=Mon..5=Fri
  newStartTime: string, // HH:mm
): Promise<{ updated: number; skipped: { id: string; date: string; reason: string }[] }> {
  await requireRole("super_admin", "editor");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all future confirmed/pending bookings in this series
  const bookings = await prisma.booking.findMany({
    where: {
      recurringSeriesId: seriesId,
      status: { in: ["confirmed", "pending"] },
      date: { gte: today },
    },
    orderBy: { date: "asc" },
  });

  if (bookings.length === 0) return { updated: 0, skipped: [] };

  // Compute end time from the first booking's duration
  const duration = bookings[0].durationMinutes || 60;
  const [startH, startM] = newStartTime.split(":").map(Number);
  const endH = startH + Math.floor((startM + duration) / 60);
  const endM = (startM + duration) % 60;
  const newEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const { isSAPublicHoliday } = await import("@/lib/sa-holidays");

  let updated = 0;
  const skipped: { id: string; date: string; reason: string }[] = [];

  for (const booking of bookings) {
    const oldDate = new Date(booking.date);
    const oldDow = oldDate.getUTCDay();
    const diff = newDayOfWeek - oldDow;
    const newDate = new Date(oldDate);
    newDate.setUTCDate(newDate.getUTCDate() + diff);
    const newDateStr = newDate.toISOString().slice(0, 10);

    // Check for conflicts — skip if any found
    let skipReason: string | null = null;

    if (isSAPublicHoliday(newDate)) {
      skipReason = "Public holiday";
    } else {
      const override = await prisma.availabilityOverride.findUnique({
        where: { date: new Date(newDateStr + "T00:00:00Z") },
      });
      if (override?.isBlocked) {
        skipReason = `Day blocked${override.reason ? `: ${override.reason}` : ""}`;
      } else {
        const existing = await prisma.booking.findFirst({
          where: {
            date: new Date(newDateStr + "T00:00:00Z"),
            startTime: { lte: newEndTime },
            endTime: { gte: newStartTime },
            status: { in: ["confirmed", "pending"] },
            id: { not: booking.id },
            recurringSeriesId: { not: seriesId },
          },
          select: { clientName: true, startTime: true },
        });
        if (existing) {
          skipReason = `Conflicts with ${existing.clientName} at ${existing.startTime}`;
        }
      }
    }

    if (skipReason) {
      skipped.push({
        id: booking.id,
        date: format(newDate, "EEE d MMM yyyy"),
        reason: skipReason,
      });
      continue;
    }

    // No conflict — proceed with reschedule
    if (booking.graphEventId) {
      await cancelCalendarEvent(booking.graphEventId).catch(console.error);
    }

    const config = getSessionTypeConfig(booking.sessionType);
    const calResult = await createCalendarEvent({
      subject: `${config.label} — ${booking.clientName}`,
      startDateTime: `${newDateStr}T${newStartTime}:00`,
      endDateTime: `${newDateStr}T${newEndTime}:00`,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
    }).catch(() => null);

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        date: new Date(newDateStr + "T00:00:00Z"),
        startTime: newStartTime,
        endTime: newEndTime,
        graphEventId: calResult?.eventId || null,
        teamsMeetingUrl: calResult?.teamsMeetingUrl || booking.teamsMeetingUrl,
      },
    });

    updated++;
  }

  // Notify client
  const first = bookings[0];
  const cfgLabel = getSessionTypeConfig(first.sessionType).label;
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][newDayOfWeek];

  try {
    const email = await renderEmail("booking_reschedule", {
      clientName: first.clientName,
      sessionType: cfgLabel,
      oldDate: "Recurring series",
      oldTime: `${first.startTime} – ${first.endTime} (SAST)`,
      newDate: `Every ${dayName}`,
      newTime: `${newStartTime} – ${newEndTime} (SAST)`,
      teamsMeetingUrl: bookings[0].teamsMeetingUrl ?? "",
      bookUrl: "https://life-therapy.co.za/book",
    });
    await sendEmail({
      to: first.clientEmail,
      ...email,
      templateKey: "booking_reschedule",
      metadata: { seriesId },
    });
  } catch (err) {
    console.error("Failed to send series reschedule email:", err);
  }

  revalidatePath("/admin/bookings");
  return { updated, skipped };
}

// ────────────────────────────────────────────────────────────
// Check conflicts for a proposed series reschedule
// ────────────────────────────────────────────────────────────

export async function checkSeriesConflictsAction(
  seriesId: string,
  newDayOfWeek: number,
  newStartTime: string,
): Promise<{ date: string; conflict: string | null }[]> {
  await requireRole("super_admin", "editor");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      recurringSeriesId: seriesId,
      status: { in: ["confirmed", "pending"] },
      date: { gte: today },
    },
    orderBy: { date: "asc" },
  });

  if (bookings.length === 0) return [];

  const duration = bookings[0].durationMinutes || 60;
  const [startH, startM] = newStartTime.split(":").map(Number);
  const endH = startH + Math.floor((startM + duration) / 60);
  const endM = (startM + duration) % 60;
  const newEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const results: { date: string; conflict: string | null }[] = [];

  for (const booking of bookings) {
    const oldDate = new Date(booking.date);
    const oldDow = oldDate.getUTCDay();
    const diff = newDayOfWeek - oldDow;
    const newDate = new Date(oldDate);
    newDate.setUTCDate(newDate.getUTCDate() + diff);
    const newDateStr = newDate.toISOString().slice(0, 10);

    // Check for existing bookings on that date/time (excluding this series)
    const existing = await prisma.booking.findFirst({
      where: {
        date: new Date(newDateStr + "T00:00:00Z"),
        startTime: { lte: newEndTime },
        endTime: { gte: newStartTime },
        status: { in: ["confirmed", "pending"] },
        id: { not: booking.id },
        recurringSeriesId: { not: seriesId },
      },
      select: { clientName: true, startTime: true },
    });

    // Check availability overrides (blocked days)
    const override = await prisma.availabilityOverride.findUnique({
      where: { date: new Date(newDateStr + "T00:00:00Z") },
    });

    // Check SA public holidays
    const { isSAPublicHoliday } = await import("@/lib/sa-holidays");

    let conflict: string | null = null;
    if (isSAPublicHoliday(newDate)) {
      conflict = "Public holiday";
    } else if (override?.isBlocked) {
      conflict = `Day blocked${override.reason ? `: ${override.reason}` : ""}`;
    } else if (existing) {
      conflict = `Overlaps with ${existing.clientName} at ${existing.startTime}`;
    }

    results.push({
      date: format(newDate, "EEE d MMM"),
      conflict,
    });
  }

  return results;
}

// ────────────────────────────────────────────────────────────
// Admin: Create booking on behalf of a client
// ────────────────────────────────────────────────────────────

const IN_PERSON_ADDRESS = "Brown House Unit 2, 13 Station Street, Paarl";

interface AdminCreateBookingData {
  studentId: string;
  sessionType: SessionType;
  sessionMode: SessionMode;
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
  const settings = await getSiteSettings();

  // Validate slot availability (race condition guard)
  const slots = await getAvailableSlots(data.date, config, { skipMinNotice: true });
  const slotAvailable = slots.some((s) => s.start === data.startTime);
  if (!slotAvailable) {
    throw new Error("This time slot is no longer available. Please choose another.");
  }

  // Credit check (skip for postpaid — session will be invoiced monthly)
  if (data.useCredit && !config.isFree && !isPostpaid) {
    const balance = await getBalance(student.id);
    if (balance < 1) throw new Error("Client has insufficient session credits.");
  }

  // Determine price: free sessions = 0, credit-paid = 0 (already paid via credit purchase), postpaid/unpaid = session rate from settings
  let priceZarCents = 0;
  if (!config.isFree && !(data.useCredit && !isPostpaid)) {
    priceZarCents = data.sessionType === "couples"
      ? (settings.sessionPriceCouplesZar ?? 0)
      : (settings.sessionPriceIndividualZar ?? 0);
  }

  const clientName = `${student.firstName} ${student.lastName}`.trim();
  const bookingDate = new Date(`${data.date}T00:00:00Z`);
  const confirmationToken = randomUUID();

  // Create calendar event (in-person: block calendar but no Teams link)
  const calResult = await createCalendarEvent({
    subject: `${config.label} — ${clientName}${data.sessionMode === "in_person" ? " (In Person)" : ""}`,
    startDateTime: `${data.date}T${data.startTime}:00`,
    endDateTime: `${data.date}T${data.endTime}:00`,
    clientName,
    clientEmail: student.email,
    isOnlineMeeting: data.sessionMode !== "in_person",
  }).catch(() => null);

  // Create booking record
  const booking = await prisma.booking.create({
    data: {
      sessionType: data.sessionType,
      sessionMode: data.sessionMode,
      date: bookingDate,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: config.durationMinutes,
      priceZarCents,
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";
    const dateStr = format(bookingDate, "EEEE, d MMMM yyyy");
    const timeStr = `${data.startTime} – ${data.endTime} (SAST)`;

    const teamsSection = data.sessionMode === "in_person"
      ? `<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #333;">Session location:</p>
          <p style="margin: 0; color: #555;">${IN_PERSON_ADDRESS}</p>
        </div>`
      : calResult?.teamsMeetingUrl
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
    let adminTeamsLink = "";
    if (data.sessionMode === "in_person") {
      adminTeamsLink = `<p><strong>Location:</strong> ${IN_PERSON_ADDRESS}</p>`;
    } else if (calResult?.teamsMeetingUrl) {
      adminTeamsLink = `<p><strong>Teams link:</strong> <a href="${calResult.teamsMeetingUrl}">${calResult.teamsMeetingUrl}</a></p>`;
    }
    const notifyEmail = await renderEmail("booking_notification", {
      sessionType: config.label,
      clientName,
      date: dateStr,
      time: timeStr,
      duration: String(config.durationMinutes),
      clientDetails: `<p style="margin: 4px 0;"><strong>Client:</strong> ${clientName}</p><p style="margin: 4px 0;"><strong>Email:</strong> ${student.email}</p>` + (student.phone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${student.phone}</p>` : ""),
      teamsLink: adminTeamsLink,
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
  sessionMode: SessionMode;
  startDate: string;
  startTime: string;
  endTime: string;
  pattern: RecurringPattern;
  endDate: string;
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
  const settings = await getSiteSettings();
  const clientName = `${student.firstName} ${student.lastName}`.trim();
  const dates = generateRecurringDatesUntil(data.startDate, data.pattern, data.endDate);

  // Check credits (skip for postpaid — sessions will be invoiced monthly)
  let creditsRemaining = 0;
  if (data.useCredits && !config.isFree && !isPostpaid) {
    creditsRemaining = await getBalance(student.id);
  }

  // Session price from settings (single source of truth)
  const sessionRate = config.isFree
    ? 0
    : data.sessionType === "couples"
      ? (settings.sessionPriceCouplesZar ?? 0)
      : (settings.sessionPriceIndividualZar ?? 0);

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

    // Create calendar event (in-person: block calendar but no Teams link)
    const calResult = await createCalendarEvent({
      subject: `${config.label} — ${clientName}${data.sessionMode === "in_person" ? " (In Person)" : ""}`,
      startDateTime: `${dateStr}T${data.startTime}:00`,
      endDateTime: `${dateStr}T${data.endTime}:00`,
      clientName,
      clientEmail: student.email,
      isOnlineMeeting: data.sessionMode !== "in_person",
    }).catch(() => null);

    // Create booking record
    const booking = await prisma.booking.create({
      data: {
        sessionType: data.sessionType,
        sessionMode: data.sessionMode,
        date: bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: config.durationMinutes,
        priceZarCents: (data.useCredits && !isPostpaid && creditsRemaining > 0) ? 0 : sessionRate,
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

  if (search?.trim()) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.student.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, email: true, clientStatus: true, billingType: true },
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

// ────────────────────────────────────────────────────────────
// Toggle policy override for a booking
// ────────────────────────────────────────────────────────────

export async function togglePolicyOverrideAction(bookingId: string) {
  await requireRole("super_admin");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { policyOverride: true },
  });
  if (!booking) throw new Error("Booking not found");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { policyOverride: !booking.policyOverride },
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
}

// ────────────────────────────────────────────────────────────
// Cancel booking with optional late-cancellation fee
// ────────────────────────────────────────────────────────────

export async function cancelBookingAction(id: string, chargeLateFee: boolean) {
  await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");

  // Server-side late cancel check: is the session within 24 hours?
  const bookingDateTime = new Date(booking.date);
  const [h, m] = booking.startTime.split(":").map(Number);
  bookingDateTime.setHours(h, m, 0, 0);
  const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const isActuallyLate = hoursUntil < 24 && hoursUntil > -2;

  // Only allow late fee if genuinely within 24h window
  const isLateCancel = chargeLateFee && isActuallyLate;

  await prisma.booking.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "admin",
      isLateCancel,
      billingNote: isLateCancel ? "(late cancel — fee applies)" : "(cancelled — no charge)",
    },
  });

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
  await sendEmail({
    to: booking.clientEmail,
    ...email,
    templateKey: "booking_cancellation",
    metadata: { bookingId: id },
  }).catch(console.error);

  // Late cancel fee handling
  if (isLateCancel && booking.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: booking.studentId },
      select: { billingType: true },
    });

    // Check if a credit was used for this booking (priceZarCents = 0 means credit-paid)
    const creditUsed = await prisma.sessionCreditTransaction.findFirst({
      where: { bookingId: id, type: "used" },
    });

    if (creditUsed) {
      // Credit was used (prepaid OR postpaid with gifted credits) — forfeit the credit, no invoice needed
      const { forfeitCredit } = await import("@/lib/credits");
      await forfeitCredit(booking.studentId, id, "Late cancellation — credit forfeited");
      await prisma.booking.update({
        where: { id },
        data: { billingNote: "(late cancel — credit forfeited)" },
      });
    } else if (student?.billingType === "postpaid") {
      // Postpaid, no credit used — mark for monthly billing run pickup
      await prisma.booking.update({
        where: { id },
        data: { billingNote: "(late cancel — included in next monthly invoice)" },
      });
    }
    // Prepaid without credit: shouldn't happen (can't book without credit), but no action needed
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  redirect("/admin/bookings");
}
