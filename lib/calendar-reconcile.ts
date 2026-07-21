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

/** Normalise a client name for matching: lowercase, collapse internal whitespace. */
export function normName(clientName: string): string {
  return clientName.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Normalised match key: a booking and a Teams event are "the same" if their
 *  SAST date, start time, and client name agree. */
function reconcileKey(date: string, time: string, clientName: string): string {
  return `${date}|${time}|${normName(clientName)}`;
}

/**
 * The reverse-pass safety guard — the fix for the 2026-06/07 mass-deletion incident.
 *
 * A ghost (session event with no matching booking) is safe to delete ONLY if its client
 * has NO booking left unmatched this run. If the same client DOES have a missing booking,
 * the ghost is almost certainly the wrong-day twin of that now-eventless booking
 * (Mia/Chanene) — deleting it is the silent-data-loss failure, so we refuse and flag it.
 * If every one of the client's bookings matched, the ghost is a true duplicate (the
 * booking is already satisfied by another event — the harmless June cleanup) and stays
 * deletable.
 *
 * This one set-membership check separates the two cases that a blanket "never delete a
 * recurring occurrence" rule could not: it would have blocked June's correct cleanup too.
 * Replayed against history: June wave → clients all matched → dupes deleted; Jul-09 Mia
 * and today's Chanene → client had missing bookings → deletion refused.
 */
export function isGhostDeletable(
  ghostClientNorm: string,
  clientsWithMissingBookings: Set<string>,
): boolean {
  return !clientsWithMissingBookings.has(ghostClientNorm);
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

  // 3. Index session events ("{label} — {clientName}") by date|start|client.
  const eventsByKey = new Map<string, SessionEvent[]>();
  const sessionEvents: SessionEvent[] = [];
  for (const ev of events) {
    const subject = ev.subject || "";
    if (!subject.includes(" — ")) continue; // personal/blocked — leave alone
    const startDt = ev.start?.dateTime;
    if (!startDt) continue;
    result.sessionEventsScanned++;
    const entry: SessionEvent = {
      id: ev.id,
      subject,
      date: startDt.substring(0, 10),
      start: startDt.substring(11, 16),
      end: (ev.end?.dateTime ?? "").substring(11, 16),
      clientName: subject.split(" — ").slice(1).join(" — ").trim(),
    };
    sessionEvents.push(entry);
    const key = reconcileKey(entry.date, entry.start, entry.clientName);
    const list = eventsByKey.get(key) ?? [];
    list.push(entry);
    eventsByKey.set(key, list);
  }

  // 4. Forward pass — every booking should have a matching event.
  const consumedKeys = new Set<string>();
  for (const booking of bookings) {
    result.checked++;
    const expectedDate = saDateStr(booking.date);
    const expectedStart = booking.startTime;
    const expectedEnd = booking.endTime;
    const key = reconcileKey(expectedDate, expectedStart, booking.clientName);
    const candidates = eventsByKey.get(key);

    if (candidates && candidates.length > 0) {
      consumedKeys.add(key);
      if (candidates.some((c) => c.end === expectedEnd)) {
        result.matched++;
      } else {
        // Start matches but the duration differs (second-pass check).
        result.mismatched.push({
          bookingId: booking.id,
          clientName: booking.clientName,
          bookingDate: expectedDate,
          bookingTime: `${expectedStart}–${expectedEnd}`,
          outlookDate: expectedDate,
          outlookTime: `${expectedStart}–${candidates[0].end}`,
          autoFixed: false,
        });
      }
      continue;
    }

    // No event at that slot → missing
    const detail: MissingDetail = {
      bookingId: booking.id,
      clientName: booking.clientName,
      date: expectedDate,
      time: `${expectedStart}–${expectedEnd}`,
      reason: booking.graphEventId ? "event_not_found" : "no_graph_id",
      autoFixed: false,
    };
    result.missing.push(detail);
    // Only auto-create for NON-recurring bookings. Recreating a recurring
    // occurrence as a standalone event fragments the series and gives the client
    // a different meeting than the coach (the source of the Teams-link drift).
    // Recurring gaps are reported for manual review instead of silently forked.
    if (autoFix && !booking.recurringSeriesId && writeBudgetLeft(result) > 0) {
      await tryCreateMissingEvent(booking, expectedDate, expectedStart, expectedEnd, detail, result);
    }
  }

  // 5. Reverse pass — session events with no matching booking are ghosts.
  //    Portal is the source of truth, so under auto-fix we DELETE them — EXCEPT where
  //    the guard below refuses (a suspected wrong-day twin of a still-missing booking).
  //
  // Clients that have at least one booking with no matching event this run. A ghost for
  // one of these is the suspected wrong-day occurrence of that now-eventless booking
  // (Mia/Chanene) — never delete it (see isGhostDeletable). The June cleanup is unaffected
  // because those clients' bookings all matched, so they're absent from this set.
  const clientsWithMissingBookings = new Set(
    result.missing.map((m) => normName(m.clientName)),
  );

  for (const ev of sessionEvents) {
    const key = reconcileKey(ev.date, ev.start, ev.clientName);
    if (consumedKeys.has(key)) continue; // belongs to a real booking
    const orphan: OrphanedDetail = {
      graphEventId: ev.id,
      subject: ev.subject,
      date: `${ev.date} ${ev.start}`,
      deleted: false,
    };
    result.orphaned.push(orphan);

    // SAFETY GUARD (bug #5) — the fix for the mass-deletion incident. If this ghost's
    // client still has a missing booking, it's a suspected wrong-day series occurrence:
    // refuse to delete, flag it durably for human review instead of silently wiping it.
    // (Name-matching relies on the parsed client name; bug #3's " (In Person)" suffix
    // strip will extend this guard to in-person events — none exist in prod today.)
    if (!isGhostDeletable(normName(ev.clientName), clientsWithMissingBookings)) {
      orphan.protectedWrongDay = true;
      await logCalendarOp({
        operation: "reconcile",
        status: "partial",
        graphEventId: ev.id,
        metadata: { action: "protected_suspected_wrong_day", date: ev.date, subject: ev.subject },
      });
      continue;
    }

    if (autoFix && writeBudgetLeft(result) > 0) {
      try {
        await cancelCalendarEvent(ev.id);
        orphan.deleted = true;
        result.fixed++;
        await logCalendarOp({
          operation: "delete",
          status: "success",
          graphEventId: ev.id,
          metadata: { action: "deleted_ghost_event", date: ev.date, subject: ev.subject },
        });
      } catch (error) {
        result.errors.push(`Failed to delete ghost "${ev.subject}" on ${ev.date}: ${error}`);
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

interface SessionEvent {
  id: string;
  subject: string;
  date: string;
  start: string;
  end: string;
  clientName: string;
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
