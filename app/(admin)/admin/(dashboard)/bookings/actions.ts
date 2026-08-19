"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelCalendarEvent, createCalendarEvent, createRecurringCalendarEvent, deleteRecurringEventOccurrences } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getAvailableSlots } from "@/lib/availability";
import { getBalance, deductCredit } from "@/lib/credits";
import { getSiteSettings } from "@/lib/settings";
import { format } from "date-fns";
import { randomUUID } from "node:crypto";
import { expandRecurringDatesUntil, type RecurringPattern } from "@/lib/recurring-dates";
import type { BookingStatus, SessionMode, SessionType } from "@/lib/generated/prisma/client";
import { saDateStr, saInstant, calendarDate, saToday } from "@/lib/dates";
import { weeklyOccurrenceDates } from "@/lib/graph-recurrence";
import { getBaseUrlForCurrency, appBaseUrl } from "@/lib/region";
import { escapeHtml } from "@/lib/utils";
import { emailRefusal, isDeliverableEmail } from "@/lib/email-address";
import { removeBookingFromCalendar } from "@/lib/calendar-removal";
import { parseLineItems, readLineItems } from "@/lib/billing-types";

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const { adminUser } = await requireRole("super_admin", "editor");

  const billingNotes: Partial<Record<BookingStatus, string>> = {
    cancelled: "(cancelled)",
    no_show: "(no-show)",
  };
  const billingNote = billingNotes[status];

  const prev = await prisma.booking.findUnique({
    where: { id },
    select: { status: true },
  });

  const booking = await prisma.booking.update({
    where: { id },
    data: { status, ...(billingNote ? { billingNote } : {}) },
  });

  await recordAudit({
    action: `booking_status_${status}`,
    entityType: "booking",
    entityId: id,
    actorEmail: adminUser.email,
    before: { status: prev?.status ?? null },
    after: { status },
  });

  let calendarWarning: string | undefined;

  if (status === "cancelled") {
    // Decided by how many bookings SHARE the event id — see lib/calendar-removal.ts.
    // Branching on `recurringSeriesId` asked about the BOOKING and assumed the
    // answer described the EVENT. For a series whose bookings each hold their own
    // standalone event, that assumption removed nothing at all: the session read
    // "cancelled" here and stayed live in the client's calendar and in Teams.
    const removal = await removeBookingFromCalendar(booking);
    if (removal.warning) calendarWarning = removal.warning;
    const config = getSessionTypeConfig(booking.sessionType);
    const email = await renderEmail("booking_cancellation", {
      clientName: booking.clientName,
      sessionType: config.label,
      date: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
      time: `${booking.startTime} – ${booking.endTime} (SAST)`,
      bookUrl: `${getBaseUrlForCurrency(booking.priceCurrency)}/book`,
    });
    await sendEmail({ to: booking.clientEmail, ...email, templateKey: "booking_cancellation", metadata: { bookingId: id } }).catch(console.error);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  if (calendarWarning) {
    redirect(`/admin/bookings/${id}?calendarWarning=${encodeURIComponent(calendarWarning)}`);
  }
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

export async function updateSessionNotes(id: string, formData: FormData) {
  await requireRole("super_admin", "editor");
  const sessionNotes = formData.get("sessionNotes") as string;
  await prisma.booking.update({
    where: { id },
    data: { sessionNotes },
  });
  revalidatePath(`/admin/bookings/${id}`);
}

export async function deleteBooking(id: string) {
  const { adminUser } = await requireRole("super_admin");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");

  // Calendar cleanup. Runs BEFORE the row is deleted, which the count below relies
  // on: this booking must still hold its own event id for the shared-count to read
  // true. See lib/calendar-removal.ts.
  await removeBookingFromCalendar(booking);

  // Check if this is the last booking in its series — clean up orphaned Graph event
  if (booking.recurringSeriesId) {
    const siblingCount = await prisma.booking.count({
      where: { recurringSeriesId: booking.recurringSeriesId, id: { not: id } },
    });
    if (siblingCount === 0 && booking.graphEventId) {
      // Last booking in the series — delete the master recurring event
      await cancelCalendarEvent(booking.graphEventId).catch(console.error);
    }
  }

  // Audit log before deletion (can't log after — data is gone)
  await recordAudit({
    action: "booking_deleted",
    entityType: "booking",
    entityId: id,
    actorEmail: adminUser.email,
    before: {
      clientName: booking.clientName,
      date: saDateStr(booking.date),
      startTime: booking.startTime,
      status: booking.status,
      sessionType: booking.sessionType,
      recurringSeriesId: booking.recurringSeriesId,
    },
    after: null,
  });

  await prisma.booking.delete({ where: { id } });
  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}

/**
 * Refusals are RETURNED, not thrown — a thrown message is stripped in production
 * and reaches the admin as "An error occurred in the Server Components render…".
 */
export async function rescheduleBooking(
  id: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return { success: false, error: "That booking no longer exists." };

  const config = getSessionTypeConfig(booking.sessionType);
  const dateObj = calendarDate(newDate);

  // Check the slot SERVER-SIDE before touching anything.
  //
  // The only check was the slot list the picker fetched when it rendered, which
  // is a snapshot: the admin can sit on the dialog while a client books that
  // slot, or a holiday/override lands, and the reschedule proceeded regardless.
  // The series path has always validated on the server; this one never did.
  //
  // `getAvailableSlots` folds all three questions — public holiday, availability
  // override, existing booking — into one answer, which is why this reuses it
  // rather than adding a third copy of the series path's inline conflict query.
  // `skipMinNotice` because an admin rescheduling on the client's behalf is
  // exactly the case the 24-hour notice rule is not meant to block.
  const { slots } = await getAvailableSlots(newDate, config, { skipMinNotice: true });
  const slotFree = slots.some((s) => s.start === newStartTime);
  const movingToSameSlot =
    saDateStr(booking.date) === newDate && booking.startTime === newStartTime;

  if (!slotFree && !movingToSameSlot) {
    return {
      success: false,
      error: `${newStartTime} on ${newDate} is not available — it may have been booked, blocked, or fall on a public holiday. Pick another time.`,
    };
  }

  // Step 1: Create new calendar event FIRST — a temporary duplicate is better than losing both
  const calResult = await createCalendarEvent({
    subject: `${config.label} — ${booking.clientName}`,
    startDateTime: `${newDate}T${newStartTime}:00`,
    endDateTime: `${newDate}T${newEndTime}:00`,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
  });

  let calendarWarning: string | undefined;

  // Step 2: Only then remove the old calendar event — see lib/calendar-removal.ts.
  const oldRemoval = await removeBookingFromCalendar(booking);
  if (oldRemoval.warning) {
    calendarWarning = "Old Outlook event could not be removed — please delete it manually.";
  }

  if (!calResult) {
    calendarWarning = calendarWarning
      ? "Both old and new Outlook events failed — please update calendar manually."
      : "New Outlook event could not be created — please add it manually.";
  }

  // Update booking record. The check above is advisory — a Graph round trip sits
  // between it and this write — so `bookings_active_slot_unique` is what actually
  // settles a race, and P2002 means we lost it. Unhandled, that surfaced as a
  // masked server-action error with no clue that the slot was simply taken.
  try {
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
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      // Undo the event we just created, or the diary keeps a session that has
      // no booking behind it.
      if (calResult?.eventId) {
        await cancelCalendarEvent(calResult.eventId).catch(console.error);
      }
      return {
        success: false,
        error: `${newStartTime} on ${newDate} was taken while you were rescheduling. Nothing was changed — pick another time.`,
      };
    }
    throw err;
  }

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
  // A calendar warning still redirects — the reschedule DID happen and the page
  // shows the warning. Only a refusal returns, so the dialog can say why.
  if (calendarWarning) {
    redirect(`/admin/bookings/${id}?calendarWarning=${encodeURIComponent(calendarWarning)}`);
  }
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Reschedule entire recurring series (future bookings only)
// ────────────────────────────────────────────────────────────

export async function rescheduleSeriesAction(
  seriesId: string,
  newDayOfWeek: number, // 1=Mon..5=Fri
  newStartTime: string, // HH:mm
): Promise<{ updated: number; skipped: { id: string; date: string; reason: string }[]; calendarWarning?: string }> {
  await requireRole("super_admin", "editor");

  // `setHours` is LOCAL midnight — UTC only because Vercel happens to run in UTC.
  // On a dev box it is 22:00 UTC the previous day, which drags YESTERDAY's
  // occurrence into a query for the series' future ones. The column is a day.
  const today = calendarDate(saToday());

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
  const updatedBookings: { booking: typeof bookings[0]; newDateStr: string; newDate: Date }[] = [];

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
        where: { date: calendarDate(newDateStr) },
      });
      if (override?.isBlocked) {
        skipReason = `Day blocked${override.reason ? `: ${override.reason}` : ""}`;
      } else {
        const existing = await prisma.booking.findFirst({
          where: {
            date: calendarDate(newDateStr),
            startTime: { lte: newEndTime },
            endTime: { gte: newStartTime },
            status: { in: ["confirmed", "pending"] },
            id: { not: booking.id },
            // "belongs to a DIFFERENT series, or to no series at all".
            //
            // Written explicitly rather than as `recurringSeriesId: { not: seriesId }`,
            // because that leans on how a nullable !== is translated — and in SQL
            // `col <> 'x'` is NULL, not true, for rows where col IS NULL. Read that
            // way it hides every STANDALONE booking from the conflict check, which is
            // most of the diary: the preview would report a clean slot and the
            // reschedule would drop a whole series on top of another client. Too
            // expensive to leave resting on a translation detail.
            OR: [{ recurringSeriesId: null }, { recurringSeriesId: { not: seriesId } }],
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

    // No conflict — mark for update
    updatedBookings.push({ booking, newDateStr, newDate });
    updated++;
  }

  // ── Delete old recurring calendar event once ─────────────────────────
  let seriesCalendarWarning: string | undefined;
  const oldSeriesEventId = bookings[0].graphEventId;
  if (oldSeriesEventId) {
    try {
      await cancelCalendarEvent(oldSeriesEventId);
    } catch {
      seriesCalendarWarning = "Old recurring calendar event could not be removed — delete manually in Outlook.";
    }
  }

  // ── Create ONE new recurring event on the new day ──────────────────
  let newSeriesEventId: string | null = null;
  let newTeamsMeetingUrl: string | null = null;

  if (updatedBookings.length > 0) {
    const firstUpdated = updatedBookings[0];
    const lastUpdated = updatedBookings[updatedBookings.length - 1];
    const config = getSessionTypeConfig(bookings[0].sessionType);

    // Determine the recurring pattern from the first booking
    const pattern = (bookings[0].recurringPattern as "weekly" | "bimonthly" | "monthly") || "weekly";

    const calResult = await createRecurringCalendarEvent({
      subject: `${config.label} — ${bookings[0].clientName}`,
      startDateTime: `${firstUpdated.newDateStr}T${newStartTime}:00`,
      endDateTime: `${firstUpdated.newDateStr}T${newEndTime}:00`,
      clientName: bookings[0].clientName,
      clientEmail: bookings[0].clientEmail,
      recurrencePattern: pattern,
      seriesEndDate: lastUpdated.newDateStr,
      isOnlineMeeting: bookings[0].sessionMode !== "in_person",
    }).catch(() => null);

    newSeriesEventId = calResult?.seriesEventId || null;
    newTeamsMeetingUrl = calResult?.teamsMeetingUrl || null;

    // Delete occurrences for skipped dates from the new series
    if (newSeriesEventId && skipped.length > 0) {
      // Skipped dates are in display format — we need to recompute the ISO date strings
      const skippedISODates: string[] = [];
      for (const booking of bookings) {
        const oldDate = new Date(booking.date);
        const diff = newDayOfWeek - oldDate.getUTCDay();
        const nd = new Date(oldDate);
        nd.setUTCDate(nd.getUTCDate() + diff);
        const ndStr = nd.toISOString().slice(0, 10);
        if (skipped.some(s => s.id === booking.id)) {
          skippedISODates.push(ndStr);
        }
      }
      if (skippedISODates.length > 0) {
        await deleteRecurringEventOccurrences(newSeriesEventId, skippedISODates);
      }
    }
  }

  // ── Update booking records with new dates and series event ID ─────
  for (const { booking, newDateStr } of updatedBookings) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        date: calendarDate(newDateStr),
        startTime: newStartTime,
        endTime: newEndTime,
        graphEventId: newSeriesEventId,
        teamsMeetingUrl: newTeamsMeetingUrl || booking.teamsMeetingUrl,
      },
    });
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
      bookUrl: `${getBaseUrlForCurrency(bookings[0].priceCurrency)}/book`,
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

  if (updatedBookings.length > 0 && !newSeriesEventId) {
    seriesCalendarWarning = seriesCalendarWarning
      ? seriesCalendarWarning + " New recurring event also failed."
      : "Recurring calendar event could not be created — please add it manually in Outlook.";
  }

  revalidatePath("/admin/bookings");
  return { updated, skipped, calendarWarning: seriesCalendarWarning };
}

