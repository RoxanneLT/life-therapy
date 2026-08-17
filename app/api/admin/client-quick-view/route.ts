import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { calendarDate, saToday } from "@/lib/dates";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      clientStatus: true,
      billingType: true,
      creditBalance: { select: { balance: true } },
    },
  });

  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // `setHours(0,0,0,0)` is LOCAL midnight — UTC on Vercel, SAST on a dev box. It
  // happened to line up with the UTC-midnight `@db.Date` in production and was two
  // hours out everywhere else, which is the worst kind of correct. The day the
  // booking falls on is the question, so ask lib/dates.ts for it.
  const todayStart = calendarDate(saToday());

  const [nextBooking, lastBooking] = await Promise.all([
    prisma.booking.findFirst({
      where: { studentId: id, status: { in: ["confirmed", "pending"] }, date: { gte: todayStart } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: { date: true, startTime: true },
    }),
    prisma.booking.findFirst({
      where: { studentId: id, status: "completed" },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  return NextResponse.json({
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    clientStatus: student.clientStatus,
    billingType: student.billingType,
    creditBalance: student.creditBalance?.balance ?? 0,
    nextSession: nextBooking ? format(new Date(nextBooking.date), "d MMM") + " " + nextBooking.startTime : null,
    lastSession: lastBooking ? format(new Date(lastBooking.date), "d MMM yyyy") : null,
  });
}
