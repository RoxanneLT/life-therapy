import { prisma } from "@/lib/prisma";

// Financial year runs March → February.
// "year N" means Mar N – Feb N+1.
const FY_MONTH_LABELS = [
  "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb",
];

// Convert UTC month (0 = Jan … 11 = Dec) → FY slot index (0 = Mar … 11 = Feb)
function fyIdx(utcMonth: number): number {
  return (utcMonth - 2 + 12) % 12;
}

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
  const fyStart = new Date(`${year}-03-01T00:00:00Z`);
  const fyEnd   = new Date(`${year + 1}-03-01T00:00:00Z`);

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: fyStart, lt: fyEnd },
      status: { in: ["pending", "confirmed", "completed"] },
    },
    select: { date: true, sessionType: true },
  });

  const months: MonthlyBookingData[] = FY_MONTH_LABELS.map((m) => ({
    month: m,
    individual: 0,
    couples: 0,
    freeConsultation: 0,
    total: 0,
  }));

  for (const b of bookings) {
    const idx = fyIdx(b.date.getUTCMonth());
    months[idx].total++;
    if (b.sessionType === "individual") months[idx].individual++;
    else if (b.sessionType === "couples") months[idx].couples++;
    else if (b.sessionType === "free_consultation") months[idx].freeConsultation++;
  }

  return months;
}

// ── Revenue per Month ───────────────────────────────────────

export async function getRevenueByMonth(year: number): Promise<MonthlyRevenueData[]> {
  const fyStart = new Date(`${year}-03-01T00:00:00Z`);
  const fyEnd   = new Date(`${year + 1}-03-01T00:00:00Z`);

  // Billing months spanning this FY: Mar–Dec of `year` plus Jan–Feb of `year+1`
  const billingMonthWhere = {
    OR: [
      { billingMonth: { gte: `${year}-03`, lte: `${year}-12` } },
      { billingMonth: { gte: `${year + 1}-01`, lte: `${year + 1}-02` } },
    ],
  };

  const [paidInvoices, pendingRequests, unbilledCompleted, upcomingBookings] = await Promise.all([
    // Actual revenue from paid invoices
    prisma.invoice.groupBy({
      by: ["billingMonth"],
      where: {
        status: "paid",
        OR: billingMonthWhere.OR,
      },
      _sum: { paidAmountCents: true },
    }),
    // Pending payment requests (billed but unpaid)
    prisma.paymentRequest.findMany({
      where: {
        status: "pending",
        OR: billingMonthWhere.OR,
      },
      select: { billingMonth: true, totalCents: true },
    }),
    // Completed sessions not yet invoiced (postpaid pool) — use actual price
    prisma.booking.findMany({
      where: {
        status: { in: ["completed", "no_show"] },
        date: { gte: fyStart, lt: fyEnd },
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
        date: { gte: new Date(), lt: fyEnd },
        invoiceId: null,
        sessionType: { in: ["individual", "couples"] },
      },
      select: { date: true, priceZarCents: true, sessionType: true },
    }),
  ]);

  const months: MonthlyRevenueData[] = FY_MONTH_LABELS.map((m) => ({
    month: m,
    actual: 0,
    requested: 0,
    estimated: 0,
  }));

  // Paid invoices → actual
  for (const row of paidInvoices) {
    if (!row.billingMonth) continue;
    const utcMonth = Number.parseInt(row.billingMonth.split("-")[1], 10) - 1; // 0-indexed
    const idx = fyIdx(utcMonth);
    if (idx >= 0 && idx < 12) months[idx].actual = row._sum.paidAmountCents ?? 0;
  }

  // Pending payment requests → requested
  for (const pr of pendingRequests) {
    if (!pr.billingMonth) continue;
    const utcMonth = Number.parseInt(pr.billingMonth.split("-")[1], 10) - 1;
    const idx = fyIdx(utcMonth);
    if (idx >= 0 && idx < 12) months[idx].requested += pr.totalCents;
  }

  // Completed unbilled → estimated (known amount, just not yet invoiced)
  for (const b of unbilledCompleted) {
    const idx = fyIdx(b.date.getUTCMonth());
    months[idx].estimated += b.priceZarCents ?? 0;
  }

  // Upcoming bookings → estimated
  for (const b of upcomingBookings) {
    const idx = fyIdx(b.date.getUTCMonth());
    months[idx].estimated += b.priceZarCents ?? SESSION_PRICE_CENTS[b.sessionType] ?? 0;
  }

  return months;
}