// ────────────────────────────────────────────────────────────
// Rebuild a series' calendar event (repair — does NOT move any booking)
// ────────────────────────────────────────────────────────────

/**
 * Repair primitive for a series whose Outlook event is wrong or missing, while the
 * bookings themselves are correct.
 *
 * Born from the 2026-07 incident: the day-of-week bug put recurring events one weekday
 * late, and the reconcile then deleted them as ghosts without recreating them. The
 * bookings were right the whole time — only the calendar needed rebuilding. That could
 * not be done through "Reschedule series", whose dialog requires the day or time to
 * actually CHANGE, and routing around it (move away, move back) risks fragmenting the
 * series because conflicting/holiday dates get skipped on the intermediate hop.
 *
 * So: delete whatever series event exists, create a correct one from the bookings AS
 * THEY STAND, and point every future booking at it. No booking date, time or status is
 * touched.
 *
 * Pruning matters. A recurrence spans a contiguous range, but the bookings inside it
 * rarely are — a public holiday or a cancelled session leaves a hole, and every
 * generated occurrence without a booking behind it is an instant ghost. (Chanene's real
 * series: 43 bookings across 50 weekly slots.) Occurrences with no booking are removed
 * straight after creation.
 */
export async function rebuildSeriesCalendarAction(seriesId: string): Promise<{
  rebuilt: number;
  pruned: number;
  warning?: string;
}> {
  const { adminUser } = await requireRole("super_admin");

  const bookings = await prisma.booking.findMany({
    where: {
      recurringSeriesId: seriesId,
      status: { in: ["confirmed", "pending"] },
      date: { gte: calendarDate(saToday()) },
    },
    orderBy: { date: "asc" },
  });

  if (bookings.length === 0) {
    return { rebuilt: 0, pruned: 0, warning: "No future bookings in this series." };
  }

  const first = bookings[0];
  const pattern = (first.recurringPattern as "weekly" | "bimonthly" | "monthly") || "weekly";
  const firstDate = saDateStr(first.date);
  const lastDate = saDateStr(bookings[bookings.length - 1].date);

  // 1. Remove the existing series event. An ALREADY-DELETED event is the normal case
  //    here (the incident deleted several), so a failure is not worth alarming about.
  const oldEventId = first.graphEventId;
  if (oldEventId) {
    await cancelCalendarEvent(oldEventId).catch(() => {
      /* already gone — that is precisely the state we are repairing */
    });
  }

  // 2. Build a correct one from the bookings as they stand.
  const config = getSessionTypeConfig(first.sessionType);
  const inPerson = first.sessionMode === "in_person";
  const calResult = await createRecurringCalendarEvent({
    subject: `${config.label} — ${first.clientName}${inPerson ? " (In Person)" : ""}`,
    startDateTime: `${firstDate}T${first.startTime}:00`,
    endDateTime: `${firstDate}T${first.endTime}:00`,
    clientName: first.clientName,
    clientEmail: first.clientEmail,
    recurrencePattern: pattern,
    seriesEndDate: lastDate,
    isOnlineMeeting: !inPerson,
  }).catch(() => null);

  if (!calResult?.seriesEventId) {
    await recordAudit({
      action: "calendar_series_rebuilt",
      entityType: "booking",
      entityId: seriesId,
      actorEmail: adminUser.email,
      after: { outcome: "failed", clientName: first.clientName },
    });
    return {
      rebuilt: 0,
      pruned: 0,
      warning: "Could not create the recurring calendar event — nothing was changed on the bookings.",
    };
  }

  // 3. Prune generated occurrences that have no booking behind them.
  let pruned = 0;
  let warning: string | undefined;
  if (pattern === "weekly" || pattern === "bimonthly") {
    const bookedDates = new Set(bookings.map((b) => saDateStr(b.date)));
    const surplus = weeklyOccurrenceDates(
      firstDate,
      lastDate,
      pattern === "bimonthly" ? 2 : 1,
    ).filter((d) => !bookedDates.has(d));
    if (surplus.length > 0) {
      const res = await deleteRecurringEventOccurrences(calResult.seriesEventId, surplus);
      pruned = res.deleted.length;
      if (res.failed.length > 0) {
        warning = `${res.failed.length} surplus occurrence(s) could not be removed — check Outlook for sessions on: ${res.failed.join(", ")}.`;
      }
    }
  } else {
    // Monthly recurrences are not expanded here; a gap would leave a stray occurrence
    // that the next check-only reconcile will surface as stale.
    warning = "Monthly series: surplus occurrences are not pruned — run a Check afterwards.";
  }

  // 4. Point every future booking at the new event.
  await prisma.booking.updateMany({
    where: { id: { in: bookings.map((b) => b.id) } },
    data: {
      graphEventId: calResult.seriesEventId,
      ...(calResult.teamsMeetingUrl ? { teamsMeetingUrl: calResult.teamsMeetingUrl } : {}),
    },
  });

  await recordAudit({
    action: "calendar_series_rebuilt",
    entityType: "booking",
    entityId: seriesId,
    actorEmail: adminUser.email,
    before: { graphEventId: oldEventId ?? null },
    after: {
      graphEventId: calResult.seriesEventId,
      clientName: first.clientName,
      bookings: bookings.length,
      pruned,
    },
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/settings");
  return { rebuilt: bookings.length, pruned, warning };
}

// ────────────────────────────────────────────────────────────
// Cancel entire recurring series (future bookings only)
// ────────────────────────────────────────────────────────────

export async function cancelSeriesAction(seriesId: string): Promise<{ cancelled: number; creditsRestored?: number; calendarWarning?: string }> {
  const { adminUser } = await requireRole("super_admin", "editor");

  // `setHours` is LOCAL midnight — UTC only because Vercel happens to run in UTC.
  // On a dev box it is 22:00 UTC the previous day, which drags YESTERDAY's
  // occurrence into a query for the series' future ones. The column is a day.
  const today = calendarDate(saToday());

  // Find all future confirmed/pending bookings in this series
  const bookings = await prisma.booking.findMany({
    where: {
      recurringSeriesId: seriesId,
      status: { in: ["confirmed", "pending"] },
      date: { gte: today },
    },
    orderBy: { date: "asc" },
  });

  if (bookings.length === 0) return { cancelled: 0 };

  // Bookings in a series can have DIFFERENT graphEventIds: most share the
  // recurring series master, but any that were individually rescheduled point
  // at a standalone single event. Group the future occurrences by their own
  // graphEventId so each is deleted correctly (series master → expand occurrence,
  // single event → direct delete, handled inside deleteRecurringEventOccurrences).
  // Bookings with a null graphEventId fall back to the series master found on
  // any sibling booking (covers series created before calendar sync was active).
  const seriesFallback = await prisma.booking.findFirst({
    where: { recurringSeriesId: seriesId, graphEventId: { not: null } },
    select: { graphEventId: true },
  });
  const fallbackId = seriesFallback?.graphEventId ?? null;

  const datesByEvent = new Map<string, string[]>();
  for (const b of bookings) {
    const gid = b.graphEventId ?? fallbackId;
    if (!gid) continue;
    const dates = datesByEvent.get(gid) ?? [];
    dates.push(saDateStr(b.date));
    datesByEvent.set(gid, dates);
  }

  let calendarWarning: string | undefined;
  if (datesByEvent.size === 0) {
    calendarWarning = "No calendar event found for this series — nothing to remove from Outlook.";
  } else {
    let failedCount = 0;
    for (const [gid, dates] of datesByEvent) {
      const delResult = await deleteRecurringEventOccurrences(gid, dates);
      failedCount += delResult.failed.length;
    }
    if (failedCount > 0) {
      calendarWarning = `${failedCount} Outlook occurrence(s) could not be removed — please delete them manually.`;
    }
  }

  // Cancel each booking record + restore credits where applicable
  let creditsRestored = 0;
  for (const booking of bookings) {
    // Check if a credit was used for this booking
    const creditTx = await prisma.sessionCreditTransaction.findFirst({
      where: { bookingId: booking.id, type: "used" },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: "admin",
        billingNote: creditTx
          ? "(series cancelled — credit restored)"
          : "(series cancelled — no charge)",
      },
    });

    // Restore the credit if one was used
    if (creditTx && booking.studentId) {
      try {
        const { refundCredit } = await import("@/lib/credits");
        await refundCredit(booking.studentId, booking.id, "Series cancelled — credit restored");
        creditsRestored++;
      } catch (err) {
        console.error(`Failed to restore credit for booking ${booking.id}:`, err);
      }
    }
  }

  // Audit log
  await recordAudit({
    action: "series_cancelled",
    entityType: "booking",
    entityId: seriesId,
    actorEmail: adminUser.email,
    before: { count: bookings.length, status: "confirmed" },
    after: { count: bookings.length, status: "cancelled", creditsRestored },
  });

  // Send ONE cancellation email to the client
  const first = bookings[0];
  const config = getSessionTypeConfig(first.sessionType);

  try {
    const email = await renderEmail("booking_cancellation", {
      clientName: first.clientName,
      sessionType: config.label,
      date: `Recurring series (${bookings.length} session${bookings.length !== 1 ? "s" : ""})`,
      time: `${first.startTime} – ${first.endTime} (SAST)`,
      bookUrl: `${getBaseUrlForCurrency(first.priceCurrency)}/book`,
    });
    await sendEmail({
      to: first.clientEmail,
      ...email,
      templateKey: "booking_cancellation",
      metadata: { seriesId },
    });
  } catch (err) {
    console.error("Failed to send series cancellation email:", err);
  }

  revalidatePath("/admin/bookings");
  return { cancelled: bookings.length, creditsRestored: creditsRestored > 0 ? creditsRestored : undefined, calendarWarning };
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

  // `setHours` is LOCAL midnight — UTC only because Vercel happens to run in UTC.
  // On a dev box it is 22:00 UTC the previous day, which drags YESTERDAY's
  // occurrence into a query for the series' future ones. The column is a day.
  const today = calendarDate(saToday());

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

  const { isSAPublicHoliday } = await import("@/lib/sa-holidays");
  const results: { date: string; conflict: string | null }[] = [];

  for (const booking of bookings) {
    const oldDate = new Date(booking.date);
    const oldDow = oldDate.getUTCDay();
    const diff = newDayOfWeek - oldDow;
    const newDate = new Date(oldDate);
    newDate.setUTCDate(newDate.getUTCDate() + diff);
    const newDateStr = newDate.toISOString().slice(0, 10);

    // Check for existing bookings on that date/time (excluding this series).
    // Same explicit OR as the preview above — a standalone booking has a NULL
    // recurringSeriesId and must still count as a conflict.
    const existing = await prisma.booking.findFirst({
      where: {
        date: calendarDate(newDateStr),
        startTime: { lte: newEndTime },
        endTime: { gte: newStartTime },
        status: { in: ["confirmed", "pending"] },
        id: { not: booking.id },
        OR: [{ recurringSeriesId: null }, { recurringSeriesId: { not: seriesId } }],
      },
      select: { clientName: true, startTime: true },
    });

    // Check availability overrides (blocked days)
    const override = await prisma.availabilityOverride.findUnique({
      where: { date: calendarDate(newDateStr) },
    });

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
  couplesPartnerEmail?: string;
}

/** Refusals are RETURNED, not thrown — production strips a thrown message to React's
 *  digest text, so "that slot has gone" reached Roxanne as unreadable boilerplate.
 *  Converted here rather than deepening the debt while adding the P2002 branch. */
export async function adminCreateBookingAction(
  data: AdminCreateBookingData,
): Promise<
  | { success: true; bookingId: string; calendarWarning?: string; partnerWarning?: string }
  | { success: false; error: string }
> {
  await requireRole("super_admin", "editor");

  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, billingType: true },
  });
  if (!student) return { success: false, error: "Client not found." };

  // Refuse an address the provider will reject, BEFORE the booking exists. `type="email"`
  // does not require a dot in the domain, so `foo@gmailcom` reaches here looking valid.
  // Refused, not thrown — a thrown message is stripped in production.
  const partnerRefusal = emailRefusal(data.couplesPartnerEmail, "Partner email");
  if (partnerRefusal) return { success: false, error: partnerRefusal };

  let partnerWarning: string | undefined;

  const config = getSessionTypeConfig(data.sessionType);
  const isPostpaid = student.billingType === "postpaid";
  const settings = await getSiteSettings();

  // Validate slot availability (race condition guard)
  const { slots } = await getAvailableSlots(data.date, config, { skipMinNotice: true });
  const slotAvailable = slots.some((s) => s.start === data.startTime);
  if (!slotAvailable) {
    return { success: false, error: "This time slot is no longer available. Please choose another." };
  }

  // Credit check (skip for postpaid — session will be invoiced monthly)
  if (data.useCredit && !config.isFree && !isPostpaid) {
    const balance = await getBalance(student.id);
    if (balance < 1) return { success: false, error: "Client has insufficient session credits." };
  }

  // Determine price: free sessions = 0, credit-paid = 0 (already paid via credit purchase), postpaid/unpaid = session rate from settings
  let priceZarCents = 0;
  if (!config.isFree && !(data.useCredit && !isPostpaid)) {
    priceZarCents = data.sessionType === "couples"
      ? (settings.sessionPriceCouplesZar ?? 0)
      : (settings.sessionPriceIndividualZar ?? 0);
  }

  const clientName = `${student.firstName} ${student.lastName}`.trim();
  const bookingDate = calendarDate(data.date);
  const confirmationToken = randomUUID();

  /**
   * Where the partner invite is actually sent.
   *
   * A couples booking stores its own `couplesPartnerEmail`, captured on the form — it
   * does NOT read the partner's client record. That is two sources of truth for one
   * person's address, and the one an admin can see and edit on the client page is not
   * the one that sends. Correcting a partner's profile and re-testing therefore proves
   * nothing, which is exactly how this was chased for a week.
   *
   * So: fall back to the LINKED PARTNER'S own email when the booking has none. Of the
   * two couples sessions on record, one carried a malformed address and the other
   * carried NULL — and a NULL sends nothing at all, silently, which is the worse half.
   */
  let partnerTo = data.couplesPartnerEmail?.trim() || null;
  if (data.sessionType === "couples" && !partnerTo) {
    const link = await prisma.clientRelationship.findFirst({
      where: { studentId: student.id, relationshipType: "partner" },
      select: { relatedStudent: { select: { email: true } } },
    });
    const linked = link?.relatedStudent?.email ?? null;
    // Only if it can actually receive mail — a fallback that inherits a bad address is
    // worse than none, because it reads as deliberate.
    if (isDeliverableEmail(linked)) partnerTo = linked;
  }

  // Create calendar event (in-person: block calendar but no Teams link)
  const calResult = await createCalendarEvent({
    subject: `${config.label} — ${clientName}${data.sessionMode === "in_person" ? " (In Person)" : ""}`,
    startDateTime: `${data.date}T${data.startTime}:00`,
    endDateTime: `${data.date}T${data.endTime}:00`,
    clientName,
    clientEmail: student.email,
    isOnlineMeeting: data.sessionMode !== "in_person",
  }).catch(() => null);

  // Create booking record. `bookings_active_slot_unique` is the real arbiter of the
  // slot — the availability check happened before the Graph call above.
  let booking;
  try {
    booking = await prisma.booking.create({
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
      // The RESOLVED address, so the row records who was actually written to rather
      // than what the form happened to hold. A booking whose stored address differs
      // from the one used is unauditable after the fact.
      couplesPartnerEmail: partnerTo,
      graphEventId: calResult?.eventId || null,
      teamsMeetingUrl: calResult?.teamsMeetingUrl || null,
      confirmationToken,
      originalDate: bookingDate,
      originalStartTime: data.startTime,
      studentId: student.id,
    },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      if (calResult?.eventId) {
        await cancelCalendarEvent(calResult.eventId).catch(console.error);
      }
      return {
        success: false,
        error: `That slot is already taken — ${data.date} at ${data.startTime} has an active booking. Pick another time.`,
      };
    }
    throw err;
  }

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
    const baseUrl = appBaseUrl();
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
      // A registered HTML block escapes its own interpolations — the escaping at
      // renderEmail deliberately cannot reach inside one. The same block built on
      // the public booking path has escaped since it was written; this copy did
      // not, and it is the email that lands in Roxanne's inbox.
      clientDetails:
        `<p style="margin: 4px 0;"><strong>Client:</strong> ${escapeHtml(clientName)}</p>` +
        `<p style="margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(student.email)}</p>` +
        (student.phone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${escapeHtml(student.phone)}</p>` : ""),
      teamsLink: adminTeamsLink,
    }, baseUrl);

    await sendEmail({
      to: settings.email || "hello@life-therapy.co.za",
      ...notifyEmail,
      templateKey: "booking_notification",
      metadata: { bookingId: booking.id },
    });

    // The partner's own invite, when an email was given.
    //
    // The portal path has sent this since the columns existed; booking the same
    // couples session from the admin side sent the partner nothing, because this
    // form only ever collected a name. Half a feature is worse than none here —
    // whether the second person hears about their session depended on which
    // screen it was booked from.
    if (data.sessionType === "couples" && partnerTo) {
      const partnerEmail = await renderEmail(
        "couples_partner_invite",
        {
          partnerName: data.couplesPartnerName || "there",
          clientName,
          sessionType: config.label,
          date: dateStr,
          time: timeStr,
          teamsSection,
        },
        baseUrl,
      );
      // The RESULT IS READ. sendEmail returns { success, error } and never throws, so
      // discarding it drops the only signal there is. A partner invite refused by the
      // provider — `seanteres9@gmailcom`, no dot — sat in email_logs for a week reading
      // to everyone as "he never gets our emails", because nothing surfaced it.
      const sent = await sendEmail({
        to: partnerTo,
        ...partnerEmail,
        templateKey: "couples_partner_invite",
        studentId: student.id,
        metadata: { bookingId: booking.id, partnerInvite: true },
      });
      if (!sent.success) {
        partnerWarning =
          `The session is booked, but the invite to ${data.couplesPartnerName || "the partner"} ` +
          `(${partnerTo}) was not delivered: ${sent.error ?? "unknown error"}. They have not been told about it.`;
      }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmationSentAt: new Date() },
    });
  } catch {
    // Email failure shouldn't block booking creation
  }

  revalidatePath("/admin/bookings");
  return {
    success: true,
    bookingId: booking.id,
    calendarWarning: !calResult ? "Calendar event could not be created — please add it manually in Outlook." : undefined,
    partnerWarning,
  };
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
  couplesPartnerEmail?: string;
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
  // Holidays come back named rather than silently missing, so they reach the
  // admin's "skipped" list and the client's summary email like any other gap.
  const { dates, holidays } = expandRecurringDatesUntil(
    data.startDate,
    data.pattern,
    data.endDate,
  );

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
  const skippedDates: { date: string; reason: string }[] = holidays.map((date) => ({
    date,
    reason: "Public holiday",
  }));
  let creditsUsed = 0;

  // ── Step 1: Check which dates are available ──────────────────────
  const availableDates: string[] = [];
  for (const dateStr of dates) {
    const { slots } = await getAvailableSlots(dateStr, config);
    const slotAvailable = slots.some((s) => s.start === data.startTime);
    if (!slotAvailable) {
      skippedDates.push({ date: dateStr, reason: "Slot unavailable" });
    } else {
      availableDates.push(dateStr);
    }
  }

  // ── Step 2: Create ONE recurring calendar event ─────────────────
  // Client receives a single meeting invite covering the full series.
  let seriesEventId: string | null = null;
  let seriesTeamsMeetingUrl: string | null = null;

  if (availableDates.length > 0) {
    const firstDate = availableDates[0];
    const lastDate = availableDates[availableDates.length - 1];

    const calResult = await createRecurringCalendarEvent({
      subject: `${config.label} — ${clientName}${data.sessionMode === "in_person" ? " (In Person)" : ""}`,
      startDateTime: `${firstDate}T${data.startTime}:00`,
      endDateTime: `${firstDate}T${data.endTime}:00`,
      clientName,
      clientEmail: student.email,
      recurrencePattern: data.pattern,
      seriesEndDate: lastDate,
      isOnlineMeeting: data.sessionMode !== "in_person",
    }).catch(() => null);

    seriesEventId = calResult?.seriesEventId || null;
    seriesTeamsMeetingUrl = calResult?.teamsMeetingUrl || null;
  }

  // ── Step 3: Create booking records (no individual calendar calls) ──
  for (const dateStr of availableDates) {
    const bookingDate = calendarDate(dateStr);
    const confirmationToken = randomUUID();

    // The booking and the credit that pays for it commit TOGETHER.
    //
    // They were two sequential writes: create the session, then deduct. A crash,
    // timeout or deploy between them left a confirmed session nobody was charged
    // for — and this loop runs up to 52 times inside a 120-second budget, so
    // "between them" is a window that comes round once per date. It is the same
    // free-session shape as the postpaid credit bug, reached by a different road.
    //
    // Per DATE, not per series: a whole-series transaction would undo the
    // deliberate decision below to skip a taken slot and carry on, and would hold
    // a write transaction open across dozens of rows and a Graph round trip.
    const useCreditForThisDate =
      data.useCredits && !config.isFree && !isPostpaid && creditsRemaining > 0;

    try {
      // The created row is not needed afterwards — the credit deduction that used
      // to consume it now happens inside this transaction.
      await prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
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
        couplesPartnerEmail: data.couplesPartnerEmail || null,
        graphEventId: seriesEventId,
        teamsMeetingUrl: seriesTeamsMeetingUrl,
        confirmationToken,
        originalDate: bookingDate,
        originalStartTime: data.startTime,
        studentId: student.id,
        recurringSeriesId,
        recurringPattern: data.pattern,
      },
        });

        if (useCreditForThisDate) {
          await deductCredit(
            student.id,
            created.id,
            `${config.label} — ${format(bookingDate, "d MMM yyyy")}`,
            tx,
          );
        }

        return created;
      });
    } catch (err) {
      // The slot was taken between the availability sweep above and this insert —
      // now caught by `bookings_active_slot_unique` rather than silently
      // double-booking. Skip THIS date and carry on: aborting here would leave a
      // half-built series, which is worse than a series with one gap the admin is
      // told about. Feeds the same `skipped` channel the UI already reports.
      const isTakenSlot = (err as { code?: string })?.code === "P2002";
      if (!isTakenSlot) {
        // Anything else — a lost connection, a credit deduction that failed
        // because the balance moved under us — used to abort the whole action
        // mid-loop, leaving the dates created so far, a Graph series covering
        // all of them, and no report of where it stopped. The admin saw an
        // error and had to work out by hand what existed.
        //
        // The transaction above means this date left nothing behind, so the
        // honest thing is to skip it, tell them which one, and finish the rest.
        console.error(`[recurring] ${dateStr} failed:`, err);
      }
      skippedDates.push({
        date: dateStr,
        reason: isTakenSlot ? "Slot already booked" : "Could not be created",
      });
      if (seriesEventId) {
        await deleteRecurringEventOccurrences(seriesEventId, [dateStr]).catch(console.error);
      }
      continue;
    }

    // Counters only — the deduction itself committed with the booking above.
    if (useCreditForThisDate) {
      creditsRemaining--;
      creditsUsed++;
    }

    createdDates.push(dateStr);
  }

  // ── Step 4: Prune Graph occurrences with no booking behind them ──
  //
  // Graph is handed a plain weekly/bi-weekly pattern and expands EVERY interval
  // in the range. Our bookings skip public holidays, and skip any date whose slot
  // was gone — so every one of those leaves an occurrence in the client's calendar
  // with nothing behind it. They get an invite for Christmas Day and arrive for it.
  //
  // Pruning against what was actually CREATED, rather than against a list of
  // reasons to skip, is the same approach `rebuildSeriesCalendarAction` takes: it
  // cannot miss a category, including the P2002 losses above that are only known
  // once the inserts have run.
  let calendarWarning: string | undefined;
  if (seriesEventId && createdDates.length > 0) {
    if (data.pattern === "weekly" || data.pattern === "bimonthly") {
      const booked = new Set(createdDates);
      const surplus = weeklyOccurrenceDates(
        createdDates[0],
        createdDates[createdDates.length - 1],
        data.pattern === "bimonthly" ? 2 : 1,
      ).filter((d) => !booked.has(d));
      if (surplus.length > 0) {
        const res = await deleteRecurringEventOccurrences(seriesEventId, surplus);
        if (res.failed.length > 0) {
          calendarWarning = `${res.failed.length} calendar occurrence(s) with no session behind them could not be removed — check Outlook for: ${res.failed.join(", ")}.`;
        }
      }
    } else if (skippedDates.length > 0) {
      // Monthly recurrence is not expanded here — same limitation the rebuild
      // action states rather than pretending to have handled it.
      calendarWarning = "Monthly series: skipped dates may still show in Outlook — run a calendar Check.";
    }
  }

  // Send single summary email
  if (createdDates.length > 0) {
    try {
      const baseUrl = appBaseUrl();
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

      // Name the reason. "Unavailability" over a public holiday reads as though
      // the practice was fully booked on Christmas Day, and the dates the client
      // is NOT expected on are the ones worth being precise about.
      const skippedHolidays = skippedDates.filter((s) => s.reason === "Public holiday").length;
      const skippedOther = skippedDates.length - skippedHolidays;
      const skippedReason = [
        skippedHolidays > 0 ? `${skippedHolidays} public holiday${skippedHolidays !== 1 ? "s" : ""}` : null,
        skippedOther > 0 ? `${skippedOther} date${skippedOther !== 1 ? "s" : ""} where the time was unavailable` : null,
      ]
        .filter(Boolean)
        .join(" and ");
      const skippedHtml =
        skippedDates.length > 0
          ? `<p style="margin-top: 16px; color: #6b7280;">Note: we skipped ${skippedReason} — there is no session on those days.</p>`
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
    calendarWarning: availableDates.length > 0 && !seriesEventId
      ? "Recurring calendar event could not be created — please add it manually in Outlook."
      : calendarWarning,
  };
}

// ────────────────────────────────────────────────────────────
// Bulk-complete stale (past confirmed) sessions
// ────────────────────────────────────────────────────────────

export async function markStaleSessionsCompletedAction() {
  await requireRole("super_admin", "editor");
  // `date` is a `@db.Date` stored at UTC midnight, so comparing it against a real
  // instant completes sessions that have not happened yet: from 02:00 SAST today's
  // rows already read as `< now`, and this action would mark a 15:30 session
  // "completed" at breakfast — straight into the next billing run.
  //
  // Stale means the same thing here as on the bookings list and its count
  // (`bookings/page.tsx`): confirmed, and on a day BEFORE today.
  const result = await prisma.booking.updateMany({
    where: { status: "confirmed", date: { lt: calendarDate(saToday()) } },
    data: { status: "completed" },
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { count: result.count };
}

// ────────────────────────────────────────────────────────────
// Bulk delete cancelled future bookings for a client
// ────────────────────────────────────────────────────────────

export async function bulkDeleteCancelledFutureBookingsAction(studentId: string): Promise<{ deleted: number; skippedLateCancels: number }> {
  await requireRole("super_admin");
  // Strictly AFTER today, deliberately: this path hard-deletes rows, and a booking
  // cancelled for today stays put rather than being swept up by a bulk action. Same
  // set as the `gt: new Date()` it replaces (a day column at UTC midnight is never
  // > an instant later the same day) — but it no longer says so by accident.
  const fromTomorrow = calendarDate(saToday());

  // Exclude late-cancel bookings — they may still need to be billed
  const toDelete = await prisma.booking.findMany({
    where: {
      studentId,
      status: "cancelled",
      isLateCancel: false,
      date: { gt: fromTomorrow },
      paymentRequestId: null,
      invoiceId: null,
    },
    select: { id: true, graphEventId: true, recurringSeriesId: true, date: true },
  });

  const lateCancelCount = await prisma.booking.count({
    where: {
      studentId,
      status: "cancelled",
      isLateCancel: true,
      date: { gt: fromTomorrow },
      paymentRequestId: null,
      invoiceId: null,
    },
  });

  if (toDelete.length === 0) return { deleted: 0, skippedLateCancels: lateCancelCount };

  // Calendar cleanup. Runs BEFORE deleteMany so every row still holds its event id
  // and the shared-count reads true — see lib/calendar-removal.ts.
  for (const booking of toDelete) {
    await removeBookingFromCalendar(booking);
  }

  // Check for orphaned series Graph events after deletion
  const seriesIds = [...new Set(toDelete.filter(b => b.recurringSeriesId).map(b => b.recurringSeriesId!))];
  for (const sid of seriesIds) {
    const remainingCount = await prisma.booking.count({
      where: {
        recurringSeriesId: sid,
        id: { notIn: toDelete.map(b => b.id) },
      },
    });
    if (remainingCount === 0) {
      // Last bookings in the series are being deleted — clean up master event
      const gid = toDelete.find(b => b.recurringSeriesId === sid)?.graphEventId;
      if (gid) await cancelCalendarEvent(gid).catch(console.error);
    }
  }

  const result = await prisma.booking.deleteMany({ where: { id: { in: toDelete.map((b) => b.id) } } });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/clients/${studentId}`);
  return { deleted: result.count, skippedLateCancels: lateCancelCount };
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
  const { adminUser } = await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");

  // Server-side late cancel check: is the session within 24 hours?
  const dateStr = saDateStr(booking.date);
  const bookingDateTime = saInstant(dateStr, booking.startTime);
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

  // See lib/calendar-removal.ts — decided by how many bookings share the event id.
  const lateCancelRemoval = await removeBookingFromCalendar(booking);
  const calendarWarning = lateCancelRemoval.warning;

  const config = getSessionTypeConfig(booking.sessionType);
  const email = await renderEmail("booking_cancellation", {
    clientName: booking.clientName,
    sessionType: config.label,
    date: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
    time: `${booking.startTime} – ${booking.endTime} (SAST)`,
    bookUrl: `${getBaseUrlForCurrency(booking.priceCurrency)}/book`,
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

  await recordAudit({
    action: isLateCancel ? "booking_late_cancel" : "booking_cancel",
    entityType: "booking",
    entityId: id,
    actorEmail: adminUser.email,
    before: { status: booking.status },
    after: { status: "cancelled", isLateCancel },
    metadata: { chargeLateFee },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  return { success: true as const, calendarWarning };
}

// ────────────────────────────────────────────────────────────
// Reinstate a cancelled (future) booking
// ────────────────────────────────────────────────────────────

export async function reinstateBookingAction(id: string) {
  const { adminUser } = await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "cancelled") {
    throw new Error("Only cancelled bookings can be reinstated.");
  }

  // Only future sessions can be reinstated.
  const dateStr = saDateStr(booking.date);
  const startAt = saInstant(dateStr, booking.startTime);
  if (startAt.getTime() <= Date.now()) {
    throw new Error("This session is in the past and can't be reinstated.");
  }

  // Create a fresh standalone Outlook/Teams event — the cancellation deleted the
  // original (a series occurrence can't be cleanly un-deleted). Including the
  // client as an attendee makes Outlook re-send the invite + new join link.
  const config = getSessionTypeConfig(booking.sessionType);
  const cal = await createCalendarEvent({
    subject: `${config.label} — ${booking.clientName}`,
    startDateTime: `${dateStr}T${booking.startTime}:00`,
    endDateTime: `${dateStr}T${booking.endTime}:00`,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    bookingId: booking.id,
  });

  const calendarWarning = cal?.eventId
    ? undefined
    : "Session reinstated, but the Outlook/Teams event couldn't be created — please add it manually.";

  // Un-cancel + clear the late-cancellation billing flag so the session is billed
  // once, as a normal session (no double charge).
  await prisma.booking.update({
    where: { id },
    data: {
      status: "confirmed",
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      isLateCancel: false,
      billingNote: null,
      ...(cal?.eventId
        ? { graphEventId: cal.eventId, teamsMeetingUrl: cal.teamsMeetingUrl || null }
        : {}),
    },
  });

  await recordAudit({
    action: "booking_reinstated",
    entityType: "booking",
    entityId: id,
    actorEmail: adminUser.email,
    before: { status: "cancelled" },
    after: { status: "confirmed" },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  return { success: true as const, calendarWarning };
}

// ────────────────────────────────────────────────────────────
// Check billing cycle status for a historical booking
// ────────────────────────────────────────────────────────────

export async function checkBillingCycleStatusAction(
  studentId: string,
  bookingDate: string, // yyyy-MM-dd
): Promise<
  | { status: "open" }
  | { status: "no_billing" }
  | { status: "pending"; billingMonth: string; existingRequestId: string }
  | { status: "closed"; billingMonth: string }
> {
  await requireRole("super_admin", "editor");

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { billingType: true },
  });

  if (!student || student.billingType !== "postpaid") {
    return { status: "no_billing" };
  }

  const date = new Date(bookingDate + "T12:00:00Z");
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const billingMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  const billingMonthLabel = date.toLocaleString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  });

  // PENDING: payment request sent but not yet paid — can be amended
  const pendingRequest = await prisma.paymentRequest.findFirst({
    where: {
      studentId,
      billingMonth: { startsWith: billingMonthKey },
      status: { in: ["pending", "overdue"] },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (pendingRequest) {
    return { status: "pending", billingMonth: billingMonthLabel, existingRequestId: pendingRequest.id };
  }

  // CLOSED: payment request already paid
  const paidRequest = await prisma.paymentRequest.findFirst({
    where: {
      studentId,
      billingMonth: { startsWith: billingMonthKey },
      status: "paid",
    },
    select: { id: true },
  });

  if (paidRequest) {
    return { status: "closed", billingMonth: billingMonthLabel };
  }

  // CLOSED: direct invoice exists for this period
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      studentId,
      createdAt: { gte: periodStart, lte: periodEnd },
      type: { in: ["session", "late_cancel", "ad_hoc_session"] },
      status: { not: "cancelled" },
    },
    select: { id: true },
  });

  if (existingInvoice) {
    return { status: "closed", billingMonth: billingMonthLabel };
  }

  return { status: "open" };
}

