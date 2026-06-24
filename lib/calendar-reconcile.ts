import { prisma } from "@/lib/prisma";
import { createGraphClient, getGraphConfig, createCalendarEvent } from "@/lib/graph";
import { TIMEZONE, getSessionTypeConfig } from "@/lib/booking-config";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
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
}

interface HolidayDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  holiday: string;
}

/** Normalised match key: a booking and a Teams event are "the same" if their
 *  SAST date, start time, and client name agree. */
function reconcileKey(date: string, time: string, clientName: string): string {
  return `${date}|${time}|${clientName.toLowerCase().replace(/\s+/g, " ").trim()}`;
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

  // 2. Cache event metadata by graphEventId (a series master is shared by
  //    many bookings, so we only fetch each event once).
  const eventMetaCache = new Map<
    string,
    { type: string; start: string; end: string } | null
  >();

  for (const booking of bookings) {
    result.checked++;

    const expectedDate = formatInTimeZone(new Date(booking.date), TIMEZONE, "yyyy-MM-dd");
    const expectedStart = booking.startTime;
    const expectedEnd = booking.endTime;

    const recordMissing = async (reason: string) => {
      const detail: MissingDetail = {
        bookingId: booking.id,
        clientName: booking.clientName,
        date: expectedDate,
        time: `${expectedStart}–${expectedEnd}`,
        reason,
        autoFixed: false,
      };
      result.missing.push(detail);
      if (autoFix) {
        await tryCreateMissingEvent(booking, expectedDate, expectedStart, expectedEnd, detail, result);
      }
    };

    // No Graph event ID — booking was never synced
    if (!booking.graphEventId) {
      await recordMissing("no_graph_id");
      continue;
    }

    // Fetch the event itself. This works for BOTH single events and series
    // masters — we then branch on its actual `type`, rather than assuming a
    // booking with recurringSeriesId points at a series master (after a
    // reschedule it can point at a standalone single event).
    let meta = eventMetaCache.get(booking.graphEventId);
    if (meta === undefined) {
      try {
        const ev = await client
          .api(`/users/${config.userEmail}/events/${booking.graphEventId}`)
          .select("id,start,end,type")
          .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
          .get();
        meta = {
          type: (ev.type as string) || "singleInstance",
          start: ev.start.dateTime as string,
          end: ev.end.dateTime as string,
        };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404) {
          meta = null;
        } else {
          result.errors.push(
            `Failed to fetch event for ${booking.clientName} on ${expectedDate}: ${error}`,
          );
          continue;
        }
      }
      eventMetaCache.set(booking.graphEventId, meta);
    }

    // Event ID no longer exists in Outlook
    if (!meta) {
      await recordMissing("event_not_found");
      continue;
    }

    // Resolve the Outlook start/end for THIS booking's date.
    let outlookEvent: { start: string; end: string } | null;
    if (meta.type === "seriesMaster") {
      // Genuine recurring series — expand to the occurrence on this date.
      // Window built in UTC (.toISOString ends in "Z"); a literal "+02:00"
      // offset decodes to a space in the query string and Graph rejects it.
      try {
        const dayStart = fromZonedTime(`${expectedDate}T00:00:00`, TIMEZONE).toISOString();
        const dayEnd = fromZonedTime(`${expectedDate}T23:59:59`, TIMEZONE).toISOString();
        const instances = await client
          .api(`/users/${config.userEmail}/events/${booking.graphEventId}/instances`)
          .query({ startDateTime: dayStart, endDateTime: dayEnd, $select: "id,start,end", $top: 5 })
          .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
          .get();
        const match = (instances.value || []).find(
          (i: { start?: { dateTime?: string } }) => i.start?.dateTime?.startsWith(expectedDate),
        );
        outlookEvent = match
          ? { start: match.start.dateTime as string, end: match.end.dateTime as string }
          : null;
      } catch (error) {
        result.errors.push(
          `Failed to expand series for ${booking.clientName} on ${expectedDate}: ${error}`,
        );
        continue;
      }
    } else {
      // Single event (or a standalone occurrence created by a past reschedule)
      outlookEvent = { start: meta.start, end: meta.end };
    }

    // Series occurrence not present on this date
    if (!outlookEvent) {
      await recordMissing("event_not_found");
      continue;
    }

    // Event exists — validate date, start time AND end time (second pass).
    // Requiring the end time to agree too means a "match" really is identical,
    // not just coincidentally sharing a start — it catches wrong-duration events.
    const outlookDate = outlookEvent.start.substring(0, 10);
    const outlookStartTime = outlookEvent.start.substring(11, 16);
    const outlookEndTime = outlookEvent.end.substring(11, 16);

    const dateOrStartWrong =
      outlookDate !== expectedDate || outlookStartTime !== expectedStart;
    const durationWrong = outlookEndTime !== expectedEnd;

    if (dateOrStartWrong || durationWrong) {
      result.mismatched.push({
        bookingId: booking.id,
        clientName: booking.clientName,
        bookingDate: expectedDate,
        bookingTime: `${expectedStart}–${expectedEnd}`,
        outlookDate,
        outlookTime: `${outlookStartTime}–${outlookEndTime}`,
        autoFixed: false,
      });
      // Mismatches are flagged for manual review only — changing an event's
      // time can fire update notifications to the client.
    } else {
      result.matched++;
    }

    // Rate limit: brief pause every 10 bookings to avoid Graph throttling
    if (result.checked % 10 === 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // 3. Business-rule check: confirmed/pending bookings on SA public holidays
  try {
    const { isSAPublicHoliday } = await import("@/lib/sa-holidays");
    for (const booking of bookings) {
      const dateStr = formatInTimeZone(new Date(booking.date), TIMEZONE, "yyyy-MM-dd");
      const d = new Date(`${dateStr}T12:00:00Z`);
      if (isSAPublicHoliday(d)) {
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

  // 4. Reverse scan: Teams session-events with no matching active booking
  //    (stale/duplicate/wrong-time events left behind — the "incorrect" cases
  //    a forward-only scan can't see).
  try {
    await findOrphanEvents(client, config, now, futureLimit, bookings, result);
  } catch (error) {
    result.errors.push(`Orphan scan failed: ${error}`);
  }

  return result;
}

/**
 * List every Outlook event in the window (calendarView expands recurrences),
 * keep only our session events ("{label} — {clientName}"), and flag any whose
 * date/time/client doesn't match an active booking — i.e. stale, duplicated,
 * or wrong-time events that should not be on the calendar.
 */
async function findOrphanEvents(
  client: ReturnType<typeof createGraphClient>,
  config: NonNullable<ReturnType<typeof getGraphConfig>>,
  windowStart: Date,
  windowEnd: Date,
  bookings: { date: Date; startTime: string; clientName: string }[],
  result: ReconcileResult,
): Promise<void> {
  const expected = new Set<string>();
  for (const b of bookings) {
    const date = formatInTimeZone(new Date(b.date), TIMEZONE, "yyyy-MM-dd");
    expected.add(reconcileKey(date, b.startTime, b.clientName));
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = [...(page.value || [])];
  let guard = 0;
  while (page["@odata.nextLink"] && guard < 25) {
    page = await client.api(page["@odata.nextLink"]).get();
    events.push(...(page.value || []));
    guard++;
  }

  result.scannedEvents = events.length;

  for (const ev of events) {
    const subject: string = ev.subject || "";
    // Only our session events use the "{label} — {clientName}" pattern.
    if (!subject.includes(" — ")) continue;
    result.sessionEventsScanned++;
    const startDt: string | undefined = ev.start?.dateTime;
    if (!startDt) continue;

    const date = startDt.substring(0, 10);
    const time = startDt.substring(11, 16);
    const clientName = subject.split(" — ").slice(1).join(" — ");

    if (expected.has(reconcileKey(date, time, clientName))) continue; // legit
    result.orphaned.push({
      graphEventId: ev.id,
      subject,
      date: `${date} ${time}`,
    });
  }
}

/** Auto-fix a booking whose Outlook event is missing by creating a new one.
 *  Uses suppressAttendees so the client is not emailed a duplicate invite. */
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
      suppressAttendees: true,
      bookingId: booking.id,
    });
    if (calResult) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { graphEventId: calResult.eventId },
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
