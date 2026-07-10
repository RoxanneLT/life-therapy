import { prisma } from "@/lib/prisma";
import { saToday, saMonthStart, saFormat, saDateStr, diffSaDays } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Helpers
//
// Every boundary below is a SAST month boundary (22:00 UTC on the last day of
// the previous month), because these ranges filter `paidAt` — a real instant,
// recorded at any hour. Built from local midnight they put a payment taken at
// 00:30 SAST into the previous month, and at the 1 March cutover into the
// previous financial year.
//
// Booking `date` is a `@db.Date` (UTC midnight) and is also correct under these
// bounds: UTC midnight of day D always falls inside
// [saDayStart(D), saDayStart(D+1)).
// ---------------------------------------------------------------------------

/** The SAST calendar month (1-based) that today falls in. */
function saCurrentYearMonth(): { year: number; month: number } {
  const [year, month] = saToday().split("-").map(Number);
  return { year, month };
}

/** SA financial year: FY2026 = 1 Mar 2025 – 28 Feb 2026 (end exclusive) */
function getFYRange(fyYear: number): { start: Date; end: Date } {
  return {
    start: saMonthStart(fyYear - 1, 3), // 1 March previous year
    end: saMonthStart(fyYear, 3), // 1 March FY year (exclusive)
  };
}

/** Returns the 12 month boundaries for an FY (Mar..Feb). */
function getFYMonths(fyYear: number): { label: string; start: Date; end: Date }[] {
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 0; i < 12; i++) {
    // Month 0 = March of (fyYear-1), month 11 = February of fyYear
    const start = saMonthStart(fyYear - 1, 3 + i);
    const end = saMonthStart(fyYear - 1, 4 + i);
    // Label in SAST: `start` is 22:00 UTC the day before, so formatting it in
    // the server's timezone would name the *previous* month.
    months.push({ label: saFormat(start, "MMM"), start, end });
  }
  return months;
}

function currentMonthRange(): { start: Date; end: Date } {
  const { year, month } = saCurrentYearMonth();
  return {
    start: saMonthStart(year, month),
    end: saMonthStart(year, month + 1),
  };
}

// ---------------------------------------------------------------------------
// 1. Financial queries
// ---------------------------------------------------------------------------

export async function getFinancialSummary(fyYear: number) {
  const { start, end } = getFYRange(fyYear);
  const { start: monthStart, end: monthEnd } = currentMonthRange();

  const [paidInvoices, thisMonthInvoices, pendingRequests] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "paid", paidAt: { gte: start, lt: end } },
      select: { totalCents: true },
    }),
    prisma.invoice.findMany({
      where: { status: "paid", paidAt: { gte: monthStart, lt: monthEnd } },
      select: { totalCents: true },
    }),
    prisma.paymentRequest.findMany({
      where: { status: "pending" },
      select: { totalCents: true },
    }),
  ]);

  const totalRevenueCents = paidInvoices.reduce((s, i) => s + i.totalCents, 0);
  const thisMonthRevenueCents = thisMonthInvoices.reduce((s, i) => s + i.totalCents, 0);
  const outstandingCents = pendingRequests.reduce((s, r) => s + r.totalCents, 0);
  const invoiceCount = paidInvoices.length;
  const avgInvoiceValueCents = invoiceCount > 0 ? Math.round(totalRevenueCents / invoiceCount) : 0;

  return {
    totalRevenueCents,
    thisMonthRevenueCents,
    outstandingCents,
    avgInvoiceValueCents,
    invoiceCount,
  };
}

export async function getRevenueBySource(fyYear: number) {
  const { start, end } = getFYRange(fyYear);

  const invoices = await prisma.invoice.findMany({
    where: { status: "paid", paidAt: { gte: start, lt: end } },
    select: { type: true, totalCents: true },
  });

  const map = new Map<string, number>();
  for (const inv of invoices) {
    map.set(inv.type, (map.get(inv.type) ?? 0) + inv.totalCents);
  }

  return Array.from(map.entries()).map(([source, amountCents]) => ({
    source,
    amountCents,
  }));
}

export async function getPaymentStatusByMonth(fyYear: number) {
  const months = getFYMonths(fyYear);

  const [invoices, requests] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: "paid",
        paidAt: { gte: months[0].start, lt: months[11].end },
      },
      select: { totalCents: true, paidAt: true },
    }),
    prisma.paymentRequest.findMany({
      where: {
        status: { in: ["pending", "overdue"] },
      },
      select: { totalCents: true, billingMonth: true, status: true },
    }),
  ]);

  return months.map(({ label, start, end }) => {
    const monthStr = saFormat(start, "yyyy-MM");

    const paid = invoices
      .filter((i) => i.paidAt && i.paidAt >= start && i.paidAt < end)
      .reduce((s, i) => s + i.totalCents, 0);

    const pending = requests
      .filter((r) => r.billingMonth === monthStr && r.status === "pending")
      .reduce((s, r) => s + r.totalCents, 0);

    const overdue = requests
      .filter((r) => r.billingMonth === monthStr && r.status === "overdue")
      .reduce((s, r) => s + r.totalCents, 0);

    return { month: label, paid, pending, overdue };
  });
}

