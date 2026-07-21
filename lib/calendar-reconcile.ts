import { prisma } from "@/lib/prisma";
import {
  createGraphClient,
  getGraphConfig,
  createCalendarEvent,
  cancelCalendarEvent,
} from "@/lib/graph";
import { TIMEZONE, getSessionTypeConfig } from "@/lib/booking-config";
import { saDateStr } from "@/lib/dates";
import { logCalendarOp } from "@/lib/calendar-sync-log";
import {
  classify,
  isSessionSubject,
  parseClientName,
  type ClassifyEvent,
} from "@/lib/calendar-classify";
import type { SessionType } from "@/lib/generated/prisma/client";

export interface ReconcileResult {
  checked: number;
  matched: number;
  mismatched: MismatchDetail[];
  missing: MissingDetail[];
  orphaned: OrphanedDetail[];
  onHoliday: HolidayDetail[];
  fixed: number;
  errors: string[];
  // Diagnostics for the reverse scan — confirms it actually inspected Outlook
  scannedEvents: number; // total events returned by calendarView
  sessionEventsScanned: number; // of those, ones matching our "{label} — {client}" pattern
}

interface MismatchDetail {
  bookingId: string;
  clientName: string;
  bookingDate: string;
  bookingTime: string;
  outlookDate: string;
  outlookTime: string;
  autoFixed: boolean;
}

interface MissingDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  reason: string; // "no_graph_id" | "event_not_found" | "event_deleted"
  autoFixed: boolean;
}

interface OrphanedDetail {
  graphEventId: string;
  subject: string;
  date: string;
  deleted: boolean; // auto-removed from the calendar (portal is the source of truth)
  /** The reverse-pass guard REFUSED to delete this: its client has a missing booking
   *  this run, so it's a suspected wrong-day series occurrence, not a stale duplicate. */
  protectedWrongDay?: boolean;
}

interface HolidayDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  holiday: string;
}


export async function reconcileCalendar(options?: {
  autoFix?: boolean;
  daysAhead?: number;
}): Promise<ReconcileResult> {
  const autoFix = options?.autoFix ?? false;
  const daysAhead = options?.daysAhead ?? 365;

  const result: ReconcileResult = {
    checked: 0,
    matched: 0,
    mismatched: [],
    missing: [],
    orphaned: [],
    onHoliday: [],
    fixed: 0,
    errors: [],
    scannedEvents: 0,
    sessionEventsScanned: 0,
  };

  const config = getGraphConfig();
  if (!config) {
    result.errors.push("Graph API not configured");
    return result;
  }

  const client = createGraphClient(config);
  const now = new Date();
  const futureLimit = new Date(now);
  futureLimit.setDate(futureLimit.getDate() + daysAhead);

  // 1. Get all future confirmed/pending bookings
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["confirmed", "pending"] },
      date: { gte: now, lte: futureLimit },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      clientName: true,
      clientEmail: true,
      sessionType: true,
      graphEventId: true,
      recurringSeriesId: true,
    },
    orderBy: { date: "asc" },
  });

  // 2. Pull the WHOLE calendar once (calendarView expands recurrences). A GET
  //    per booking timed out on Vercel; matching in-memory is far faster.
  let events: GraphEvent[];
  try {
    events = await fetchCalendarEvents(client, config, now, futureLimit);
  } catch (error) {
    result.errors.push(`Calendar read failed: ${error}`);
    return result; // can't reconcile without the calendar
  }
  result.scannedEvents = events.length;

  // 3. Parse session events ("{label} — {clientName}"). parseClientName strips the
  //    " (In Person)" suffix so in-person events match their booking (bug #3).
  const sessionEvents: ClassifyEvent[] = [];
  for (const ev of events) {
    const subject = ev.subject || "";
    if (!isSessionSubject(subject)) continue; // personal/blocked — leave alone
    const startDt = ev.start?.dateTime;
    if (!startDt) continue;
    result.sessionEventsScanned++;
    sessionEvents.push({
      id: ev.id,
      subject,
      date: startDt.substring(0, 10),
      start: startDt.substring(11, 16),
      end: (ev.end?.dateTime ?? "").substring(11, 16),
      clientName: parseClientName(subject),
    });
  }

  // 4. CLASSIFY — the pure core in lib/calendar-classify.ts, fixture-tested against the
  //    real 2026-06/07 incidents. Everything below is only the I/O it implies; no
  //    matching decision is made here, so the tests and production share one brain.
  const classified = classify(
    bookings.map((b) => ({
      id: b.id,
      date: saDateStr(b.date),
      startTime: b.startTime,
      endTime: b.endTime,
      clientName: b.clientName,
      hasGraphEvent: !!b.graphEventId,
      isRecurring: !!b.recurringSeriesId,
    })),
    sessionEvents,
  );

  result.checked = classified.checked;
  result.matched = classified.matched;
  result.mismatched = classified.mismatched.map((m) => ({
    bookingId: m.bookingId,
    clientName: m.clientName,
    bookingDate: m.date,
    bookingTime: m.bookingTime,
    outlookDate: m.date,
    outlookTime: m.outlookTime,
    autoFixed: false,
  }));

  // 5. Act on the missing. Only NON-recurring gaps are auto-created — recreating a
  //    recurring occurrence as a standalone event fragments the series and gives the
  //    client a different meeting than the coach. Recurring gaps are reported instead.
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  for (const m of classified.missing) {
    const detail: MissingDetail = {
      bookingId: m.bookingId,
      clientName: m.clientName,
      date: m.date,
      time: m.time,
      reason: m.reason,
      autoFixed: false,
    };
    result.missing.push(detail);
    const booking = bookingById.get(m.bookingId);
    if (autoFix && booking && !m.isRecurring && writeBudgetLeft(result) > 0) {
      await tryCreateMissingEvent(booking, m.date, m.startTime, m.endTime, detail, result);
    }
  }

  // 6. Act on the ghosts. classify() has already applied the SAFETY GUARD (bug #5):
  //    a ghost is `deletable: false` when its client still has a missing booking, which
  //    means it's a suspected wrong-day twin rather than a stale duplicate. Those are
  //    flagged durably for human review and NEVER deleted — this is the fix for the
  //    incident where 50 of one client's real occurrences were silently wiped.
  for (const o of classified.orphaned) {
    const orphan: OrphanedDetail = {
      graphEventId: o.graphEventId,
      subject: o.subject,
      date: `${o.date} ${o.start}`,
      deleted: false,
    };
    result.orphaned.push(orphan);

    if (!o.deletable) {
      orphan.protectedWrongDay = true;
      await logCalendarOp({
        operation: "reconcile",
        status: "partial",
        graphEventId: o.graphEventId,
        metadata: {
          action: "protected_suspected_wrong_day",
          date: o.date,
          subject: o.subject,
          client: o.clientName,
        },
      });
      continue;
    }

    if (autoFix && writeBudgetLeft(result) > 0) {
      try {
        await cancelCalendarEvent(o.graphEventId);
        orphan.deleted = true;
        result.fixed++;
        await logCalendarOp({
          operation: "delete",
          status: "success",
          graphEventId: o.graphEventId,
          metadata: { action: "deleted_ghost_event", date: o.date, subject: o.subject },
        });
      } catch (error) {
        result.errors.push(`Failed to delete ghost "${o.subject}" on ${o.date}: ${error}`);
      }
    }
  }

  // 6. Business-rule check: bookings on SA public holidays (DB only, cheap).
  try {
    const { isSAPublicHoliday } = await import("@/lib/sa-holidays");
    for (const booking of bookings) {
      const dateStr = saDateStr(booking.date);
      if (isSAPublicHoliday(new Date(`${dateStr}T12:00:00Z`))) {
        result.onHoliday.push({
          bookingId: booking.id,
          clientName: booking.clientName,
          date: dateStr,
          time: `${booking.startTime}–${booking.endTime}`,
          holiday: "Public holiday",
        });
      }
    }
  } catch (error) {
    result.errors.push(`Holiday check failed: ${error}`);
  }

  return result;
}

