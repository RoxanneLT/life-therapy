/**
 * Monthly postpaid billing — generate payment requests for all postpaid clients.
 *
 * Flow:
 *   1. Get all postpaid students
 *   2. Group by billing contact (self, individual payer, or corporate)
 *   3. For each group: gather unbilled bookings, build line items,
 *      apply standing discounts, calculate totals, create PaymentRequest
 */

import { prisma } from "@/lib/prisma";
import { Prisma, type Booking, type Student } from "@/lib/generated/prisma/client";
import { getSiteSettings } from "@/lib/settings";
import {
  resolveBillingContact,
  calculateInvoiceTotals,
  getBillingPeriod,
  calculateDueDate,
  type BillingContact,
} from "@/lib/billing";
import type { InvoiceLineItem } from "@/lib/billing-types";
import { format } from "date-fns";

// ─── Unbilled bookings query ─────────────────────────────────

/**
 * Get completed bookings for a student within a billing period
 * that aren't already linked to a payment request or invoice.
 */
export async function getUnbilledBookings(
  studentId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Booking[]> {
  return prisma.booking.findMany({
    where: {
      studentId,
      OR: [
        { status: { in: ["completed", "no_show"] } },
        { status: "cancelled", isLateCancel: true },
      ],
      date: { gte: periodStart, lte: periodEnd },
      paymentRequestId: null,
      invoiceId: null,
    },
    orderBy: { date: "asc" },
  });
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
  const subLine = `${dateStr}, ${booking.startTime}–${booking.endTime} — ${attendeeName}`;

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

interface PostpaidGroup {
  contact: BillingContact;
  entries: { student: Student; bookings: Booking[] }[];
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

function addToGroup(
  groups: Map<string, PostpaidGroup>,
  key: string,
  contact: BillingContact,
  student: Student,
  bookings: Booking[],
) {
  if (!groups.has(key)) {
    groups.set(key, { contact, entries: [] });
  }
  groups.get(key)!.entries.push({ student, bookings });
}

function bookingCurrency(booking: Booking): string {
  return (booking.priceCurrency as string) || "ZAR";
}

/** Partition bookings by currency and add each currency slice as its own group. */
function addBookingsByCurrency(
  groups: Map<string, PostpaidGroup>,
  baseKey: string,
  contact: BillingContact,
  student: Student,
  bookings: Booking[],
) {
  const byCurrency = new Map<string, Booking[]>();
  for (const b of bookings) {
    const curr = bookingCurrency(b);
    if (!byCurrency.has(curr)) byCurrency.set(curr, []);
    byCurrency.get(curr)!.push(b);
  }
  for (const [curr, currBookings] of byCurrency) {
    addToGroup(groups, `${baseKey}:${curr}`, contact, student, currBookings);
  }
}

async function buildGroupLineItems(
  entries: { student: Student; bookings: Booking[] }[],
): Promise<InvoiceLineItem[]> {
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
  return lineItems;
}

async function createGroupPaymentRequest(
  group: PostpaidGroup,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
  billingMonth: string,
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
) {
  const lineItems = await buildGroupLineItems(group.entries);

  // Collect ALL booking IDs (including credit-paid R0 ones) so they get linked
  // to the payment request and aren't picked up again next month
  const allBookingIds = group.entries.flatMap(e => e.bookings.map(b => b.id));

  if (lineItems.length === 0) {
    return null;
  }

  // All bookings in a group share the same currency (enforced by addBookingsByCurrency)
  const currency = (group.entries[0]?.bookings[0]?.priceCurrency as string) || "ZAR";

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
  const isVat = currency === "ZAR" ? settings.vatRegistered : false;
  const vatPercent = isVat ? (settings.vatPercent ?? 0) : 0;
  const totals = calculateInvoiceTotals(lineCalcs, undefined, undefined, isVat, vatPercent);

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
        lineItems: lineItems as unknown as Parameters<typeof prisma.paymentRequest.create>[0]["data"]["lineItems"],
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
    const bookings = await getUnbilledBookings(student.id, periodStart, periodEnd);
    if (bookings.length === 0) continue;

    // Partition into individual (includes free_consultation) and couples
    const indivBookings = bookings.filter((b) => b.sessionType !== "couples");
    const couplesBookings = bookings.filter((b) => b.sessionType === "couples");

    const indivContact = indivBookings.length > 0
      ? await resolveBillingContact(student.id, "individual")
      : null;
    const couplesContact = couplesBookings.length > 0
      ? await resolveBillingContact(student.id, "couples")
      : null;

    // If both resolve to same payer, merge into one group (still split by currency)
    if (indivContact && couplesContact && isSameContact(indivContact, couplesContact)) {
      addBookingsByCurrency(groups, contactKey(indivContact), indivContact, student, bookings);
    } else {
      if (indivContact && indivBookings.length > 0) {
        addBookingsByCurrency(groups, `${contactKey(indivContact)}:individual`, indivContact, student, indivBookings);
      }
      if (couplesContact && couplesBookings.length > 0) {
        addBookingsByCurrency(groups, `${contactKey(couplesContact)}:couples`, couplesContact, student, couplesBookings);
      }
    }
  }

  // 3. Create payment requests for each group with bookings
  const created = [];

  for (const group of groups.values()) {
    if (group.entries.length === 0) continue;
    const pr = await createGroupPaymentRequest(group, settings, billingMonth, periodStart, periodEnd, dueDate);
    if (pr) created.push(pr);
  }

  return created;
}