// ────────────────────────────────────────────────────────────
// Create a historical (past) booking entered in hindsight
// ────────────────────────────────────────────────────────────

type BillingResolution = "auto" | "defer" | "invoice_now" | "amend_request";

interface AdminCreateHistoricalData {
  studentId: string;
  sessionType: SessionType;
  sessionMode: SessionMode;
  date: string; // yyyy-MM-dd — must be in the past
  startTime: string;
  endTime: string;
  adminNotes?: string;
  couplesPartnerName?: string;
  couplesPartnerEmail?: string;
  billingResolution: BillingResolution;
  existingRequestId?: string; // required when billingResolution === "amend_request"
}

export async function adminCreateHistoricalBookingAction(data: AdminCreateHistoricalData) {
  await requireRole("super_admin", "editor");

  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, billingType: true },
  });
  if (!student) throw new Error("Client not found");

  const config = getSessionTypeConfig(data.sessionType);
  const settings = await getSiteSettings();
  const clientName = `${student.firstName} ${student.lastName}`.trim();
  const bookingDate = calendarDate(data.date);
  const confirmationToken = randomUUID();

  let priceZarCents = 0;
  if (!config.isFree) {
    priceZarCents = data.sessionType === "couples"
      ? (settings.sessionPriceCouplesZar ?? 0)
      : (settings.sessionPriceIndividualZar ?? 0);
  }

  // Create booking as COMPLETED — no calendar event, no confirmation email
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
      status: "completed",
      adminNotes: data.adminNotes
        ? `[Historical entry] ${data.adminNotes}`
        : "[Historical entry — added in hindsight]",
      couplesPartnerName: data.couplesPartnerName || null,
      couplesPartnerEmail: data.couplesPartnerEmail || null,
      graphEventId: null,
      teamsMeetingUrl: null,
      confirmationToken,
      originalDate: bookingDate,
      originalStartTime: data.startTime,
      studentId: student.id,
    },
  });

  // Handle billing resolution
  if (data.billingResolution === "invoice_now" && !config.isFree) {
    try {
      const { createManualInvoice } = await import("@/lib/create-invoice");
      const { generateAndStoreInvoicePDF } = await import("@/lib/generate-invoice-pdf");
      const { sendInvoiceEmail } = await import("@/lib/send-invoice");

      const dateStr = format(bookingDate, "d MMM yyyy");
      const invoice = await createManualInvoice({
        type: "ad_hoc_session",
        studentId: student.id,
        paymentMethod: "eft" as const,
        lineItems: [
          {
            description: config.label,
            subLine: `${dateStr}, ${data.startTime}–${data.endTime} (historical entry)`,
            quantity: 1,
            unitPriceCents: priceZarCents,
            totalCents: priceZarCents,
            discountCents: 0,
            discountPercent: 0,
          },
        ],
      });

      await generateAndStoreInvoicePDF(invoice.id).catch(console.error);
      await sendInvoiceEmail(invoice.id).catch(console.error);

      await prisma.booking.update({
        where: { id: booking.id },
        data: { invoiceId: invoice.id },
      });
    } catch (err) {
      console.error("Failed to create invoice for historical booking:", err);
    }
  }

  if (data.billingResolution === "amend_request" && data.existingRequestId && !config.isFree) {
    try {
      const existingPR = await prisma.paymentRequest.findUnique({
        where: { id: data.existingRequestId },
      });

      if (existingPR && existingPR.status !== "paid") {
        const { calculateInvoiceTotals, vatApplies } = await import("@/lib/billing");
        const { generateAndStoreInvoicePDF } = await import("@/lib/generate-invoice-pdf");
        const { sendInvoiceEmail } = await import("@/lib/send-invoice");

        const dateStr = format(bookingDate, "d MMM yyyy");
        const existingLines = (readLineItems(existingPR.lineItems)) || [];
        const newLine = {
          description: config.label,
          subLine: `${dateStr}, ${data.startTime}–${data.endTime} (historical entry)`,
          quantity: 1,
          unitPriceCents: priceZarCents,
          discountCents: 0,
          discountPercent: 0,
          totalCents: priceZarCents,
          bookingId: booking.id,
          attendeeName: clientName,
        };
        const updatedLines = [...existingLines, newLine];

        // Re-cost the request in ITS OWN currency. Taking `vatRegistered` raw here
        // would add 15% SA VAT to a USD payment request when a historical session
        // is appended to it — VAT is ZAR-only.
        const isVat = vatApplies(existingPR.currency, settings.vatRegistered);
        const vatPercent = isVat ? (settings.vatPercent ?? 0) : 0;
        type LineObj = { unitPriceCents: number; quantity: number; discountPercent?: number; discountCents?: number };
        const lineCalcs = (updatedLines as LineObj[]).map((li) => ({
          unitPriceCents: li.unitPriceCents,
          quantity: li.quantity,
          lineDiscountPercent: li.discountPercent || undefined,
          lineDiscountCents: li.discountCents || undefined,
        }));
        const totals = calculateInvoiceTotals(lineCalcs, undefined, undefined, isVat, vatPercent);

        await prisma.paymentRequest.update({
          where: { id: existingPR.id },
          data: {
            lineItems: parseLineItems(updatedLines, "payment request line items") as unknown as Parameters<typeof prisma.paymentRequest.update>[0]["data"]["lineItems"],
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            vatAmountCents: totals.vatAmountCents,
            totalCents: totals.totalCents,
          },
        });

        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentRequestId: existingPR.id },
        });

        // Regenerate PDF and resend for any invoice linked to this payment request
        const linkedInvoice = await prisma.invoice.findFirst({
          where: { paymentRequestId: existingPR.id },
          select: { id: true },
        });

        if (linkedInvoice) {
          await generateAndStoreInvoicePDF(linkedInvoice.id).catch(console.error);
          await sendInvoiceEmail(linkedInvoice.id).catch(console.error);
        }
      }
    } catch (err) {
      console.error("Failed to amend payment request for historical booking:", err);
    }
  }

  // "auto" and "defer": booking sits in unbilled queue for next monthly run

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${booking.id}`);
  return { success: true, bookingId: booking.id };
}
