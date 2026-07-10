import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCalendarDiagnostics } from "@/lib/graph";
import { formatInTimeZone } from "date-fns-tz";
import { saDateStr, saToday, saDayStart, saDayEnd, calendarDate } from "@/lib/dates";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const todaySast = saToday();
  const startStr = url.searchParams.get("start") || todaySast;
  // Default end = start + 7 days if not provided
  const endStr =
    url.searchParams.get("end") ||
    formatInTimeZone(calendarDate(startStr).getTime() + 7 * 86_400_000, "UTC", "yyyy-MM-dd");

  // SAST day boundaries → UTC instants for the Graph calendarView query
  const startUtc = saDayStart(startStr);
  const endUtc = saDayEnd(endStr);

  // Teams/Outlook side — identity + actual events on the connected mailbox
  const account = await getCalendarDiagnostics(startUtc, endUtc);

  // Portal side — confirmed/pending bookings from the DB for the same window
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["confirmed", "pending"] },
      date: {
        gte: calendarDate(startStr),
        lte: calendarDate(endStr),
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
    date: saDateStr(b.date),
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
