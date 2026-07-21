/**
 * lib/graph-payloads.ts — PURE builders for the Microsoft Graph event request bodies.
 *
 * Why this exists: every calendar bug this project has shipped lived in the translation
 * from a booking to a Graph payload (the weekday token, the recurrence range, the
 * online-meeting flags) — and none of it was testable, because the bodies were built
 * inline inside functions that also did network I/O. These builders are pure: no Client,
 * no fetch, no env. `createCalendarEvent` / `createRecurringCalendarEvent` are thin
 * wrappers that POST what these return, so the contract can be asserted in unit tests
 * (lib/graph-payloads.test.ts).
 *
 * Behaviour here is a faithful extraction of what shipped — deliberately NOT "improved"
 * in the same change, so the refactor is provably neutral.
 *
 * KNOWN LATENT EDGE (documented, unchanged): `startDateTime` is a naive SAST wall-clock
 * string ("2026-08-11T09:00:00"), and `new Date()` parses it in the SERVER's timezone.
 * On Vercel (UTC) a 09:00 booking becomes 09:00Z = 11:00 SAST — same calendar day, so
 * the weekday is right. It would only skew for a start late enough that the UTC→SAST
 * +2h shift crosses midnight, which business-hours bookings never hit. Worth fixing
 * separately; not silently changed here.
 */
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/booking-config";
import { saDateStr } from "@/lib/dates";
import { graphDayOfWeek, GRAPH_WEEK_INDEX } from "@/lib/graph-recurrence";

interface GraphDateTime {
  dateTime: string;
  timeZone: string;
}

interface GraphAttendee {
  emailAddress: { address: string; name: string };
  type: "required";
}

export interface GraphRecurrence {
  pattern: {
    type: "weekly" | "relativeMonthly";
    interval: number;
    daysOfWeek: string[];
    index?: string;
  };
  range: { type: "endDate"; startDate: string; endDate: string };
}

export interface GraphEventBody {
  subject: string;
  body?: { contentType: "HTML"; content: string };
  start: GraphDateTime;
  end: GraphDateTime;
  attendees?: GraphAttendee[];
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: "teamsForBusiness";
  recurrence?: GraphRecurrence;
}

export interface SingleEventParams {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  clientName: string;
  clientEmail: string;
  description?: string;
  isOnlineMeeting?: boolean;
  /** Omit the client attendee so Outlook sends no invite (reconcile auto-fix path). */
  suppressAttendees?: boolean;
}

export interface RecurringEventParams {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  clientName: string;
  clientEmail: string;
  recurrencePattern: "weekly" | "bimonthly" | "monthly";
  /** Last occurrence date, "YYYY-MM-DD". */
  seriesEndDate: string;
  isOnlineMeeting?: boolean;
}

/** One attendee entry — the client, marked required. */
function attendee(name: string, email: string): GraphAttendee {
  return { emailAddress: { address: email, name }, type: "required" };
}

/**
 * Teams flags. `isOnlineMeeting` defaults to TRUE — only an explicit `false` (an
 * in-person session) omits them. Preserves the `!== false` check that shipped.
 */
function onlineMeetingFields(
  isOnlineMeeting?: boolean,
): Pick<GraphEventBody, "isOnlineMeeting" | "onlineMeetingProvider"> {
  return isOnlineMeeting !== false
    ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" }
    : {};
}

/** The request body for a single (non-recurring) calendar event. */
export function buildSingleEventPayload(params: SingleEventParams): GraphEventBody {
  return {
    subject: params.subject,
    body: { contentType: "HTML", content: params.description || "" },
    start: { dateTime: params.startDateTime, timeZone: TIMEZONE },
    end: { dateTime: params.endDateTime, timeZone: TIMEZONE },
    ...(params.suppressAttendees
      ? {}
      : { attendees: [attendee(params.clientName, params.clientEmail)] }),
    ...onlineMeetingFields(params.isOnlineMeeting),
  };
}

/**
 * The Graph recurrence object for a series.
 *
 * - weekly / bimonthly → `type: "weekly"`, interval 1 / 2, on the start date's weekday.
 * - monthly → `relativeMonthly` on the same weekday, at the start date's week-of-month
 *   (days 1–7 → "first" … 29–31 → "last", capped at index 4).
 */
export function buildRecurrence(
  params: Pick<RecurringEventParams, "startDateTime" | "recurrencePattern" | "seriesEndDate">,
): GraphRecurrence {
  const startDate = new Date(params.startDateTime);
  const dayOfWeek = graphDayOfWeek(startDate);
  const range = {
    type: "endDate" as const,
    startDate: saDateStr(startDate),
    endDate: params.seriesEndDate,
  };

  if (params.recurrencePattern === "weekly" || params.recurrencePattern === "bimonthly") {
    return {
      pattern: {
        type: "weekly",
        interval: params.recurrencePattern === "bimonthly" ? 2 : 1,
        daysOfWeek: [dayOfWeek],
      },
      range,
    };
  }

  const dayOfMonth = parseInt(formatInTimeZone(startDate, TIMEZONE, "d"), 10);
  const weekIndex = Math.min(Math.ceil(dayOfMonth / 7) - 1, 4);
  return {
    pattern: {
      type: "relativeMonthly",
      interval: 1,
      daysOfWeek: [dayOfWeek],
      index: GRAPH_WEEK_INDEX[weekIndex],
    },
    range,
  };
}

/** The request body for a recurring series (one Graph event for the whole series). */
export function buildRecurringEventPayload(params: RecurringEventParams): GraphEventBody {
  return {
    subject: params.subject,
    start: { dateTime: params.startDateTime, timeZone: TIMEZONE },
    end: { dateTime: params.endDateTime, timeZone: TIMEZONE },
    recurrence: buildRecurrence(params),
    attendees: [attendee(params.clientName, params.clientEmail)],
    ...onlineMeetingFields(params.isOnlineMeeting),
  };
}
