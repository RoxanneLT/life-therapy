import { ClientSecretCredential } from "@azure/identity";
import {
  Client,
  type AuthenticationProvider,
} from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { TIMEZONE } from "@/lib/booking-config";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { logCalendarOp } from "@/lib/calendar-sync-log";

// ────────────────────────────────────────────────────────────
// Config & client
// ────────────────────────────────────────────────────────────

interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userEmail: string;
}

export function getGraphConfig(): GraphConfig | null {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const userEmail = process.env.MS_GRAPH_USER_EMAIL;

  if (!tenantId || !clientId || !clientSecret || !userEmail) return null;

  return { tenantId, clientId, clientSecret, userEmail };
}

export function createGraphClient(config: GraphConfig): Client {
  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret
  );
  const authProvider: AuthenticationProvider =
    new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"],
    });
  return Client.initWithMiddleware({ authProvider });
}

// ────────────────────────────────────────────────────────────
// Retry helper for transient Graph API failures
// ────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { statusCode?: number }).statusCode;
      const retryable = status === 429 || status === 503 || status === 504;

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      // Respect Retry-After header if present, otherwise exponential backoff
      const retryAfter = (error as { headers?: { get?: (k: string) => string } }).headers?.get?.("Retry-After");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 8000);

      console.warn(
        `[Graph] ${label} attempt ${attempt + 1} failed (${status}), retrying in ${delayMs}ms`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// ────────────────────────────────────────────────────────────
// Free/busy
// ────────────────────────────────────────────────────────────

export async function getFreeBusy(
  startDate: Date,
  endDate: Date
): Promise<{ slots: { start: string; end: string }[]; failed: boolean }> {
  const config = getGraphConfig();
  if (!config) return { slots: [], failed: true };

  try {
    const client = createGraphClient(config);

    // Format as local SAST datetime (no Z suffix) so Graph interprets correctly
    const startLocal = formatInTimeZone(startDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    const endLocal = formatInTimeZone(endDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");

    const response = await withRetry(
      () =>
        client
          .api(`/users/${config.userEmail}/calendar/getSchedule`)
          .post({
            schedules: [config.userEmail],
            startTime: { dateTime: startLocal, timeZone: TIMEZONE },
            endTime: { dateTime: endLocal, timeZone: TIMEZONE },
            availabilityViewInterval: 15,
          }),
      "getFreeBusy",
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedule = (response as any).value?.[0];
    if (!schedule?.scheduleItems) return { slots: [], failed: false };

    const slots = schedule.scheduleItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.status !== "free")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        const startDt = item.start.dateTime as string;
        const startTz = (item.start.timeZone as string) || "UTC";
        const endDt = item.end.dateTime as string;
        const endTz = (item.end.timeZone as string) || "UTC";

        const startSast = formatInTimeZone(
          startTz === "UTC" ? new Date(startDt + "Z") : new Date(startDt),
          TIMEZONE,
          "HH:mm"
        );
        const endSast = formatInTimeZone(
          endTz === "UTC" ? new Date(endDt + "Z") : new Date(endDt),
          TIMEZONE,
          "HH:mm"
        );

        return { start: startSast, end: endSast };
      });
    return { slots, failed: false };
  } catch (error) {
    console.error("[Graph] getFreeBusy error:", error);
    return { slots: [], failed: true };
  }
}

// ────────────────────────────────────────────────────────────
// Create single calendar event
// ────────────────────────────────────────────────────────────

export async function createCalendarEvent(params: {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  clientName: string;
  clientEmail: string;
  description?: string;
  isOnlineMeeting?: boolean;
  /** When true, omit the client attendee so Outlook does not email a meeting invite.
   *  Used by reconciliation auto-fix — the client already has their original invite. */
  suppressAttendees?: boolean;
  /** Optional booking ID for audit-log correlation. */
  bookingId?: string;
}): Promise<{ eventId: string; teamsMeetingUrl: string } | null> {
  const config = getGraphConfig();
  if (!config) return null;

  try {
    const client = createGraphClient(config);

    const event = await withRetry(
      () =>
        client
          .api(`/users/${config.userEmail}/events`)
          .post({
            subject: params.subject,
            body: {
              contentType: "HTML",
              content: params.description || "",
            },
            start: { dateTime: params.startDateTime, timeZone: TIMEZONE },
            end: { dateTime: params.endDateTime, timeZone: TIMEZONE },
            ...(params.suppressAttendees
              ? {}
              : {
                  attendees: [
                    {
                      emailAddress: {
                        address: params.clientEmail,
                        name: params.clientName,
                      },
                      type: "required",
                    },
                  ],
                }),
            ...(params.isOnlineMeeting !== false && {
              isOnlineMeeting: true,
              onlineMeetingProvider: "teamsForBusiness",
            }),
          }),
      "createCalendarEvent",
    );

    await logCalendarOp({
      bookingId: params.bookingId,
      operation: "create",
      status: event.id ? "success" : "failed",
      graphEventId: event.id,
      metadata: { subject: params.subject, start: params.startDateTime },
    });

    return {
      eventId: event.id ?? "",
      teamsMeetingUrl: event.onlineMeeting?.joinUrl ?? "",
    };
  } catch (error) {
    console.error("[Graph] createCalendarEvent error:", error);
    await logCalendarOp({
      bookingId: params.bookingId,
      operation: "create",
      status: "failed",
      errorMessage: String(error),
      metadata: { subject: params.subject, start: params.startDateTime },
    });
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Create recurring calendar event
// ────────────────────────────────────────────────────────────

const GRAPH_DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const GRAPH_WEEK_INDEX = ["first", "second", "third", "fourth", "last"] as const;

export async function createRecurringCalendarEvent(params: {
  subject: string;
  startDateTime: string;       // first occurrence: "2026-04-21T09:00:00"
  endDateTime: string;         // first occurrence end: "2026-04-21T10:00:00"
  clientName: string;
  clientEmail: string;
  recurrencePattern: "weekly" | "bimonthly" | "monthly";
  seriesEndDate: string;       // last occurrence date: "2026-09-08"
  isOnlineMeeting?: boolean;
}): Promise<{ seriesEventId: string; teamsMeetingUrl: string } | null> {
  const config = getGraphConfig();
  if (!config) return null;

  try {
    const client = createGraphClient(config);

    // Use formatInTimeZone to get the correct day-of-week in SAST,
    // not the system timezone (which differs on Vercel vs dev machine)
    const startDate = new Date(params.startDateTime);
    const dayIndexSast = parseInt(
      formatInTimeZone(startDate, TIMEZONE, "e"), // 1=Monday, 7=Sunday (ISO)
      10,
    );
    // Convert ISO day index to JS getDay() style (0=Sunday, 6=Saturday)
    const jsDayIndex = dayIndexSast === 7 ? 0 : dayIndexSast;
    const dayOfWeek = GRAPH_DAY_NAMES[jsDayIndex];

    const startDateStr = formatInTimeZone(startDate, TIMEZONE, "yyyy-MM-dd");

    // Compute the week-of-month index in SAST
    const dayOfMonth = parseInt(formatInTimeZone(startDate, TIMEZONE, "d"), 10);
    const weekIndex = Math.min(Math.ceil(dayOfMonth / 7) - 1, 4); // 0-4

    // Build the recurrence object based on pattern
    let recurrence: Record<string, unknown>;

    if (params.recurrencePattern === "weekly" || params.recurrencePattern === "bimonthly") {
      recurrence = {
        pattern: {
          type: "weekly",
          interval: params.recurrencePattern === "bimonthly" ? 2 : 1,
          daysOfWeek: [dayOfWeek],
        },
        range: {
          type: "endDate",
          startDate: startDateStr,
          endDate: params.seriesEndDate,
        },
      };
    } else {
      // monthly — use "relativeMonthly" (nth weekday of month)
      recurrence = {
        pattern: {
          type: "relativeMonthly",
          interval: 1,
          daysOfWeek: [dayOfWeek],
          index: GRAPH_WEEK_INDEX[weekIndex],
        },
        range: {
          type: "endDate",
          startDate: startDateStr,
          endDate: params.seriesEndDate,
        },
      };
    }

    const event = await withRetry(
      () =>
        client
          .api(`/users/${config.userEmail}/events`)
          .post({
            subject: params.subject,
            start: { dateTime: params.startDateTime, timeZone: TIMEZONE },
            end: { dateTime: params.endDateTime, timeZone: TIMEZONE },
            recurrence,
            attendees: [
              {
                emailAddress: {
                  address: params.clientEmail,
                  name: params.clientName,
                },
                type: "required",
              },
            ],
            ...(params.isOnlineMeeting !== false && {
              isOnlineMeeting: true,
              onlineMeetingProvider: "teamsForBusiness",
            }),
          }),
      "createRecurringCalendarEvent",
    );

    await logCalendarOp({
      operation: "create",
      status: event.id ? "success" : "failed",
      graphEventId: event.id,
      metadata: { subject: params.subject, start: params.startDateTime, recurring: true },
    });

    return {
      seriesEventId: event.id ?? "",
      teamsMeetingUrl: event.onlineMeeting?.joinUrl ?? "",
    };
  } catch (error) {
    console.error("[Graph] createRecurringCalendarEvent error:", error);
    await logCalendarOp({
      operation: "create",
      status: "failed",
      errorMessage: String(error),
      metadata: { subject: params.subject, start: params.startDateTime, recurring: true },
    });
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Delete specific occurrences from a recurring event
// ────────────────────────────────────────────────────────────

export async function deleteRecurringEventOccurrences(
  seriesEventId: string,
  datesToDelete: string[], // ["2026-05-01", "2026-06-16", ...]
): Promise<{ deleted: string[]; failed: string[] }> {
  const result = { deleted: [] as string[], failed: [] as string[] };
  if (datesToDelete.length === 0) return result;

  const config = getGraphConfig();
  if (!config) return result;

  try {
    const client = createGraphClient(config);

    // Sort dates to get the range
    const sorted = [...datesToDelete].sort();
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];

    // Build the window in UTC (.toISOString ends in "Z"). A literal "+02:00"
    // offset decodes to a space in the query string ("...T00:00:00 02:00") and
    // Graph rejects it as an invalid StartDateTime — silently failing the delete.
    const windowStart = fromZonedTime(`${earliest}T00:00:00`, TIMEZONE).toISOString();
    const windowEnd = fromZonedTime(`${latest}T23:59:59`, TIMEZONE).toISOString();
    const instances = await withRetry(
      () =>
        client
          .api(`/users/${config.userEmail}/events/${seriesEventId}/instances`)
          .query({
            startDateTime: windowStart,
            endDateTime: windowEnd,
            $select: "id,start",
            $top: 200,
          })
          .header("Prefer", `outlook.timezone="${TIMEZONE}"`)
          .get(),
      "deleteRecurringEventOccurrences:list",
    );

    const deleteSet = new Set(datesToDelete);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const instance of (instances.value || []) as any[]) {
      // Extract date in SAST (Graph returns in requested timezone via Prefer header)
      const instanceDate = (instance.start?.dateTime as string)?.split("T")[0];
      if (!instanceDate || !deleteSet.has(instanceDate)) continue;

      try {
        await withRetry(
          () =>
            client
              .api(`/users/${config.userEmail}/events/${instance.id}`)
              .delete(),
          `deleteOccurrence:${instanceDate}`,
          1, // fewer retries for individual deletions
        );
        result.deleted.push(instanceDate);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404) {
          // Already deleted — treat as success
          result.deleted.push(instanceDate);
        } else {
          console.error(`[Graph] Failed to delete occurrence ${instanceDate}:`, error);
          result.failed.push(instanceDate);
        }
      }
    }

    await logCalendarOp({
      operation: "delete_occurrence",
      status: result.failed.length > 0 ? "partial" : "success",
      graphEventId: seriesEventId,
      metadata: { deleted: result.deleted, failed: result.failed },
    });

    return result;
  } catch (error) {
    console.error("[Graph] deleteRecurringEventOccurrences error:", error);
    await logCalendarOp({
      operation: "delete_occurrence",
      status: "failed",
      graphEventId: seriesEventId,
      errorMessage: String(error),
      metadata: { requested: datesToDelete },
    });
    return result;
  }
}

// ────────────────────────────────────────────────────────────
// Cancel (delete) a single calendar event
// ────────────────────────────────────────────────────────────

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  const config = getGraphConfig();
  if (!config) return;

  try {
    const client = createGraphClient(config);
    await withRetry(
      () =>
        client
          .api(`/users/${config.userEmail}/events/${eventId}`)
          .delete(),
      "cancelCalendarEvent",
    );
    await logCalendarOp({
      operation: "delete",
      status: "success",
      graphEventId: eventId,
    });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404) {
      // Event already deleted — not an error
      console.info(`[Graph] Event ${eventId} already deleted (404)`);
      await logCalendarOp({
        operation: "delete",
        status: "success",
        graphEventId: eventId,
        metadata: { note: "already deleted (404)" },
      });
      return;
    }
    console.error("[Graph] cancelCalendarEvent error:", error);
    await logCalendarOp({
      operation: "delete",
      status: "failed",
      graphEventId: eventId,
      errorMessage: String(error),
    });
    // Rethrow so callers can set calendarWarning
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// Test connection
// ────────────────────────────────────────────────────────────

export async function testGraphConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const config = getGraphConfig();
  if (!config) {
    return { success: false, error: "Microsoft Graph credentials not configured" };
  }

  try {
    const client = createGraphClient(config);
    await client.api(`/users/${config.userEmail}`).select("displayName").get();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
