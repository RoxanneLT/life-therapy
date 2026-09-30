/**
 * Monthly postpaid billing — generate payment requests for all postpaid clients.
 *
 * Flow:
 *   1. Get all postpaid students
 *   2. Group by billing contact (self, individual payer, or corporate)
 *   3. For each group: gather unbilled bookings, build line items,
 *      apply standing discounts, calculate totals, create PaymentRequest
 *
 * ONE INVOICE PER MONTH (student.billFullMonth, 2026-09-30). The run happens on the last
 * business day, so a session later that day, or after it, used to roll into next month's
 * invoice. Clients who want one invoice got two, and the workaround — marking tomorrow's
 * session completed so it was billed — cost the client their reminder and, once, the calendar
 * event. For these clients the run also bills CONFIRMED sessions up to the calendar month end,
 * shown "(scheduled)", and the request's period ends on the month end. Billing still goes out
 * before month end, which is the point: cashflow.
 *
 * A billed session that later changes is settled on the next request, never by editing the
 * one the client already has:
 *   • moved past the period it was billed in → an R0 line, "rescheduled — already billed"
 *     (derived: its date is after its own request's periodEnd, and inside this run's window);
 *   • cancelled in time → a credit. A line total cannot be negative, so the credit is the
 *     request's discount, explained by an R0 line, and the booking is stamped
 *     creditedOnPaymentRequestId so it is credited once. Credits never take a request below
 *     zero; one that does not fit waits for the next request.
 * Late cancels and no-shows stay billed, as the policy says. None of this depends on
 * billFullMonth: a completed session billed and then moved (2026-10-01) is the same case.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, type Booking, type Student } from "@/lib/generated/prisma/client";
import { getSiteSettings } from "@/lib/settings";
import {
  resolveBillingContact,
  calculateInvoiceTotals,
  vatApplies,
  getBillingPeriod,
  calculateDueDate,
  type BillingContact,
} from "@/lib/billing";
import { parseLineItems, readLineItems, type InvoiceLineItem } from "@/lib/billing-types";
import { format } from "date-fns";
import { addSaDays, calendarDate, saDateStr, saFormat, saMonthStart } from "@/lib/dates";
import { planCredits, type PendingCredit } from "@/lib/billing-credits";
import { formatPrice } from "@/lib/utils";

// ─── Unbilled bookings query ─────────────────────────────────

/**
 * Get completed bookings for a student within a billing period
 * that aren't already linked to a payment request or invoice.
 */
export async function getUnbilledBookings(
  studentId: string,
  periodEnd: Date,
  /** One-invoice-per-month clients: also bill confirmed sessions up to this day (month end). */
  prebillUntil?: Date,
): Promise<Booking[]> {
  return prisma.booking.findMany({
    where: {
      studentId,
      OR: [
        { status: { in: ["completed", "no_show"] } },
        { status: "cancelled", isLateCancel: true },
        ...(prebillUntil ? [{ status: "confirmed" as const }] : []),
      ],
      // No lower-bound on date — paymentRequestId: null already prevents double-billing,
      // and removing gte means sessions that were completed after the previous billing run
      // (e.g. on the last day of the prior month) are caught in the next cycle.
      date: { lte: prebillUntil ?? periodEnd },
      paymentRequestId: null,
      invoiceId: null,
    },
    orderBy: { date: "asc" },
  });
}

type CarriedBooking = Booking & { paymentRequest: { billingMonth: string; periodEnd: Date } | null };

/** Billed sessions since moved past the period they were billed in, dated inside this window. */
async function getCarriedOverBookings(studentId: string, from: Date, to: Date): Promise<CarriedBooking[]> {
  const rows = await prisma.booking.findMany({
    where: {
      studentId,
      status: { not: "cancelled" },
      paymentRequestId: { not: null },
      date: { gte: from, lte: to },
    },
    include: { paymentRequest: { select: { billingMonth: true, periodEnd: true, status: true } } },
    orderBy: { date: "asc" },
  });
  return rows.filter(
    (b) => b.paymentRequest && b.paymentRequest.status !== "cancelled" && b.date > b.paymentRequest.periodEnd,
  );
}

type CreditBooking = PendingCredit & { booking: Booking };

