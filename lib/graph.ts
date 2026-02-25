import { ClientSecretCredential } from "@azure/identity";
import {
  Client,
  type AuthenticationProvider,
} from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { TIMEZONE } from "@/lib/booking-config";

interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userEmail: string;
}

function getGraphConfig(): GraphConfig | null {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const userEmail = process.env.MS_GRAPH_USER_EMAIL;

  if (!tenantId || !clientId || !clientSecret || !userEmail) return null;

  return { tenantId, clientId, clientSecret, userEmail };
}

function createGraphClient(config: GraphConfig): Client {
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

export async function getFreeBusy(
  startDate: Date,
  endDate: Date
): Promise<{ start: string; end: string }[]> {
  const config = getGraphConfig();
  if (!config) return [];

  try {
    const client = createGraphClient(config);

    const response = await client
      .api(`/users/${config.userEmail}/calendar/getSchedule`)
      .post({
        schedules: [config.userEmail],
        startTime: {
          dateTime: startDate.toISOString(),
          timeZone: TIMEZONE,
        },
        endTime: {
          dateTime: endDate.toISOString(),
          timeZone: TIMEZONE,
        },
        availabilityViewInterval: 15,
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedule = (response as any).value?.[0];
    if (!schedule?.scheduleItems) return [];

    return schedule.scheduleItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.status !== "free")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        start: item.start.dateTime as string,
        end: item.end.dateTime as string,
      }));
  } catch (error) {
    console.error("Graph API getFreeBusy error:", error);
    return [];
  }
}

export async function createCalendarEvent(params: {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  clientName: string;
  clientEmail: string;
  description?: string;
}): Promise<{ eventId: string; teamsMeetingUrl: string } | null> {
  const config = getGraphConfig();
  if (!config) return null;

  try {
    const client = createGraphClient(config);

    const event = await client
      .api(`/users/${config.userEmail}/events`)
      .post({
        subject: params.subject,
        body: {
          contentType: "HTML",
          content: params.description || "",
        },
        start: { dateTime: params.startDateTime, timeZone: TIMEZONE },
        end: { dateTime: params.endDateTime, timeZone: TIMEZONE },
        attendees: [
          {
            emailAddress: {
              address: params.clientEmail,
              name: params.clientName,
            },
            type: "required",
          },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      });

    return {
      eventId: event.id ?? "",
      teamsMeetingUrl: event.onlineMeeting?.joinUrl ?? "",
    };
  } catch (error) {
    console.error("Graph API createCalendarEvent error:", error);
    return null;
  }
}

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  const config = getGraphConfig();
  if (!config) return;

  try {
    const client = createGraphClient(config);
    await client
      .api(`/users/${config.userEmail}/events/${eventId}`)
      .delete();
  } catch (error) {
    console.error("Graph API cancelCalendarEvent error:", error);
  }
}

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
