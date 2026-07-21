/**
 * lib/calendar-reconcile.ts — compare the portal against Outlook and PROPOSE repairs.
 *
 * This module is READ-ONLY. It never creates, deletes or modifies a calendar event, and
 * writes nothing to the database. That is not an accident of the current call sites: a
 * blanket auto-fix is what deleted 50 of a client's real sessions in July 2026, so the
 * ability to act was removed from here entirely rather than merely switched off.
 *
 * Repairs happen in lib/calendar-apply.ts, against explicitly approved items that are
 * re-verified at execution time.
 */
import { prisma } from "@/lib/prisma";
import { createGraphClient, getGraphConfig } from "@/lib/graph";
import { TIMEZONE } from "@/lib/booking-config";
import { saDateStr } from "@/lib/dates";
import {
  classify,
  isSessionSubject,
  parseClientName,
  summariseMissingByClient,
  type ClassifyEvent,
  type ClassifiedMismatch,
  type ClassifiedMissing,
  type ClassifiedOrphan,
  type ClassifiedDuplicate,
} from "@/lib/calendar-classify";

export interface HolidayDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  holiday: string;
}

/** The classification, plus the context needed to judge and act on it. */
export interface ReconcileResult {
  checked: number;
  matched: number;
  mismatched: ClassifiedMismatch[];
  missing: ClassifiedMissing[];
  orphaned: ClassifiedOrphan[];
  duplicates: ClassifiedDuplicate[];
  onHoliday: HolidayDetail[];
  errors: string[];
  // Diagnostics for the reverse scan — confirms it actually inspected Outlook
  scannedEvents: number; // total events returned by calendarView
  sessionEventsScanned: number; // of those, ones matching our "{label} — {client}" pattern
  /** Who is eventless, how many sessions each, soonest first. Persisted on every run so
   *  drift is named the day it appears, not discovered weeks later from a bare count. */
  missingByClient: Array<{ client: string; count: number; nextDate: string }>;
}

/** True when anything at all needs a human's attention. Drives the digest alert and the
 *  admin drift badge — silence should mean "verified clean", not "nobody looked". */
export function hasDrift(r: ReconcileResult): boolean {
  return (
    r.missing.length > 0 ||
    r.orphaned.length > 0 ||
    r.duplicates.length > 0 ||
    r.mismatched.length > 0
  );
}

export async function reconcileCalendar(options?: {
  daysAhead?: number;
}): Promise<ReconcileResult> {
  const daysAhead = options?.daysAhead ?? 365;

  const result: ReconcileResult = {
    checked: 0,
    matched: 0,
    mismatched: [],
    missing: [],
    orphaned: [],
    duplicates: [],
    onHoliday: [],
    errors: [],
    scannedEvents: 0,
    sessionEventsScanned: 0,
    missingByClient: [],
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

  // 1. Every future confirmed/pending booking — the source of truth.
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
      graphEventId: true,
      recurringSeriesId: true,
    },
    orderBy: { date: "asc" },
  });

  // 2. Pull the WHOLE calendar once (calendarView expands recurrences). A GET per
  //    booking timed out on Vercel; matching in-memory is far faster.
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
      seriesMasterId: ev.seriesMasterId ?? null,
    });
  }

  // 4. Classify — the pure core in lib/calendar-classify.ts, fixture-tested against the
  //    real 2026-06/07 incidents. Production and the tests share one brain.
  const classified = classify(
    bookings.map((b) => ({
      id: b.id,
      date: saDateStr(b.date),
      startTime: b.startTime,
      endTime: b.endTime,
      clientName: b.clientName,
      graphEventId: b.graphEventId,
      isRecurring: !!b.recurringSeriesId,
    })),
    sessionEvents,
  );

  result.checked = classified.checked;
  result.matched = classified.matched;
  result.mismatched = classified.mismatched;
  result.missing = classified.missing;
  result.orphaned = classified.orphaned;
  result.duplicates = classified.duplicates;

  // Name the drift. A bare "missing: 26" is why an eventless series went unnoticed for
  // twelve days; this rolls it up per client, soonest session first.
  result.missingByClient = summariseMissingByClient(result.missing);

  // 5. Business-rule check: bookings on SA public holidays (DB only, cheap).
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
  /** Present on an expanded occurrence: the id of the series master it came from.
   *  calendarView gives occurrences their OWN ids, so this is the only reliable way a
   *  booking holding a master id can be matched to its occurrence. */
  seriesMasterId?: string | null;
}

/** Pull every event in the window via calendarView (recurrences expanded), following
 *  pagination. One bulk read replaces a GET per booking. */
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
      // seriesMasterId lets a booking that stores the series master id be matched to its
      // expanded occurrence — without it, every recurring occurrence looks unowned and
      // the duplicate check cannot tell which event in a slot to keep.
      $select: "id,subject,start,end,seriesMasterId",
      $top: 999,
    })
    .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
    .get();

  const events: GraphEvent[] = [...(page.value || [])];
  let guard = 0;
  while (page["@odata.nextLink"] && guard < 25) {
    // The Prefer header MUST be re-sent on every page. Without it Graph returns page 2+
    // in UTC while page 1 is SAST, and the parser slices substring(11,16) assuming SAST —
    // so every later event reads 2 hours off, manufacturing matched pairs of false
    // "missing" and false "ghost".
    page = await client
      .api(page["@odata.nextLink"])
      .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
      .get();
    events.push(...(page.value || []));
    guard++;
  }
  return events;
}