/** Billed sessions cancelled in time and not yet credited, with what each was charged. */
async function getPendingCredits(studentId: string): Promise<CreditBooking[]> {
  const rows = await prisma.booking.findMany({
    where: {
      studentId,
      status: "cancelled",
      isLateCancel: false,
      paymentRequestId: { not: null },
      creditedOnPaymentRequestId: null,
    },
    include: { paymentRequest: { select: { status: true, lineItems: true, billingMonth: true, currency: true } } },
    orderBy: { date: "asc" },
  });
  const credits: CreditBooking[] = [];
  for (const b of rows) {
    const pr = b.paymentRequest;
    if (!pr || pr.status === "cancelled") continue; // a voided request charged nothing
    const line = readLineItems(pr.lineItems)?.find((li) => li.bookingId === b.id);
    if (!line || line.totalCents <= 0) continue;
    credits.push({ bookingId: b.id, amountCents: line.totalCents, currency: pr.currency, billedIn: pr.billingMonth, booking: b });
  }
  return credits;
}

/** "2026-09" or "2026-09-USD" → "September 2026". */
function monthLabel(billingMonth: string): string {
  return saFormat(calendarDate(`${billingMonth.slice(0, 7)}-01`), "MMMM yyyy");
}

function sessionSubLine(booking: Booking, studentName: string): string {
  const dateStr = format(new Date(booking.date), "d MMM yyyy");
  return `${dateStr}, ${booking.startTime}–${booking.endTime} — ${studentName}`;
}

/** An explanatory R0 line — it carries no bookingId, so nothing treats it as billing a session. */
function noteLine(description: string, subLine: string): InvoiceLineItem {
  return { description, subLine, quantity: 1, unitPriceCents: 0, discountCents: 0, discountPercent: 0, totalCents: 0 };
}

// ─── Line item builder ───────────────────────────────────────

function buildLineItemFromBooking(
  booking: Booking,
  rateCents: number,
  student: { firstName: string; lastName: string },
  standingDiscountPercent: number | null,
  standingDiscountFixed: number | null,
): InvoiceLineItem {
  const sessionLabel =
    booking.sessionType === "couples"
      ? "Couples Session"
      : booking.sessionType === "free_consultation"
        ? "Free Consultation"
        : "Individual Session";

  const dateStr = format(new Date(booking.date), "d MMM yyyy");
  const studentName = `${student.firstName} ${student.lastName}`;
  const attendeeName =
    booking.sessionType === "couples" && booking.couplesPartnerName
      ? `${studentName} & ${booking.couplesPartnerName}`
      : studentName;
  const subLine = `${dateStr}, ${booking.startTime}–${booking.endTime} — ${attendeeName}${booking.status === "confirmed" ? " (scheduled)" : ""}`;
  // "(scheduled)": billed ahead for a one-invoice-per-month client; it has not happened yet.

  // Calculate discount
  let discountPercent = 0;
  let discountCents = 0;
  if (standingDiscountPercent && standingDiscountPercent > 0) {
    discountPercent = standingDiscountPercent;
    discountCents = Math.round((rateCents * standingDiscountPercent) / 100);
  }
  if (standingDiscountFixed && standingDiscountFixed > discountCents) {
    discountCents = standingDiscountFixed;
    discountPercent = 0; // fixed takes precedence if larger
  }

  const totalCents = Math.max(0, rateCents - discountCents);

  return {
    description: sessionLabel,
    subLine,
    quantity: 1,
    unitPriceCents: rateCents,
    discountCents,
    discountPercent,
    totalCents,
    bookingId: booking.id,
    attendeeName,
    billingNote: booking.billingNote ?? undefined,
  };
}

// ─── Main generator ──────────────────────────────────────────

interface GroupEntry {
  student: Student;
  /** Charged on this request. */
  bookings: Booking[];
  /** Billed earlier, since moved into this period — an R0 line each. */
  carried: CarriedBooking[];
  /** Billed earlier, since cancelled in time — credited if they fit. */
  credits: CreditBooking[];
}

interface PostpaidGroup {
  contact: BillingContact;
  entries: GroupEntry[];
  /** A member bills the whole month → the request's period ends on the month end. */
  fullMonth: boolean;
}

function contactKey(contact: BillingContact): string {
  return contact.billingEntityId
    ? `entity:${contact.billingEntityId}`
    : `student:${contact.studentId}`;
}

function isSameContact(a: BillingContact, b: BillingContact): boolean {
  if (a.type === "corporate" && b.type === "corporate") {
    return a.billingEntityId === b.billingEntityId;
  }
  if (a.type !== "corporate" && b.type !== "corporate") {
    return a.studentId === b.studentId;
  }
  return false;
}

function bookingCurrency(booking: Booking): string {
  return (booking.priceCurrency as string) || "ZAR";
}