interface GraphEvent {
  id: string;
  subject?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}

/** Cap on Graph write operations (creates + deletes) per run so a large backlog
 *  can't blow the serverless timeout — the rest resolve on the next run. */
const WRITE_BUDGET = 60;
function writeBudgetLeft(result: ReconcileResult): number {
  return Math.max(0, WRITE_BUDGET - result.fixed);
}

/** Pull every event in the window via calendarView (recurrences expanded),
 *  following pagination. One bulk read replaces a GET per booking. */
async function fetchCalendarEvents(
  client: ReturnType<typeof createGraphClient>,
  config: NonNullable<ReturnType<typeof getGraphConfig>>,
  windowStart: Date,
  windowEnd: Date,
): Promise<GraphEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = await client
    .api(`/users/${config.userEmail}/calendarView`)
    .query({
      // UTC ("Z") — a literal "+02:00" would be decoded as a space and rejected
      startDateTime: windowStart.toISOString(),
      endDateTime: windowEnd.toISOString(),
      $select: "id,subject,start,end",
      $top: 999,
    })
    .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
    .get();

  const events: GraphEvent[] = [...(page.value || [])];
  let guard = 0;
  while (page["@odata.nextLink"] && guard < 25) {
    page = await client.api(page["@odata.nextLink"]).get();
    events.push(...(page.value || []));
    guard++;
  }
  return events;
}

/** Auto-fix a NON-recurring booking whose Outlook event is missing by creating a
 *  new one and re-inviting the client (the new event has a new Teams meeting). */
async function tryCreateMissingEvent(
  booking: {
    id: string;
    clientName: string;
    clientEmail: string;
    sessionType: SessionType;
  },
  expectedDate: string,
  expectedStart: string,
  expectedEnd: string,
  detail: MissingDetail,
  result: ReconcileResult,
): Promise<void> {
  try {
    const sessionConfig = getSessionTypeConfig(booking.sessionType);
    const calResult = await createCalendarEvent({
      subject: `${sessionConfig.label} — ${booking.clientName}`,
      startDateTime: `${expectedDate}T${expectedStart}:00`,
      endDateTime: `${expectedDate}T${expectedEnd}:00`,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      // Re-invite the client. The recreated event has a NEW Teams meeting, so the
      // client's old invite is stale — suppressing it would leave them on a
      // different meeting than the coach. Sending the invite keeps them aligned.
      suppressAttendees: false,
      bookingId: booking.id,
    });
    if (calResult) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          graphEventId: calResult.eventId,
          // Persist the NEW meeting link too — otherwise the client's portal keeps
          // the old link while the coach's calendar has a different one.
          ...(calResult.teamsMeetingUrl
            ? { teamsMeetingUrl: calResult.teamsMeetingUrl }
            : {}),
        },
      });
      detail.autoFixed = true;
      result.fixed++;
      await logCalendarOp({
        bookingId: booking.id,
        operation: "reconcile",
        status: "success",
        graphEventId: calResult.eventId,
        metadata: { action: "created_missing_event", date: expectedDate },
      });
    }
  } catch (error) {
    result.errors.push(
      `Auto-fix failed for ${booking.clientName} on ${expectedDate}: ${error}`,
    );
  }
}
