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
  getSessionRate,
  calculateInvoiceTotals,
  getBillingPeriod,
  getEffectiveDueDate,
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
      status: { in: ["completed", "no_show"] },
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

async function buildGroupLineItems(
  entries: { student: Student; bookings: Booking[] }[],
): Promise<InvoiceLineItem[]> {
  const lineItems: InvoiceLineItem[] = [];
  for (const { student, bookings } of entries) {
    for (const booking of bookings) {
      const rate = await getSessionRate(
        booking.sessionType as "individual" | "couples" | "free_consultation",
        "ZAR",
      );
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

  const lineCalcs = lineItems.map((li) => ({
    unitPriceCents: li.unitPriceCents,
    quantity: li.quantity,
    lineDiscountPercent: li.discountPercent || undefined,
    lineDiscountCents: li.discountCents || undefined,
  }));

  const isVat = settings.vatRegistered;
  const vatPercent = isVat ? settings.vatPercent : 0;
  const totals = calculateInvoiceTotals(lineCalcs, undefined, undefined, isVat, vatPercent);

  try {
    const pr = await prisma.paymentRequest.create({
      data: {
        studentId: group.contact.type === "corporate" ? undefined : group.contact.studentId,
        billingEntityId: group.contact.billingEntityId,
        billingMonth,
        periodStart,
        periodEnd,
        currency: "ZAR",
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        vatAmountCents: totals.vatAmountCents,
        totalCents: totals.totalCents,
        lineItems: lineItems as unknown as Parameters<typeof prisma.paymentRequest.create>[0]["data"]["lineItems"],
        dueDate,
        status: "pending",
      },
    });

    const bookingIds = lineItems.map((li) => li.bookingId).filter((id): id is string => !!id);
    if (bookingIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { paymentRequestId: pr.id },
      });
    }

    return pr;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.log(`Payment request already exists for ${billingMonth} — skipping`);
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
 * @param billingDate - The date to bill for (typically today or the billing day)
 * @returns Array of created PaymentRequest records
 */
export async function generateMonthlyPaymentRequests(
  billingDate: Date,
) {
  const settings = await getSiteSettings();
  const billingDay = settings.postpaidBillingDay;
  const dueDay = settings.postpaidDueDay;
  const year = billingDate.getFullYear();
  const month = billingDate.getMonth() + 1; // 1-indexed

  const { start: periodStart, end: periodEnd } = getBillingPeriod(year, month, billingDay);
  const dueDate = getEffectiveDueDate(year, month, dueDay);
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

  // 1. Get all postpaid students
  const postpaidStudents = await prisma.student.findMany({
    where: { billingType: "postpaid" },
  });

  if (postpaidStudents.length === 0) return [];

  // 2. Group by billing contact, partitioning by session type
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

    // If both resolve to same payer, merge into one group
    if (indivContact && couplesContact && isSameContact(indivContact, couplesContact)) {
      const key = contactKey(indivContact);
      addToGroup(groups, key, indivContact, student, bookings);
    } else {
      if (indivContact && indivBookings.length > 0) {
        const key = `${contactKey(indivContact)}:individual`;
        addToGroup(groups, key, indivContact, student, indivBookings);
      }
      if (couplesContact && couplesBookings.length > 0) {
        const key = `${contactKey(couplesContact)}:couples`;
        addToGroup(groups, key, couplesContact, student, couplesBookings);
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
