/**
 * Core billing library — date utilities, VAT/discount calculations,
 * session rate lookup, and billing contact resolution.
 */

import { getSiteSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import {
  getPrecedingBusinessDay,
  subtractBusinessDays,
  getNextBusinessDay,
} from "@/lib/sa-holidays";

// ─── Date utilities ──────────────────────────────────────────

/**
 * Returns the effective billing date for a month, shifted to the
 * preceding business day if it falls on a weekend or SA public holiday.
 */
export function getEffectiveBillingDate(
  year: number,
  month: number,
  billingDay: number,
): Date {
  // month is 1-indexed (1 = Jan)
  const raw = new Date(year, month - 1, billingDay);
  return getPrecedingBusinessDay(raw);
}

/**
 * Returns the effective due date for a month, shifted to the
 * preceding business day if it falls on a weekend or SA public holiday.
 */
export function getEffectiveDueDate(
  year: number,
  month: number,
  dueDay: number,
): Date {
  const raw = new Date(year, month - 1, dueDay);
  return getPrecedingBusinessDay(raw);
}

/**
 * Reminder date = 2 business days before the due date.
 */
export function getReminderDate(dueDate: Date): Date {
  return subtractBusinessDays(dueDate, 2);
}

/**
 * Overdue date = 1 business day after the due date.
 */
export function getOverdueDate(dueDate: Date): Date {
  return getNextBusinessDay(
    new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate() + 1,
    ),
  );
}

/**
 * Returns the billing period for a given month with the specified billing day.
 *
 * For month M with billing day D:
 *   start = day after previous month's billing date (effective)
 *   end   = this month's billing date (effective)
 */
export function getBillingPeriod(
  year: number,
  month: number,
  billingDay: number,
): { start: Date; end: Date } {
  const end = getEffectiveBillingDate(year, month, billingDay);

  // Previous month
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const prevBillingDate = getEffectiveBillingDate(prevYear, prevMonth, billingDay);
  const start = new Date(prevBillingDate);
  start.setDate(start.getDate() + 1);

  return { start, end };
}

// ─── Financial calculations ──────────────────────────────────

export interface LineItemCalc {
  unitPriceCents: number;
  quantity: number;
  lineDiscountPercent?: number;
  lineDiscountCents?: number;
}

/**
 * Calculate gross, discount, and net for a single line item.
 *
 *   gross    = unitPriceCents × quantity
 *   discount = max(gross × percent / 100,  fixedCents)
 *   net      = gross − discount
 */
export function calculateLineTotal(item: LineItemCalc): {
  gross: number;
  discount: number;
  net: number;
} {
  const gross = item.unitPriceCents * item.quantity;

  const percentDiscount = item.lineDiscountPercent
    ? Math.round((gross * item.lineDiscountPercent) / 100)
    : 0;
  const fixedDiscount = item.lineDiscountCents ?? 0;

  // Use whichever discount is larger
  const discount = Math.max(percentDiscount, fixedDiscount);
  const net = Math.max(0, gross - discount);

  return { gross, discount, net };
}

/**
 * Calculate full invoice totals from line items, optional invoice-level
 * discount, and optional VAT.
 *
 *   subtotalCents  = sum of all line nets
 *   discountCents  = invoice-level discount applied to subtotal
 *   vatAmountCents = (subtotal − discount) × vatPercent / 100  (if registered)
 *   totalCents     = subtotal − discount + vat
 */
export function calculateInvoiceTotals(
  lineItems: LineItemCalc[],
  invoiceDiscountPercent?: number,
  invoiceDiscountCents?: number,
  vatRegistered?: boolean,
  vatPercent?: number,
): {
  subtotalCents: number;
  discountCents: number;
  vatAmountCents: number;
  totalCents: number;
} {
  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + calculateLineTotal(item).net,
    0,
  );

  const percentDiscount = invoiceDiscountPercent
    ? Math.round((subtotalCents * invoiceDiscountPercent) / 100)
    : 0;
  const fixedDiscount = invoiceDiscountCents ?? 0;
  const discountCents = Math.max(percentDiscount, fixedDiscount);

  const afterDiscount = Math.max(0, subtotalCents - discountCents);

  const vatAmountCents =
    vatRegistered && vatPercent
      ? Math.round((afterDiscount * vatPercent) / 100)
      : 0;

  const totalCents = afterDiscount + vatAmountCents;

  return { subtotalCents, discountCents, vatAmountCents, totalCents };
}

