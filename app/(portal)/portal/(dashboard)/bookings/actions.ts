"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  deleteRecurringEventOccurrences,
} from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { evaluateCancel, evaluateReschedule } from "@/lib/booking-policy";
import { refundCredit, forfeitCredit } from "@/lib/credits";
import { format } from "date-fns";
import { calendarDate, saDateStr } from "@/lib/dates";
import { getBaseUrlForCurrency } from "@/lib/region";

/**
 * Remove THIS session from the calendar, never the series it belongs to.
 *
 * `graphEventId` on a series booking is the recurring master id, shared by every
 * booking in the series — so deleting by that id removes all of them. Mirrors the
 * admin branch in app/(admin)/admin/(dashboard)/bookings/actions.ts.
 *
 * Never throws: a calendar failure must not abort a cancellation the client has
 * already been told is allowed. The 4-hourly reconcile picks up any stragglers.
 */
async function removeOccurrenceFromCalendar(booking: {
  graphEventId: string | null;
  recurringSeriesId: string | null;
  date: Date;
}): Promise<void> {
  if (!booking.graphEventId) return;
  try {
    if (booking.recurringSeriesId) {
      await deleteRecurringEventOccurrences(booking.graphEventId, [saDateStr(booking.date)]);
    } else {
      await cancelCalendarEvent(booking.graphEventId);
    }
  } catch (err) {
    console.error("Portal: failed to remove calendar occurrence", err);
  }
}

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

  // Cancel the calendar event — ONE occurrence when this booking belongs to a series.
  //
  // For a series booking, graphEventId is the recurring MASTER id shared by every
  // booking in the series. cancelCalendarEvent() on that id deletes the whole thing:
  // a client cancelling one session of a twenty-session series wiped the entire series
  // from Roxanne's calendar and their own. The admin paths have always branched here
  // (bookings/actions.ts:55); the portal never did, so the worst version of this was
  // the one reachable by clients.
  await removeOccurrenceFromCalendar(booking);

  const isLate = result.type === "late" || result.type === "anti_abuse";
  const billingNote = isLate ? "(late cancel)" : "(cancelled)";

  // Credits move ONLY if a credit actually paid for this booking.
  //
  // The old test was `!isFree && !isPostpaid`, which infers rather than checks — and
  // it MINTED credits: a client who booked without spending one (a postpaid session,
  // an invoiced session, a booking made before they had credits) could cancel with
  // 24 hours' notice and be handed +1, repeatably. Ask the ledger instead, exactly as
  // cancelSeriesAction and the admin late-cancel do: a `used` transaction against this
  // booking is the only proof a credit was spent.
  //
  // It is also strictly more correct than the flag it replaces — a POSTPAID client
  // holding gifted credits does spend one, and previously got neither refund nor
  // forfeit.
  const config = getSessionTypeConfig(booking.sessionType);
  const creditUsed = booking.studentId
    ? await prisma.sessionCreditTransaction.findFirst({
        where: { bookingId, type: "used" },
        select: { id: true },
      })
    : null;

  // Only a credit that was actually spent can actually come back. Recorded on the
  // booking as well, so the row no longer claims `creditRefunded: true` for a session
  // no credit ever paid for — reporting and the admin UI both read that flag.
  const creditRefunded = result.type === "normal" && !!creditUsed;

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

  if (creditUsed && booking.studentId) {
    if (result.type === "normal") {
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

  // Drop only the OLD occurrence — for a series booking this id is the recurring
  // master, so an unconditional delete moved one session and destroyed the other
  // nineteen. The replacement below is a standalone event, which is the same shape
  // the admin reschedule produces.
  await removeOccurrenceFromCalendar(booking);

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
