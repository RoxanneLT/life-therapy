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
  fixed: number;
  errors: string[];
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

export async function reconcileCalendar(options?: {
  autoFix?: boolean;
  daysAhead?: number;
}): Promise<ReconcileResult> {
  const autoFix = options?.autoFix ?? false;
  const daysAhead = options?.daysAhead ?? 90;

  const result: ReconcileResult = {
    checked: 0,
    matched: 0,
    mismatched: [],
    missing: [],
    orphaned: [],
    fixed: 0,
    errors: [],
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

  // 2. Cache events by graphEventId to avoid re-fetching the same series master
  const eventCache = new Map<string, { start: string; end: string; subject: string } | null>();

  for (const booking of bookings) {
    result.checked++;

    const expectedDate = formatInTimeZone(new Date(booking.date), TIMEZONE, "yyyy-MM-dd");
    const expectedStart = booking.startTime;
    const expectedEnd = booking.endTime;

    // No Graph event ID — booking was never synced
    if (!booking.graphEventId) {
      const detail: MissingDetail = {
        bookingId: booking.id,
        clientName: booking.clientName,
        date: expectedDate,
        time: `${expectedStart}–${expectedEnd}`,
        reason: "no_graph_id",
        autoFixed: false,
      };
      result.missing.push(detail);
      if (autoFix) {
        await tryCreateMissingEvent(booking, expectedDate, expectedStart, expectedEnd, detail, result);
      }
      continue;
    }

    // Fetch the event from Outlook (cached per eventId for single events)
    let outlookEvent = eventCache.get(booking.graphEventId);
    if (outlookEvent === undefined) {
      try {
        if (booking.recurringSeriesId) {
          // Recurring — fetch the specific occurrence by date.
          // Build the window in UTC (.toISOString ends in "Z"); a literal
          // "+02:00" offset decodes to a space in the query string and Graph
          // rejects it.
          const dayStart = fromZonedTime(`${expectedDate}T00:00:00`, TIMEZONE).toISOString();
          const dayEnd = fromZonedTime(`${expectedDate}T23:59:59`, TIMEZONE).toISOString();
          const instances = await client
            .api(`/users/${config.userEmail}/events/${booking.graphEventId}/instances`)
            .query({
              startDateTime: dayStart,
              endDateTime: dayEnd,
              $select: "id,start,end,subject",
              $top: 5,
            })
            .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
            .get();

          const match = (instances.value || []).find(
            (i: { start?: { dateTime?: string } }) =>
              i.start?.dateTime?.startsWith(expectedDate),
          );

          if (match) {
            const startTime = (match.start.dateTime as string).substring(11, 16);
            const endTime = (match.end.dateTime as string).substring(11, 16);
            outlookEvent = {
              start: `${expectedDate}T${startTime}`,
              end: `${expectedDate}T${endTime}`,
              subject: match.subject || "",
            };
          } else {
            outlookEvent = null; // occurrence not found
          }
        } else {
          // Single event — fetch directly
          const event = await client
            .api(`/users/${config.userEmail}/events/${booking.graphEventId}`)
            .select("id,start,end,subject")
            .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
            .get();

          outlookEvent = {
            start: event.start.dateTime as string,
            end: event.end.dateTime as string,
            subject: event.subject || "",
          };
        }
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404) {
          outlookEvent = null;
        } else {
          result.errors.push(
            `Failed to fetch event for ${booking.clientName} on ${expectedDate}: ${error}`,
          );
          continue;
        }
      }
      // Only cache single events (recurring occurrences vary by date)
      if (!booking.recurringSeriesId) {
        eventCache.set(booking.graphEventId, outlookEvent);
      }
    }

    // Event not found in Outlook
    if (!outlookEvent) {
      const detail: MissingDetail = {
        bookingId: booking.id,
        clientName: booking.clientName,
        date: expectedDate,
        time: `${expectedStart}–${expectedEnd}`,
        reason: "event_not_found",
        autoFixed: false,
      };
      result.missing.push(detail);
      if (autoFix) {
        await tryCreateMissingEvent(booking, expectedDate, expectedStart, expectedEnd, detail, result);
      }
      continue;
    }

    // Event exists — check date and time
    const outlookStartTime = outlookEvent.start.substring(11, 16);
    const outlookDate = outlookEvent.start.substring(0, 10);

    if (outlookDate !== expectedDate || outlookStartTime !== expectedStart) {
      result.mismatched.push({
        bookingId: booking.id,
        clientName: booking.clientName,
        bookingDate: expectedDate,
        bookingTime: `${expectedStart}–${expectedEnd}`,
        outlookDate,
        outlookTime: outlookStartTime,
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

  return result;
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