export async function getOutstandingAging() {
  const now = new Date();

  const pending = await prisma.paymentRequest.findMany({
    where: { status: "pending" },
    select: { totalCents: true, dueDate: true },
  });

  const buckets: { bucket: string; amountCents: number; count: number }[] = [
    { bucket: "0-30 days", amountCents: 0, count: 0 },
    { bucket: "30-60 days", amountCents: 0, count: 0 },
    { bucket: "60-90 days", amountCents: 0, count: 0 },
    { bucket: "90+ days", amountCents: 0, count: 0 },
  ];

  for (const req of pending) {
    // dueDate is effectively a day, `now` is a moment: the ms-division answered
    // in UTC days, so an admin opening Reports between midnight and 02:00 SAST
    // saw every invoice a day younger — enough to shift a bucket boundary.
    const daysPast = Math.max(0, diffSaDays(req.dueDate, now));
    let idx: number;
    if (daysPast < 30) idx = 0;
    else if (daysPast < 60) idx = 1;
    else if (daysPast < 90) idx = 2;
    else idx = 3;
    buckets[idx].amountCents += req.totalCents;
    buckets[idx].count += 1;
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// 2. Session queries
// ---------------------------------------------------------------------------

export async function getSessionStats(_fyYear: number) {
  const { start: monthStart, end: monthEnd } = currentMonthRange();

  const [completed, _allBookings, cancelled, noShows] = await Promise.all([
    prisma.booking.count({
      where: {
        status: { in: ["completed", "confirmed"] },
        date: { gte: monthStart, lt: monthEnd },
      },
    }),
    prisma.booking.count({
      where: { date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.booking.count({
      where: {
        status: "cancelled",
        date: { gte: monthStart, lt: monthEnd },
      },
    }),
    prisma.booking.count({
      where: {
        status: "no_show",
        date: { gte: monthStart, lt: monthEnd },
      },
    }),
  ]);

  // Distinct clients this month with completed/confirmed sessions
  const distinctClients = await prisma.booking.findMany({
    where: {
      status: { in: ["completed", "confirmed"] },
      date: { gte: monthStart, lt: monthEnd },
    },
    select: { clientEmail: true },
    distinct: ["clientEmail"],
  });

  const sessionsThisMonth = completed;
  // Approximate available slots: 6 slots/day x 5 days/week x ~4 weeks
  const availableSlots = 6 * 5 * 4;
  const utilisationRate = availableSlots > 0 ? Math.round((sessionsThisMonth / availableSlots) * 100) : 0;
  const avgSessionsPerClient =
    distinctClients.length > 0 ? Math.round((sessionsThisMonth / distinctClients.length) * 10) / 10 : 0;
  const cancellationRate =
    (cancelled + noShows + completed) > 0
      ? Math.round(((cancelled + noShows) / (cancelled + noShows + completed)) * 100 * 10) / 10
      : 0;

  return {
    sessionsThisMonth,
    utilisationRate,
    avgSessionsPerClient,
    cancellationRate,
  };
}

export async function getTimeSlotHeatmap(fyYear: number) {
  const { start, end } = getFYRange(fyYear);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["completed", "confirmed"] },
      date: { gte: start, lt: end },
    },
    select: { date: true, startTime: true },
  });

  const map = new Map<string, number>();

  for (const b of bookings) {
    // JS getDay(): 0=Sun..6=Sat. We want 0=Mon..4=Fri.
    const jsDay = b.date.getDay();
    if (jsDay === 0 || jsDay === 6) continue; // skip weekends
    const day = jsDay - 1; // 0=Mon..4=Fri
    const key = `${day}|${b.startTime}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([key, count]) => {
    const [dayStr, slot] = key.split("|");
    return { day: Number(dayStr), slot, count };
  });
}

export async function getSessionTypeBreakdown(fyYear: number) {
  const { start, end } = getFYRange(fyYear);

  const bookings = await prisma.booking.groupBy({
    by: ["sessionType"],
    where: {
      status: { in: ["completed", "confirmed"] },
      date: { gte: start, lt: end },
    },
    _count: { id: true },
  });

  return bookings.map((b) => ({
    type: b.sessionType,
    count: b._count.id,
  }));
}

export async function getCancellationTrend(fyYear: number) {
  const months = getFYMonths(fyYear);

  // All bookings for total count (denominator), including future confirmed
  const allBookings = await prisma.booking.findMany({
    where: { date: { gte: months[0].start, lt: months[11].end } },
    select: { date: true, status: true },
  });

  return months.map(({ label, start, end }) => {
    const inMonth = allBookings.filter((b) => b.date >= start && b.date < end);
    const total = inMonth.length;
    const cancelled = inMonth.filter((b) => b.status === "cancelled").length;
    const noShow = inMonth.filter((b) => b.status === "no_show").length;
    const rate = total > 0 ? Math.round(((cancelled + noShow) / total) * 100 * 10) / 10 : 0;
    // Month is "past" if it has at least one completed/cancelled/no_show booking
    const hasPastData = inMonth.some((b) => ["completed", "cancelled", "no_show"].includes(b.status));
    return { month: label, total: hasPastData ? total : 0, cancelled, noShow, rate: hasPastData ? rate : 0 };
  });
}

// ---------------------------------------------------------------------------
// 3. Client queries
// ---------------------------------------------------------------------------

export async function getClientGrowth(fyYear: number) {
  const months = getFYMonths(fyYear);

  const students = await prisma.student.findMany({
    where: {
      clientStatus: { in: ["active", "potential"] },
      createdAt: { lt: months[11].end },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return months.map(({ label, start, end }) => {
    const newClients = students.filter((s) => s.createdAt >= start && s.createdAt < end).length;
    const total = students.filter((s) => s.createdAt < end).length;
    return { month: label, total, new: newClients };
  });
}

export async function getClientStatusDistribution() {
  const groups = await prisma.student.groupBy({
    by: ["clientStatus"],
    _count: { id: true },
  });

  return groups.map((g) => ({
    status: g.clientStatus,
    count: g._count.id,
  }));
}

export async function getAtRiskClients() {
  // (The 30-day cutoff is applied below via `daysSince`, not as a query bound.)

  // Active clients
  const activeClients = await prisma.student.findMany({
    where: { clientStatus: "active" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (activeClients.length === 0) return [];

  // Get last completed session per client
  const lastSessions = await prisma.booking.findMany({
    where: {
      studentId: { in: activeClients.map((c) => c.id) },
      status: { in: ["completed", "confirmed"] },
    },
    orderBy: { date: "desc" },
    select: { studentId: true, date: true },
  });

  // Build map: studentId -> most recent session date
  const lastSessionMap = new Map<string, Date>();
  for (const s of lastSessions) {
    if (s.studentId && !lastSessionMap.has(s.studentId)) {
      lastSessionMap.set(s.studentId, s.date);
    }
  }

  const now = new Date();
  const atRisk = activeClients
    .map((c) => {
      const lastDate = lastSessionMap.get(c.id);
      if (!lastDate) return null; // never had a session — skip
      // Calendar days, not 24-hour spans: a session late on day 0 and a check
      // early on day 30 is 30 days by the calendar but 29.x by ms-division.
      const daysSince = diffSaDays(lastDate, now);
      if (daysSince < 30) return null;
      return {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        lastSessionDate: saDateStr(lastDate),
        daysSince,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 20);

  return atRisk;
}

export async function getRetentionRate() {
  const { year, month } = saCurrentYearMonth();

  // Month M-1
  const prevMonthStart = saMonthStart(year, month - 1);
  const prevMonthEnd = saMonthStart(year, month);

  // Month M and M+1 combined
  const currentStart = saMonthStart(year, month);
  const nextMonthEnd = saMonthStart(year, month + 2);

  const [lastMonthClients, thisAndNextClients] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: ["completed", "confirmed"] },
        date: { gte: prevMonthStart, lt: prevMonthEnd },
        studentId: { not: null },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["completed", "confirmed", "pending"] },
        date: { gte: currentStart, lt: nextMonthEnd },
        studentId: { not: null },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
  ]);

  const lastMonthIds = new Set(lastMonthClients.map((b) => b.studentId));
  const currentIds = new Set(thisAndNextClients.map((b) => b.studentId));

  const activeLastMonth = lastMonthIds.size;
  let returningThisMonth = 0;
  for (const id of lastMonthIds) {
    if (id && currentIds.has(id)) returningThisMonth++;
  }

  const rate = activeLastMonth > 0 ? Math.round((returningThisMonth / activeLastMonth) * 100 * 10) / 10 : 0;

  return { rate, activeLastMonth, returningThisMonth };
}