// ─── Rate lookup ─────────────────────────────────────────────

export type SessionRateKey = "individual" | "couples" | "free_consultation";

/**
 * Look up the session rate from SiteSetting.
 * Returns the price in cents (ex-VAT) for the given currency.
 * Defaults to ZAR if currency not specified.
 */
export async function getSessionRate(
  sessionType: SessionRateKey,
  currency: string = "ZAR",
): Promise<number> {
  if (sessionType === "free_consultation") return 0;

  const settings = await getSiteSettings();
  const curr = currency.toUpperCase();

  if (sessionType === "individual") {
    switch (curr) {
      case "USD": return settings.sessionPriceIndividualUsd ?? 6500;
      case "EUR": return settings.sessionPriceIndividualEur ?? 5900;
      case "GBP": return settings.sessionPriceIndividualGbp ?? 4900;
      default:    return settings.sessionPriceIndividualZar ?? 85000;
    }
  }

  // couples
  switch (curr) {
    case "USD": return settings.sessionPriceCouplesUsd ?? 9500;
    case "EUR": return settings.sessionPriceCouplesEur ?? 8500;
    case "GBP": return settings.sessionPriceCouplesGbp ?? 7500;
    default:    return settings.sessionPriceCouplesZar ?? 120000;
  }
}

// ─── Billing contact resolution ──────────────────────────────

export interface BillingContact {
  type: "self" | "individual" | "corporate";
  studentId?: string;
  billingEntityId?: string;
  name: string;
  email: string;
  address?: string;
  vatNumber?: string;
}

/**
 * Resolve who pays for a student's sessions:
 *
 * Looks up the student's `individualBilledToId` or `couplesBilledToId` FK
 * to find the assigned ClientRelationship, then resolves the payer from that
 * relationship (corporate entity or individual payer).
 *
 * Falls back to self-billing when no assignment exists.
 */
export async function resolveBillingContact(
  studentId: string,
  sessionType?: "individual" | "couples" | "free_consultation",
): Promise<BillingContact> {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      individualBilledTo: {
        include: { student: true, relatedStudent: true, billingEntity: true },
      },
      couplesBilledTo: {
        include: { student: true, relatedStudent: true, billingEntity: true },
      },
    },
  });

  // Determine which billing link to use based on session type
  let billingLink: typeof student.individualBilledTo = null;
  if (sessionType === "couples") {
    billingLink = student.couplesBilledTo;
  } else if (sessionType === "individual" || sessionType === "free_consultation") {
    billingLink = student.individualBilledTo;
  } else {
    billingLink = student.individualBilledTo ?? student.couplesBilledTo;
  }

  // Corporate billing link
  if (billingLink?.billingEntityId && billingLink.billingEntity) {
    const entity = billingLink.billingEntity;
    return {
      type: "corporate",
      billingEntityId: entity.id,
      name: entity.name,
      email: entity.email,
      address: entity.address ?? undefined,
      vatNumber: entity.vatNumber ?? undefined,
    };
  }

  // Individual billing link (e.g. parent pays for child)
  // Payer = the OTHER person in the relationship relative to the billed student
  if (billingLink) {
    const payer = billingLink.studentId === studentId
      ? billingLink.relatedStudent  // student created the relationship → other person pays
      : billingLink.student;        // other person created it → they pay
    if (payer) {
      return {
        type: "individual",
        studentId: payer.id,
        name: `${payer.firstName} ${payer.lastName}`,
        email: payer.billingEmail ?? payer.email,
        address: payer.billingAddress ?? undefined,
      };
    }
  }

  // Default: student pays for themselves
  return {
    type: "self",
    studentId: student.id,
    name: `${student.firstName} ${student.lastName}`,
    email: student.billingEmail ?? student.email,
    address: student.billingAddress ?? undefined,
  };
}