function buildGroupLineItems(entries: GroupEntry[], currency: string) {
  const lineItems: InvoiceLineItem[] = [];
  for (const { student, bookings } of entries) {
    for (const booking of bookings) {
      // Skip credit-paid bookings (priceZarCents = 0 means a session credit was used)
      if (booking.priceZarCents === 0) continue;

      // Use the booking's stored price — the amount in the booking's currency
      // that the client agreed to at booking time.
      const rate = booking.priceZarCents;
      lineItems.push(
        buildLineItemFromBooking(booking, rate, student, student.standingDiscountPercent, student.standingDiscountFixed),
      );
    }
  }
  const chargeCount = lineItems.length;
  const chargesCents = lineItems.reduce((sum, li) => sum + li.totalCents, 0);

  for (const { student, carried } of entries) {
    const name = `${student.firstName} ${student.lastName}`;
    for (const b of carried) {
      lineItems.push(
        noteLine(
          "Rescheduled session — already billed",
          `${sessionSubLine(b, name)} · billed on the ${monthLabel(b.paymentRequest?.billingMonth ?? "")} request`,
        ),
      );
    }
  }

  const { applied, totalCents: creditCents } = planCredits(chargesCents, currency, entries.flatMap((e) => e.credits));
  for (const { student, credits } of entries) {
    const name = `${student.firstName} ${student.lastName}`;
    for (const c of credits.filter((x) => applied.includes(x))) {
      lineItems.push(
        noteLine(
          "Credit — cancelled session",
          `${sessionSubLine(c.booking, name)} · billed on the ${monthLabel(c.billedIn)} request, cancelled in time · ${formatPrice(c.amountCents, currency)} credited`,
        ),
      );
    }
  }

  return { lineItems, chargeCount, credited: applied, creditCents };
}

async function createGroupPaymentRequest(
  group: PostpaidGroup,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
  billingMonth: string,
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
) {
  // All charged bookings in a group share one currency (the group key carries it)
  const currency = (group.entries.find((e) => e.bookings.length > 0)?.bookings[0]?.priceCurrency as string) || "ZAR";
  const { lineItems, chargeCount, credited, creditCents } = buildGroupLineItems(group.entries, currency);

  // Collect ALL charged booking IDs (including credit-paid R0 ones) so they get linked
  // to the payment request and aren't picked up again next month. Carried and credited
  // bookings keep the link to the request that charged them.
  const allBookingIds = group.entries.flatMap(e => e.bookings.map(b => b.id));

  if (chargeCount === 0) {
    return null;
  }

  // Append currency to billingMonth for non-ZAR so the [studentId, billingMonth] unique
  // constraint doesn't conflict when a client somehow has bookings in two currencies.
  const prBillingMonth = currency === "ZAR" ? billingMonth : `${billingMonth}-${currency}`;

  const lineCalcs = lineItems.map((li) => ({
    unitPriceCents: li.unitPriceCents,
    quantity: li.quantity,
    lineDiscountPercent: li.discountPercent || undefined,
    lineDiscountCents: li.discountCents || undefined,
  }));

  // International currencies are VAT zero-rated (exported services)
  const isVat = vatApplies(currency, settings.vatRegistered);
  const vatPercent = isVat ? (settings.vatPercent ?? 0) : 0;
  // Credits ride as the request's discount, before VAT, so the VAT falls with them.
  const totals = calculateInvoiceTotals(lineCalcs, undefined, creditCents || undefined, isVat, vatPercent);

  try {
    const pr = await prisma.paymentRequest.create({
      data: {
        studentId: group.contact.type === "corporate" ? undefined : group.contact.studentId,
        billingEntityId: group.contact.billingEntityId,
        billingMonth: prBillingMonth,
        periodStart,
        periodEnd,
        currency,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        vatAmountCents: totals.vatAmountCents,
        totalCents: totals.totalCents,
        lineItems: parseLineItems(lineItems, "monthly billing line items") as unknown as Parameters<typeof prisma.paymentRequest.create>[0]["data"]["lineItems"],
        dueDate,
        status: "pending",
      },
    });

    // Link ALL bookings (including credit-paid R0) to prevent re-billing
    if (allBookingIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: allBookingIds } },
        data: { paymentRequestId: pr.id },
      });
    }

    // Stamp each credit as used — conditionally, so a credit can never be spent twice.
    if (credited.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: credited.map((c) => c.bookingId) }, creditedOnPaymentRequestId: null },
        data: { creditedOnPaymentRequestId: pr.id },
      });
    }

    return pr;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.log(`Payment request already exists for ${prBillingMonth} — skipping`);
      return null;
    }
    throw err;
  }
}

