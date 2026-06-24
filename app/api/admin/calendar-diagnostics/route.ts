import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCalendarDiagnostics } from "@/lib/graph";
import { TIMEZONE } from "@/lib/booking-config";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const todaySast = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const startStr = url.searchParams.get("start") || todaySast;
  // Default end = start + 7 days if not provided
  const endStr =
    url.searchParams.get("end") ||
    formatInTimeZone(new Date(`${startStr}T00:00:00Z`).getTime() + 7 * 86_400_000, "UTC", "yyyy-MM-dd");

  // SAST day boundaries → UTC instants for the Graph calendarView query
  const startUtc = fromZonedTime(`${startStr}T00:00:00`, TIMEZONE);
  const endUtc = fromZonedTime(`${endStr}T23:59:59`, TIMEZONE);

  // Teams/Outlook side — identity + actual events on the connected mailbox
  const account = await getCalendarDiagnostics(startUtc, endUtc);

  // Portal side — confirmed/pending bookings from the DB for the same window
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["confirmed", "pending"] },
      date: {
        gte: new Date(`${startStr}T00:00:00Z`),
        lte: new Date(`${endStr}T00:00:00Z`),
      },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      clientName: true,
      status: true,
      graphEventId: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const portal = bookings.map((b) => ({
    bookingId: b.id,
    date: formatInTimeZone(new Date(b.date), TIMEZONE, "yyyy-MM-dd"),
    start: b.startTime,
    end: b.endTime,
    clientName: b.clientName,
    status: b.status,
    synced: !!b.graphEventId,
  }));

  return NextResponse.json({
    account,
    range: { start: startStr, end: endStr },
    portal,
    portalCount: portal.length,
    teamsCount: account.upcomingEvents?.length ?? 0,
  });
}
