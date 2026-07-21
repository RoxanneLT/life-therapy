/**
 * lib/calendar-apply.ts — execute repairs the admin explicitly approved.
 *
 * This is the ONLY place calendar reconciliation is allowed to write. Three rules make
 * it safe, and each exists because its absence caused the July 2026 incident:
 *
 *  1. It acts on NAMED ITEMS, never a "fix everything" flag. An approval identifies the
 *     exact event or booking it covers.
 *  2. It RE-VERIFIES every item against freshly-read state immediately before acting.
 *     Approval and execution are separated in time; anything can change in between.
 *  3. Anything that fails re-verification is SKIPPED AND REPORTED, never forced.
 *
 * The reverse-pass guard is enforced a second time here for free: a protected wrong-day
 * ghost never carries proposal "delete", so no approval naming one can be honoured —
 * even a hand-crafted request.
 */
import { prisma } from "@/lib/prisma";
import { cancelCalendarEvent, createCalendarEvent } from "@/lib/graph";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { logCalendarOp } from "@/lib/calendar-sync-log";
import { recordAudit } from "@/lib/audit";
import { saDateStr } from "@/lib/dates";
import { isStillProposed, type RepairItem } from "@/lib/calendar-classify";
import { reconcileCalendar } from "@/lib/calendar-reconcile";

/** Cap on Graph writes per apply so a large backlog can't blow the serverless timeout.
 *  The rest simply stay proposed and can be approved again. */
const WRITE_BUDGET = 60;

export interface ApplyOutcome {
  item: RepairItem;
  status: "applied" | "skipped" | "failed";
  detail: string;
}

export interface ApplyResult {
  applied: number;
  skipped: number;
  failed: number;
  outcomes: ApplyOutcome[];
}

/**
 * Apply approved repairs. `actorEmail` is recorded against every action — an admin
 * repair must always be attributable.
 */
export async function applyCalendarRepairs(
  items: RepairItem[],
  actorEmail: string,
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, failed: 0, outcomes: [] };
  if (items.length === 0) return result;

  // Read the world again, right now. Everything below is judged against THIS, not
  // against whatever the admin was looking at when they ticked the boxes.
  const fresh = await reconcileCalendar({ daysAhead: 365 });
  if (fresh.errors.length > 0) {
    // If we could not read the calendar we cannot re-verify, and acting blind is exactly
    // the failure mode this module exists to prevent.
    return {
      applied: 0,
      skipped: items.length,
      failed: 0,
      outcomes: items.map((item) => ({
        item,
        status: "skipped" as const,
        detail: `Could not re-read the calendar, so nothing was changed: ${fresh.errors[0]}`,
      })),
    };
  }

  for (const item of items) {
    if (result.applied >= WRITE_BUDGET) {
      record(result, item, "skipped", "Write budget reached — approve again to continue.");
      continue;
    }

    if (!isStillProposed(item, fresh)) {
      record(
        result,
        item,
        "skipped",
        "No longer applicable — the calendar changed since this was approved.",
      );
      continue;
    }

    if (item.action === "delete") {
      await applyDelete(item.graphEventId, actorEmail, result, item);
    } else {
      await applyCreate(item.bookingId, actorEmail, result, item);
    }
  }

  await recordAudit({
    action: "calendar_repairs_applied",
    entityType: "booking",
    entityId: "calendar-reconcile",
    actorEmail,
    after: {
      requested: items.length,
      applied: result.applied,
      skipped: result.skipped,
      failed: result.failed,
    },
  });

  return result;
}

function record(
  result: ApplyResult,
  item: RepairItem,
  status: ApplyOutcome["status"],
  detail: string,
) {
  result.outcomes.push({ item, status, detail });
  if (status === "applied") result.applied++;
  else if (status === "skipped") result.skipped++;
  else result.failed++;
}

async function applyDelete(
  graphEventId: string,
  actorEmail: string,
  result: ApplyResult,
  item: RepairItem,
) {
  try {
    await cancelCalendarEvent(graphEventId);
    record(result, item, "applied", "Event deleted.");
    await logCalendarOp({
      operation: "delete",
      status: "success",
      graphEventId,
      metadata: { action: "approved_repair_delete", approvedBy: actorEmail },
    });
  } catch (error) {
    record(result, item, "failed", `Delete failed: ${error}`);
  }
}

async function applyCreate(
  bookingId: string,
  actorEmail: string,
  result: ApplyResult,
  item: RepairItem,
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      clientName: true,
      clientEmail: true,
      sessionType: true,
      sessionMode: true,
      recurringSeriesId: true,
    },
  });

  if (!booking) {
    record(result, item, "skipped", "Booking no longer exists.");
    return;
  }
  if (booking.recurringSeriesId) {
    // Belt and braces: classify never proposes "create" for a recurring booking, because
    // a lone occurrence forks the series. Refuse regardless of what was asked for.
    record(result, item, "skipped", "Recurring booking — rebuild the series instead.");
    return;
  }

  const date = saDateStr(booking.date);
  const inPerson = booking.sessionMode === "in_person";
  const config = getSessionTypeConfig(booking.sessionType);

  try {
    const created = await createCalendarEvent({
      subject: `${config.label} — ${booking.clientName}${inPerson ? " (In Person)" : ""}`,
      startDateTime: `${date}T${booking.startTime}:00`,
      endDateTime: `${date}T${booking.endTime}:00`,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      // An in-person session must not be silently rebuilt as a Teams meeting.
      isOnlineMeeting: !inPerson,
      // Re-invite: the client's previous invite points at an event that no longer
      // exists, so suppressing this would leave them on a different meeting than the coach.
      suppressAttendees: false,
      bookingId: booking.id,
    });

    if (!created?.eventId) {
      record(result, item, "failed", "Calendar event could not be created.");
      return;
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        graphEventId: created.eventId,
        ...(created.teamsMeetingUrl ? { teamsMeetingUrl: created.teamsMeetingUrl } : {}),
      },
    });

    record(result, item, "applied", `Event created for ${date}.`);
    await logCalendarOp({
      bookingId: booking.id,
      operation: "create",
      status: "success",
      graphEventId: created.eventId,
      metadata: { action: "approved_repair_create", date, approvedBy: actorEmail },
    });
  } catch (error) {
    record(result, item, "failed", `Create failed: ${error}`);
  }
}
