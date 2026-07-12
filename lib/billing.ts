/**
 * Core billing library — date utilities, VAT/discount calculations,
 * session rate lookup, and billing contact resolution.
 */

import { getSiteSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { CURRENCIES, type Currency } from "@/lib/region";
import {
  subtractBusinessDays,
  getNextBusinessDay,
  addBusinessDays,
  getLastBusinessDayOfMonth,
} from "@/lib/sa-holidays";

// ─── Date utilities ──────────────────────────────────────────

/**
 * Returns the effective billing date for a month: the last business day of the month.
 * month is 1-indexed (1 = Jan).
 */
export function getEffectiveBillingDate(year: number, month: number): Date {
  return getLastBusinessDayOfMonth(year, month);
}

/**
 * Returns the due date by adding N days to the billing date.
 *
 * type "business": skip weekends and SA public holidays.
 * type "calendar": add calendar days; if result lands on Sat/Sun, shift to next Monday.
 */
export function calculateDueDate(
  billingDate: Date,
  days: number,
  type: "business" | "calendar",
): Date {
  if (type === "business") {
    return addBusinessDays(billingDate, days);
  }
  // Calendar days. UTC getters throughout: these Dates are DAYS (UTC midnight, as
  // calendarDate() builds them), not moments. Local getters would read the wrong
  // day for any value not anchored at local midnight — which is exactly how a
  // dueDate stored at 22:00 UTC came back as the previous date.
  const d = new Date(billingDate);
  d.setUTCDate(d.getUTCDate() + days);
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2); // Sat → Mon
  else if (dow === 0) d.setUTCDate(d.getUTCDate() + 1); // Sun → Mon
  return d;
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
    new Date(Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate() + 1,
    )),
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
): { start: Date; end: Date } {
  const end = getEffectiveBillingDate(year, month);

  // Previous month
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const prevBillingDate = getEffectiveBillingDate(prevYear, prevMonth);
  const start = new Date(prevBillingDate);
  start.setUTCDate(start.getUTCDate() + 1);

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
 * Does South African VAT apply to an amount in this currency?
 *
 * **VAT is ZAR-only.** Life-Therapy is registered in South Africa; an export of
 * services to an international client is zero-rated. So a USD/EUR/GBP invoice
 * never carries VAT, no matter what `vatRegistered` says.
 *
 * This is the single definition of that rule. It exists because the automated
 * billing run gated VAT on currency while `createInvoiceRecord` — the chokepoint
 * every invoice passes through — took `settings.vatRegistered` raw, and would
 * have added 15% SA VAT to an international client's invoice the moment VAT
 * registration was switched on. Two copies of a rule is one copy too many.
 */
export function vatApplies(
  currency: string,
  vatRegistered: boolean | null | undefined,
): boolean {
  return currency === "ZAR" && Boolean(vatRegistered);
}

/**
 * The currency a client is billed in.
 *
 * There is no `currency` column on Student — currency is established per booking
 * (`priceCurrency`), set from the domain the client booked through
 * (life-therapy.co.za → ZAR, life-therapy.online → USD/EUR/GBP). So a client's
 * billing currency is the one their sessions are actually priced in; we take the
 * most recent, and fall back to ZAR for a client with no priced sessions yet.
 *
 * Use this for MANUAL billing (an admin composing a payment request or invoice
 * by hand), where there are no bookings to read the currency from. Automated
 * billing should always use the booking's own `priceCurrency` — never this.
 */
export async function resolveClientCurrency(studentId: string): Promise<Currency> {
  const [only] = await resolveClientCurrencies([studentId]);
  return only?.currency ?? "ZAR";
}

/**
 * Batch form, for lists (an admin client picker, a billing table). One query
 * instead of N — and, more to the point, the RULE ("the currency of their most
 * recent priced session, else ZAR") stays in one place. A caller that
 * re-implements it inline is how the next drift starts.
 */
export async function resolveClientCurrencies(
  studentIds: string[],
): Promise<{ studentId: string; currency: Currency }[]> {
  if (studentIds.length === 0) return [];
  const bookings = await prisma.booking.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { date: "desc" },
    select: { studentId: true, priceCurrency: true },
  });
  // Sorted newest-first, so the first row seen for a student is their latest.
  const latest = new Map<string, string>();
  for (const b of bookings) {
    if (b.studentId && !latest.has(b.studentId)) latest.set(b.studentId, b.priceCurrency);
  }
  return studentIds.map((studentId) => ({
    studentId,
    currency: toCurrency(latest.get(studentId)),
  }));
}

/**
 * Narrow an unconstrained DB string to the Currency union, falling back to ZAR.
 *
 * `Booking.priceCurrency` is a plain Postgres `String` — nothing stops a legacy
 * row, a lowercase "usd", or a bad import from holding a value outside the union.
 * Casting one with `as Currency` is a lie that TypeScript cannot catch: it flows
 * into `getSessionPrice`, whose switch has no default, which then returns
 * `undefined` in spite of its `: number` signature — and the client is shown a
 * late-cancellation fee of R0,00. Validate at the boundary instead of asserting.
 */
export function toCurrency(value: string | null | undefined): Currency {
  return value && (CURRENCIES as readonly string[]).includes(value)
    ? (value as Currency)
    : "ZAR";
}

/**
 * Calculate full invoice totals from line items, optional invoice-level
 * discount, and optional VAT.
 *
 *   subtotalCents  = sum of all line nets
 *   discountCents  = invoice-level discount applied to subtotal
 *   vatAmountCents = (subtotal − discount) × vatPercent / 100  (if registered)
 *   totalCents     = subtotal − discount + vat
 *
 * Pass `vatRegistered` through `vatApplies(currency, …)` — never raw.
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
  // Fall back to decrypted address if billingAddress is not set
  let address = student.billingAddress ?? undefined;
  if (!address && student.address) {
    try {
      const { decryptOrNull } = await import("@/lib/encryption");
      address = decryptOrNull(student.address) ?? undefined;
    } catch { /* encryption key not available */ }
  }

  return {
    type: "self",
    studentId: student.id,
    name: `${student.firstName} ${student.lastName}`,
    email: student.billingEmail ?? student.email,
    address,
  };
}
