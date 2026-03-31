import { prisma } from "@/lib/prisma";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SESSION_PRICE_CENTS: Record<string, number> = {
  individual: 85000,
  couples: 120000,
  free_consultation: 0,
};

// ── Types ────────────────────────────────────────────────────

export type MonthlyBookingData = {
  month: string;
  individual: number;
  couples: number;
  freeConsultation: number;
  total: number;
};

export type MonthlyRevenueData = {
  month: string;
  actual: number;
  requested: number;
  estimated: number;
};

// ── Bookings per Month ──────────────────────────────────────

export async function getBookingsByMonth(year: number): Promise<MonthlyBookingData[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
      status: { in: ["pending", "confirmed", "completed"] },
    },
    select: { date: true, sessionType: true },
  });

  const months: MonthlyBookingData[] = MONTH_LABELS.map((m) => ({
    month: m,
    individual: 0,
    couples: 0,
    freeConsultation: 0,
    total: 0,
  }));

  for (const b of bookings) {
    const idx = b.date.getUTCMonth();
    months[idx].total++;
    if (b.sessionType === "individual") months[idx].individual++;
    else if (b.sessionType === "couples") months[idx].couples++;
    else if (b.sessionType === "free_consultation") months[idx].freeConsultation++;
  }

  return months;
}

// ── Revenue per Month ───────────────────────────────────────

export async function getRevenueByMonth(year: number): Promise<MonthlyRevenueData[]> {
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd   = new Date(`${year + 1}-01-01`);

  const [paidInvoices, pendingRequests, unbilledCompleted, upcomingBookings] = await Promise.all([
    // Actual revenue from paid invoices
    prisma.invoice.groupBy({
      by: ["billingMonth"],
      where: {
        status: "paid",
        billingMonth: { startsWith: `${year}`, not: null },
      },
      _sum: { paidAmountCents: true },
    }),
    // Pending payment requests (billed but unpaid)
    prisma.paymentRequest.findMany({
      where: {
        status: "pending",
        billingMonth: { startsWith: `${year}` },
      },
      select: { billingMonth: true, totalCents: true },
    }),
    // Completed sessions not yet invoiced (postpaid pool) — use actual price
    prisma.booking.findMany({
      where: {
        status: { in: ["completed", "no_show"] },
        date: { gte: yearStart, lt: yearEnd },
        invoiceId: null,
        paymentRequestId: null,
        sessionType: { in: ["individual", "couples"] },
      },
      select: { date: true, priceZarCents: true },
    }),
    // Future bookings not yet invoiced — estimated
    prisma.booking.findMany({
      where: {
        status: { in: ["pending", "confirmed"] },
        date: { gte: new Date(), lt: yearEnd },
        invoiceId: null,
        sessionType: { in: ["individual", "couples"] },
      },
      select: { date: true, priceZarCents: true, sessionType: true },
    }),
  ]);

  const months: MonthlyRevenueData[] = MONTH_LABELS.map((m) => ({
    month: m,
    actual: 0,
    requested: 0,
    estimated: 0,
  }));

  // Paid invoices → actual
  for (const row of paidInvoices) {
    if (!row.billingMonth) continue;
    const idx = Number.parseInt(row.billingMonth.split("-")[1], 10) - 1;
    if (idx >= 0 && idx < 12) months[idx].actual = row._sum.paidAmountCents ?? 0;
  }

  // Pending payment requests → requested
  for (const pr of pendingRequests) {
    if (!pr.billingMonth) continue;
    const idx = Number.parseInt(pr.billingMonth.split("-")[1], 10) - 1;
    if (idx >= 0 && idx < 12) months[idx].requested += pr.totalCents;
  }

  // Completed unbilled → estimated (known amount, just not yet invoiced)
  for (const b of unbilledCompleted) {
    const idx = b.date.getUTCMonth();
    months[idx].estimated += b.priceZarCents ?? 0;
  }

  // Upcoming bookings → estimated
  for (const b of upcomingBookings) {
    const idx = b.date.getUTCMonth();
    months[idx].estimated += b.priceZarCents ?? SESSION_PRICE_CENTS[b.sessionType] ?? 0;
  }

  return months;
}
