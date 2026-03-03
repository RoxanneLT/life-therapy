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
  const [paidInvoices, upcomingBookings] = await Promise.all([
    // Actual revenue from paid invoices
    prisma.invoice.groupBy({
      by: ["billingMonth"],
      where: {
        status: "paid",
        billingMonth: { startsWith: `${year}`, not: null },
      },
      _sum: { paidAmountCents: true },
    }),
    // Estimated revenue from upcoming uninvoiced bookings
    prisma.booking.findMany({
      where: {
        status: { in: ["pending", "confirmed"] },
        date: {
          gte: new Date(),
          lt: new Date(`${year + 1}-01-01`),
        },
        invoiceId: null,
        sessionType: { in: ["individual", "couples"] },
      },
      select: { date: true, sessionType: true },
    }),
  ]);

  const months: MonthlyRevenueData[] = MONTH_LABELS.map((m) => ({
    month: m,
    actual: 0,
    estimated: 0,
  }));

  // Map paid invoices by billingMonth ("YYYY-MM" → month index)
  for (const row of paidInvoices) {
    if (!row.billingMonth) continue;
    const monthIdx = parseInt(row.billingMonth.split("-")[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      months[monthIdx].actual = row._sum.paidAmountCents ?? 0;
    }
  }

  // Estimate revenue from upcoming bookings
  for (const b of upcomingBookings) {
    const idx = b.date.getUTCMonth();
    months[idx].estimated += SESSION_PRICE_CENTS[b.sessionType] ?? 0;
  }

  return months;
}
