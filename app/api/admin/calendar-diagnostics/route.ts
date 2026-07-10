import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCalendarDiagnostics } from "@/lib/graph";
import { saDateStr, saToday, saDayStart, saDayEnd, calendarDate, addSaDays, isSaDateStr } from "@/lib/dates";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const todaySast = saToday();

  // `start`/`end` are untrusted. Reject a malformed value outright rather than
  // letting it reach calendarDate() as an exception, or (worse, before the
  // guards existed) an Invalid Date that matched nothing.
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  for (const [name, value] of [["start", startParam], ["end", endParam]] as const) {
    if (value !== null && !isSaDateStr(value)) {
      return NextResponse.json(
        { error: `Invalid "${name}" — expected a YYYY-MM-DD date.` },
        { status: 400 },
      );
    }
  }

  const startStr = startParam ?? todaySast;
  const endStr = endParam ?? addSaDays(startStr, 7); // default window: 7 days

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
