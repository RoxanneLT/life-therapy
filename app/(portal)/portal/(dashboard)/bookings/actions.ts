"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cancelCalendarEvent, createCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { evaluateCancel, evaluateReschedule } from "@/lib/booking-policy";
import { refundCredit, forfeitCredit } from "@/lib/credits";
import { format } from "date-fns";
import { calendarDate } from "@/lib/dates";
import { getBaseUrlForCurrency } from "@/lib/region";

/**
 * Refusals are RETURNED, never thrown — these messages are read by CLIENTS.
 *
 * `evaluateCancel`/`evaluateReschedule` produce a policy sentence ("you're inside the
 * 24-hour window", "you've reached the reschedule limit") written for the person on
 * the screen. Thrown, that sentence is stripped in production and the portal rendered
 * React's digest text at them instead — so the one thing they needed to know, the
 * reason, was the one thing they could never see.
 */
export async function portalCancelBookingAction(
  bookingId: string,
  cancellationReason?: string
): Promise<
  | { success: true; type: string; creditRefunded: boolean }
  | { success: false; error: string }
> {
  const { student } = await getAuthenticatedStudent();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { success: false, error: "We couldn't find that session." };
  if (booking.studentId !== student.id) {
    return { success: false, error: "That session doesn't belong to your account." };
  }

  const result = evaluateCancel(booking);
  if (!result.allowed) return { success: false, error: result.reason };

  // Cancel calendar event
  if (booking.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId);
  }

  const isLate = result.type === "late" || result.type === "anti_abuse";
  const creditRefunded = result.type === "normal";
  const billingNote = isLate ? "(late cancel)" : "(cancelled)";

  // Update booking
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "client",
      cancellationReason: cancellationReason?.trim() || null,
      isLateCancel: isLate,
      creditRefunded,
      billingNote,
    },
  });

  // Handle credits (skip for free consultations and postpaid clients)
  const config = getSessionTypeConfig(booking.sessionType);
  const isPostpaid = student.billingType === "postpaid";
  if (!config.isFree && booking.studentId && !isPostpaid) {
    if (creditRefunded) {
      await refundCredit(
        booking.studentId,
        bookingId,
        `Refund: cancelled ${config.label} on ${format(new Date(booking.date), "d MMM yyyy")}`
      );
    } else {
      await forfeitCredit(
        booking.studentId,
        bookingId,
        `Forfeit (${result.type === "anti_abuse" ? "anti-abuse" : "late cancel"}): ${config.label} on ${format(new Date(booking.date), "d MMM yyyy")}`
      );
    }
  }

  // Send cancellation email
  const email = await renderEmail("booking_cancellation", {
    clientName: booking.clientName,
    sessionType: config.label,
    date: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
    time: `${booking.startTime} – ${booking.endTime} (SAST)`,
    bookUrl: `${getBaseUrlForCurrency(booking.priceCurrency)}/book`,
  }).catch(() => null);

  if (email) {
    await sendEmail({
      to: booking.clientEmail,
      ...email,
      templateKey: "booking_cancellation",
      metadata: { bookingId },
    }).catch(console.error);
  }

  revalidatePath("/portal/bookings");

  return { success: true, type: result.type, creditRefunded };
}

export async function portalRescheduleBookingAction(
  bookingId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { student } = await getAuthenticatedStudent();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { success: false, error: "We couldn't find that session." };
  if (booking.studentId !== student.id) {
    return { success: false, error: "That session doesn't belong to your account." };
  }

  const result = evaluateReschedule(booking);
  if (!result.allowed) return { success: false, error: result.reason };

  // Re-validate slot availability (race condition guard)
  const config = getSessionTypeConfig(booking.sessionType);
  const { slots } = await getAvailableSlots(newDate, config);
  const slotValid = slots.some(
    (s) => s.start === newStartTime && s.end === newEndTime
  );
  if (!slotValid) {
    return { success: false, error: "That time slot has just been taken. Please choose another." };
  }

  // Cancel old calendar event
  if (booking.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId);
  }

  // Create new calendar event
  const dateObj = calendarDate(newDate);
  const calResult = await createCalendarEvent({
    subject: `${config.label} — ${booking.clientName}`,
    startDateTime: `${newDate}T${newStartTime}:00`,
    endDateTime: `${newDate}T${newEndTime}:00`,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
  }).catch(() => null);

  // Update booking
  await prisma.booking.update({
    where: { id: bookingId },
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

  // Send reschedule email
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
      metadata: { bookingId },
    }).catch(console.error);
  }

  revalidatePath("/portal/bookings");
  return { success: true };
}

export async function updateClientNotesAction(
  bookingId: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  const { student } = await getAuthenticatedStudent();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, studentId: true, status: true },
  });
  if (!booking) return { success: false, error: "We couldn't find that session." };
  if (booking.studentId !== student.id) {
    return { success: false, error: "That session doesn't belong to your account." };
  }
  if (booking.status === "cancelled") {
    return { success: false, error: "This session was cancelled, so its notes can no longer be changed." };
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { clientNotes: notes.trim() || null },
  });

  revalidatePath("/portal/bookings");
  return { success: true };
}