/**
 * Generate monthly payment requests for all postpaid clients.
 *
 * Bookings are partitioned by session type (individual vs couples) and
 * billing contacts are resolved per type. When both types resolve to the
 * same payer, they're merged into a single payment request.
 *
 * Bookings are further partitioned by currency — a client with EUR bookings
 * gets a EUR payment request; ZAR clients are unaffected.
 *
 * @param billingDate - The date to bill for (typically today or the billing day)
 * @returns Array of created PaymentRequest records
 */
export async function generateMonthlyPaymentRequests(
  billingDate: Date,
) {
  const settings = await getSiteSettings();
  const year = billingDate.getFullYear();
  const month = billingDate.getMonth() + 1; // 1-indexed

  const { start: periodStart, end: periodEnd } = getBillingPeriod(year, month);
  // The calendar month, for one-invoice-per-month clients.
  const monthStart = calendarDate(saDateStr(saMonthStart(year, month)));
  const monthEnd = calendarDate(addSaDays(saDateStr(saMonthStart(year, month + 1)), -1));
  const dueDate = calculateDueDate(
    billingDate,
    settings.postpaidDueDays,
    settings.postpaidDueDaysType as "business" | "calendar",
  );
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

  // 1. Get all postpaid students
  const postpaidStudents = await prisma.student.findMany({
    where: { billingType: "postpaid" },
  });

  if (postpaidStudents.length === 0) return [];

  // 2. Group by billing contact, partitioning by session type and currency
  const groups = new Map<string, PostpaidGroup>();

  for (const student of postpaidStudents) {
    const fullMonth = student.billFullMonth;
    const bookings = await getUnbilledBookings(student.id, periodEnd, fullMonth ? monthEnd : undefined);
    if (bookings.length === 0) continue;

    // Partition into individual (includes free_consultation) and couples
    const hasIndiv = bookings.some((b) => b.sessionType !== "couples");
    const hasCouples = bookings.some((b) => b.sessionType === "couples");
    const indivContact = hasIndiv ? await resolveBillingContact(student.id, "individual") : null;
    const couplesContact = hasCouples ? await resolveBillingContact(student.id, "couples") : null;
    // If both resolve to same payer, merge into one group (still split by currency)
    const merged = indivContact && couplesContact && isSameContact(indivContact, couplesContact) ? indivContact : null;

    const route = (sessionType: string, currency: string): { key: string; contact: BillingContact } | null => {
      if (merged) return { key: `${contactKey(merged)}:${currency}`, contact: merged };
      if (sessionType === "couples") {
        return couplesContact ? { key: `${contactKey(couplesContact)}:couples:${currency}`, contact: couplesContact } : null;
      }
      return indivContact ? { key: `${contactKey(indivContact)}:individual:${currency}`, contact: indivContact } : null;
    };
    const entryFor = (r: { key: string; contact: BillingContact }): GroupEntry => {
      let group = groups.get(r.key);
      if (!group) {
        group = { contact: r.contact, entries: [], fullMonth: false };
        groups.set(r.key, group);
      }
      group.fullMonth ||= fullMonth;
      let entry = group.entries.find((e) => e.student.id === student.id);
      if (!entry) {
        entry = { student, bookings: [], carried: [], credits: [] };
        group.entries.push(entry);
      }
      return entry;
    };

    for (const b of bookings) {
      const r = route(b.sessionType, bookingCurrency(b));
      if (r) entryFor(r).bookings.push(b);
    }

    // Settle earlier bills on the request the same payer gets now — never on one with nothing
    // charged (it is not created), in which case they wait for the next.
    const carried = await getCarriedOverBookings(
      student.id,
      fullMonth ? monthStart : periodStart,
      fullMonth ? monthEnd : periodEnd,
    );
    for (const c of carried) {
      const r = route(c.sessionType, bookingCurrency(c));
      if (r && groups.has(r.key)) entryFor(r).carried.push(c);
    }
    for (const credit of await getPendingCredits(student.id)) {
      const r = route(credit.booking.sessionType, credit.currency);
      if (r && groups.has(r.key)) entryFor(r).credits.push(credit);
    }
  }

  // 3. Create payment requests for each group with bookings
  const created = [];

  for (const group of groups.values()) {
    if (group.entries.length === 0) continue;
    const pr = await createGroupPaymentRequest(
      group,
      settings,
      billingMonth,
      periodStart,
      group.fullMonth ? monthEnd : periodEnd,
      dueDate,
    );
    if (pr) created.push(pr);
  }

  return created;
}
