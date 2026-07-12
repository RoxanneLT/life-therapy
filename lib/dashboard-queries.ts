import { prisma } from "@/lib/prisma";
import { calendarDate, saDayStart, saDateStr } from "@/lib/dates";

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

/**
 * The three revenue series answer three DIFFERENT questions. Conflating them is
 * how a chart starts lying, so they are defined here once:
 *
 *   actual    — cash RECEIVED in this month (bucketed by `paidAt`). Includes
 *               every paid invoice: sessions, course sales, product sales,
 *               manual invoices, late-cancel fees.
 *   requested — billed FOR this period but not yet paid (bucketed by
 *               `billingMonth`). A period, not a payment.
 *   estimated — not yet billed at all: completed-but-uninvoiced sessions, plus
 *               future bookings (bucketed by session date).
 *
 * All three are ZAR-only — see the queries below.
 */
export type MonthlyRevenueData = {
  month: string;
  actual: number;
  requested: number;
  estimated: number;
};

// ── Bookings per Month ──────────────────────────────────────

export async function getBookingsByMonth(year: number): Promise<MonthlyBookingData[]> {
  const fyStart = calendarDate(`${year}-03-01`);
  const fyEnd   = calendarDate(`${year + 1}-03-01`);

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
  const fyStart = calendarDate(`${year}-03-01`);
  const fyEnd   = calendarDate(`${year + 1}-03-01`);

  // Billing months spanning this FY: Mar of `year` → Feb of `year+1`.
  //
  // A HALF-OPEN range, not `lte`. billingMonth keys carry suffixes
  // ("2026-12-adhoc-1", "2027-02-USD-manual-1"), and `lte: "2026-12"` excludes
  // every one of them lexically — a longer string with the same prefix sorts
  // AFTER it. That silently dropped every December and February ad-hoc, manual
  // and foreign-currency row from the chart. `lt: "2027-03"` keeps them:
  // "2026-12-adhoc-1" < "2027-03" is true.
  const billingMonthWhere = {
    billingMonth: { gte: `${year}-03`, lt: `${year + 1}-03` },
  };

  const [paidInvoices, pendingRequests, unbilledCompleted, upcomingBookings] = await Promise.all([
    // ACTUAL revenue = cash received, so bucket by `paidAt`, not `billingMonth`.
    // Only the payment-request path populates `billingMonth`, so the old query
    // silently omitted every course sale, product sale and manual invoice from
    // the "actual" bars — and a June request paid in July appeared in neither
    // month. This is the same definition the dashboard tile now uses; when the
    // tile and the chart on one page disagree, at least one of them is lying.
    //
    // ZAR ONLY: a single Rand-denominated bar series. Adding USD cents to a Rand
    // bar plots a fabricated number. International revenue needs its own series.
    prisma.invoice.findMany({
      where: {
        status: "paid",
        currency: "ZAR",
        paidAt: { gte: saDayStart(`${year}-03-01`), lt: saDayStart(`${year + 1}-03-01`) },
      },
      select: { paidAt: true, paidAmountCents: true, totalCents: true },
    }),
    // Pending payment requests (billed but unpaid) — ZAR only, same reason.
    prisma.paymentRequest.findMany({
      where: { status: "pending", currency: "ZAR", ...billingMonthWhere },
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
        // ZAR only — `priceZarCents` is misnamed and holds cents in the booking's
        // OWN currency, so summing across currencies fabricates the bar.
        priceCurrency: "ZAR",
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
        priceCurrency: "ZAR", // same: never mix currencies into one bar
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

  // Paid invoices → actual, bucketed by the SAST day the money landed.
  //
  // `paidAt` is a real instant: resolve it through SAST before taking its month,
  // or a payment at 00:30 SAST on 1 July is booked to June (the UTC day is still
  // 30 June until 22:00 UTC). Accumulate — several invoices land in one month.
  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue;
    const saMonth = Number.parseInt(saDateStr(inv.paidAt).split("-")[1], 10) - 1; // 0-indexed
    const idx = fyIdx(saMonth);
    if (idx >= 0 && idx < 12) months[idx].actual += inv.paidAmountCents ?? inv.totalCents;
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
