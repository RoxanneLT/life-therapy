"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cancelCalendarEvent, createCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig, TIMEZONE } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { evaluateCancel, evaluateReschedule } from "@/lib/booking-policy";
import { refundCredit, forfeitCredit } from "@/lib/credits";
import { format } from "date-fns";

export async function portalCancelBookingAction(
  bookingId: string,
  cancellationReason?: string
) {
  const { student } = await getAuthenticatedStudent();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (booking.studentId !== student.id) throw new Error("Unauthorized");

  const result = evaluateCancel(booking);
  if (!result.allowed) throw new Error(result.reason);

  // Cancel calendar event
  if (booking.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId).catch(console.error);
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
    bookUrl: "https://life-therapy.co.za/book",
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

  return { type: result.type, creditRefunded };
}

export async function portalRescheduleBookingAction(
  bookingId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
) {
  const { student } = await getAuthenticatedStudent();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (booking.studentId !== student.id) throw new Error("Unauthorized");

  const result = evaluateReschedule(booking);
  if (!result.allowed) throw new Error(result.reason);

  // Re-validate slot availability (race condition guard)
  const config = getSessionTypeConfig(booking.sessionType);
  const slots = await getAvailableSlots(newDate, config);
  const slotValid = slots.some(
    (s) => s.start === newStartTime && s.end === newEndTime
  );
  if (!slotValid) throw new Error("Selected time slot is no longer available.");

  // Cancel old calendar event
  if (booking.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId).catch(console.error);
  }

  // Create new calendar event
  const dateObj = new Date(newDate + "T00:00:00Z");
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
}
