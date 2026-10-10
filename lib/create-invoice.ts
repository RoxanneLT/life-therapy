/**
 * Invoice creation engine.
 *
 * Three entry points:
 *   1. createInvoiceFromPayment   — after a Paystack/card payment succeeds
 *   2. createInvoiceFromPaymentRequest — when a postpaid payment request is paid
 *   3. createManualInvoice        — admin marks session as paid (EFT/cash)
 *
 * All paths follow the same flow:
 *   resolve billing contact → get invoice number → calculate totals →
 *   create Invoice record → generate PDF → return invoice
 */

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getSiteSettings } from "@/lib/settings";
import { resolveBillingContact, calculateInvoiceTotals, vatApplies, resolveClientCurrency, receivedCents } from "@/lib/billing";
import { getNextInvoiceNumber } from "@/lib/invoice-numbering";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { parseLineItems, readLineItems, type InvoiceLineItem } from "@/lib/billing-types";
import type { Invoice } from "@/lib/generated/prisma/client";

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Determine invoice type from order items.
 */
export function determineInvoiceType(
  items: { courseId?: string | null; hybridPackageId?: string | null; digitalProductId?: string | null }[],
): string {
  const hasCourse = items.some((i) => i.courseId);
  const hasPackage = items.some((i) => i.hybridPackageId);
  const hasProduct = items.some((i) => i.digitalProductId);

  if (hasPackage) return "package_purchase";
  if (hasCourse && !hasProduct) return "course_purchase";
  if (hasProduct && !hasCourse) return "product_sale";
  return "course_purchase"; // default for mixed
}

/**
 * Convert OrderItems to InvoiceLineItems.
 */
export function buildLineItemsFromOrder(
  items: {
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    courseId?: string | null;
    hybridPackageId?: string | null;
    digitalProductId?: string | null;
  }[],
): InvoiceLineItem[] {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    discountCents: 0,
    discountPercent: 0,
    totalCents: item.totalCents,
    courseId: item.courseId ?? undefined,
    productId: item.digitalProductId ?? undefined,
  }));
}

// ─── Core invoice creation ───────────────────────────────────

async function createInvoiceRecord(params: {
  type: string;
  studentId?: string;
  billingEntityId?: string;
  billingName: string;
  billingEmail: string;
  billingAddress?: string;
  billingVatNumber?: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  invoiceDiscountPercent?: number;
  invoiceDiscountCents?: number;
  paymentMethod?: string;
  paystackReference?: string;
  eftReference?: string;
  paidAmountCents?: number;
  orderId?: string;
  paymentRequestId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  billingMonth?: string;
  dueDate?: Date;
  status?: string;
}): Promise<Invoice> {
  const settings = await getSiteSettings();
  // VAT is ZAR-only — an international invoice is zero-rated. This is the
  // chokepoint EVERY invoice passes through, so gating here covers the manual,
  // ad-hoc and regenerated paths as well as the monthly run.
  const isVat = vatApplies(params.currency, settings.vatRegistered);
  const vatPercent = isVat ? settings.vatPercent : 0;

  // The single gate for every invoice in the system — all three public creators
  // funnel through here. `lineItems` is a Json column, so this is the only thing
  // between a malformed object and a document a client reads: the PDF prints
  // `totalCents` verbatim rather than re-deriving it, so a bad row is a wrong
  // invoice, found weeks later by the person being billed.
  const lineItems = parseLineItems(params.lineItems, "invoice line items");

  // Calculate totals
  const lineCalcs = lineItems.map((li) => ({
    unitPriceCents: li.unitPriceCents,
    quantity: li.quantity,
    lineDiscountPercent: li.discountPercent || undefined,
    lineDiscountCents: li.discountCents || undefined,
  }));

  const totals = calculateInvoiceTotals(
    lineCalcs,
    params.invoiceDiscountPercent,
    params.invoiceDiscountCents,
    isVat,
    vatPercent,
  );

  // The number and the invoice in one transaction, so a create that fails gives its number back.
  const prefix = settings.invoicePrefix || "LT";
  const invoice = await prisma.$transaction(async (tx) => {
    const { number: invoiceNumber } = await getNextInvoiceNumber(params.billingName, prefix, new Date(), tx);
    return tx.invoice.create({
      data: {
        invoiceNumber,
        type: params.type,
        studentId: params.studentId,
        billingEntityId: params.billingEntityId,
        billingName: params.billingName,
        billingEmail: params.billingEmail,
        billingAddress: params.billingAddress,
        billingVatNumber: params.billingVatNumber,
        currency: params.currency,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        discountPercent: params.invoiceDiscountPercent ?? 0,
        vatPercent,
        vatAmountCents: totals.vatAmountCents,
        totalCents: totals.totalCents,
        lineItems: lineItems as unknown as Parameters<typeof prisma.invoice.create>[0]["data"]["lineItems"],
        status: params.status ?? "paid",
        paymentMethod: params.paymentMethod,
        paystackReference: params.paystackReference,
        eftReference: params.eftReference,
        paidAt: params.status === "paid" || !params.status ? new Date() : undefined,
        paidAmountCents: params.paidAmountCents ?? totals.totalCents,
        issuedAt: new Date(),
        orderId: params.orderId,
        paymentRequestId: params.paymentRequestId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        billingMonth: params.billingMonth,
        dueDate: params.dueDate,
      },
    });
  });

  // Generate PDF (non-blocking — don't fail the invoice creation)
  try {
    await generateAndStoreInvoicePDF(invoice.id);
  } catch (err) {
    console.error(`Failed to generate PDF for invoice ${invoice.id}:`, err);
  }

  return invoice;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Create an invoice from a completed Paystack payment (e-commerce checkout).
 */
export async function createInvoiceFromPayment(params: {
  type: string;
  studentId: string;
  orderId?: string;
  amountCents: number;
  currency: string;
  paymentReference: string;
  paymentMethod: "paystack" | "eft" | "cash" | "card";
  lineItems: InvoiceLineItem[];
  invoiceDiscountCents?: number;
  couponCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<Invoice> {
  // Idempotency: don't create duplicate invoices for the same payment
  if (params.paymentReference) {
    const existing = await prisma.invoice.findFirst({
      where: { paystackReference: params.paymentReference },
    });
    if (existing) return existing;
  }

  const contact = await resolveBillingContact(params.studentId);

  return createInvoiceRecord({
    type: params.type,
    studentId: contact.studentId,
    billingEntityId: contact.billingEntityId,
    billingName: contact.name,
    billingEmail: contact.email,
    billingAddress: contact.address,
    billingVatNumber: contact.vatNumber,
    currency: params.currency,
    lineItems: params.lineItems,
    invoiceDiscountCents: params.invoiceDiscountCents,
    paymentMethod: params.paymentMethod,
    paystackReference: params.paymentReference,
    paidAmountCents: params.amountCents,
    orderId: params.orderId,
    status: "paid",
  });
}

/**
 * Create an invoice from a paid payment request (postpaid billing).
 */
export async function createInvoiceFromPaymentRequest(
  paymentRequestId: string,
  payment: {
    reference: string;
    method: "paystack" | "eft" | "cash" | "card";
    amountCents: number;
  },
): Promise<Invoice> {
  // Idempotency: don't create duplicate for same payment reference
  if (payment.reference) {
    const existing = await prisma.invoice.findFirst({
      where: { paystackReference: payment.reference, paymentRequestId, status: "paid" },
    });
    if (existing) {
      // A retry after the invoice was written but the request was not: finish it, or the request
      // stays chased beside a paid tax invoice (walk-oct-payments-2, W3).
      await prisma.paymentRequest.updateMany({
        where: { id: paymentRequestId, status: { not: "paid" } },
        data: { status: "paid", invoiceId: existing.id, paidAmountCents: existing.paidAmountCents },
      });
      return existing;
    }
  }

  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
    include: { student: true, billingEntity: true },
  });

  // Settled already: a second settlement made a second tax invoice for the same request
  // (walk-oct-payments 01, F6). Money arriving on a paid request is the webhook's to record.
  if (pr.status === "paid" && pr.invoiceId) {
    return prisma.invoice.findUniqueOrThrow({ where: { id: pr.invoiceId } });
  }
  // Its invoice is paid but the request is not: a settlement written halfway (the invoice and the
  // request are two writes on the new-invoice path). Finish it rather than issue a second tax
  // invoice, which an admin's re-click did (walk-oct-payments-2 03, F4).
  const paidInvoice = await prisma.invoice.findFirst({ where: { paymentRequestId, status: "paid" }, orderBy: { createdAt: "desc" } });
  if (paidInvoice && pr.status !== "cancelled") {
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "paid", invoiceId: paidInvoice.id, paidAmountCents: paidInvoice.paidAmountCents ?? pr.totalCents },
    });
    return paidInvoice;
  }

  // A voided request is owed nothing. Settling it issued a numbered tax invoice and marked it paid
  // while its released sessions waited to be billed again (walk-oct-payments-2 02, N3). Every
  // caller refuses this first; reaching here is a bug, so it throws.
  if (pr.status === "cancelled") {
    throw new Error(`Payment request ${paymentRequestId} was voided and cannot be settled`);
  }

  // What this settlement brings the request to. `payment.amountCents` is THIS payment, added to
  // what came before; 0 means the admin is recording it as paid in full. Never below what the rows
  // already record (receivedCents takes the request and its invoice as one record).
  //
  // A part payment from the invoice list makes the request's invoice early, in
  // "payment_requested". The payment that finishes the request settles THAT invoice: creating
  // another gave one request two tax invoices and dropped the part payment from the row
  // (walk-oct-final 02, N1). Invoice.paymentRequestId is not unique, so this is the only guard.
  const openInvoice = await prisma.invoice.findFirst({
    where: { paymentRequestId, status: "payment_requested" },
    orderBy: { createdAt: "desc" },
  });
  const prior = receivedCents(pr, openInvoice);
  const paidToDate = payment.amountCents > 0 ? prior + payment.amountCents : Math.max(prior, pr.totalCents);

  if (openInvoice) {
    // Both rows in one transaction, so a failure cannot leave one paid and the other open (W3).
    const [invoice] = await prisma.$transaction([
      prisma.invoice.update({
        where: { id: openInvoice.id },
        data: {
          status: "paid",
          paidAt: new Date(),
          paidAmountCents: paidToDate,
          paymentMethod: payment.method,
          ...(payment.method === "paystack" ? { paystackReference: payment.reference, paymentUrl: null } : {}),
          ...(payment.method === "eft" && payment.reference
            ? { eftReference: [openInvoice.eftReference, payment.reference].filter(Boolean).join(", ") }
            : {}),
        },
      }),
      prisma.paymentRequest.update({
        where: { id: paymentRequestId },
        data: { invoiceId: openInvoice.id, status: "paid", paidAmountCents: paidToDate },
      }),
    ]);
    try {
      await generateAndStoreInvoicePDF(invoice.id);
    } catch (err) {
      console.error(`Failed to generate PDF for invoice ${invoice.id}:`, err);
    }
    return invoice;
  }

  // Lenient on read: these rows may predate validation, and refusing to build an
  // invoice from a historical request would strand the money rather than bill it.
  const lineItems = readLineItems(pr.lineItems);

  // Resolve billing name/email from the payment request's linked entity or student
  let billingName = "Unknown";
  let billingEmail = "";
  let billingAddress: string | undefined;
  let billingVatNumber: string | undefined;

  if (pr.billingEntity) {
    billingName = pr.billingEntity.name;
    billingEmail = pr.billingEntity.email;
    billingAddress = pr.billingEntity.address ?? undefined;
    billingVatNumber = pr.billingEntity.vatNumber ?? undefined;
  } else if (pr.student) {
    billingName = `${pr.student.firstName} ${pr.student.lastName}`;
    billingEmail = pr.student.billingEmail ?? pr.student.email;
    billingAddress = pr.student.billingAddress ?? undefined;
  }

  const invoice = await createInvoiceRecord({
    type: "monthly_postpaid",
    studentId: pr.studentId ?? undefined,
    billingEntityId: pr.billingEntityId ?? undefined,
    billingName,
    billingEmail,
    billingAddress,
    billingVatNumber,
    currency: pr.currency,
    lineItems,
    // The request's own discount — since 2026-09-30 that is where a credit for a billed session
    // cancelled in time lives (a line total cannot be negative). Not passing it made the tax
    // invoice total more than the request the client paid.
    invoiceDiscountCents: pr.discountCents || undefined,
    paymentMethod: payment.method,
    paystackReference: payment.method === "paystack" ? payment.reference : undefined,
    eftReference: payment.method === "eft" ? payment.reference : undefined,
    paidAmountCents: paidToDate,
    paymentRequestId: pr.id,
    periodStart: pr.periodStart,
    periodEnd: pr.periodEnd,
    billingMonth: pr.billingMonth,
    status: "paid",
  });

  // Link the invoice back to the payment request and mark it paid.
  //
  // paidAmountCents is stamped on the FULL-payment path too, not just on the short
  // payment the webhook rejects. If only shortfalls populated it, "null" would mean
  // two different things — nothing received, or paid in full — and the column would
  // be unreadable without cross-checking the status. It means one thing: what we
  // actually received to date — a request that took R600 short via Paystack and is
  // settled later must not read as though only the settling payment ever arrived.
  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: {
      invoiceId: invoice.id,
      status: "paid",
      paidAmountCents: paidToDate,
    },
  });

  return invoice;
}

/**
 * Create a manual invoice (admin marks session as paid via EFT/cash).
 *
 * It records the payment in the audit trail itself, because every caller is an admin recording
 * money received and none of the three did (ad-hoc invoice, late-cancel fee, historical booking).
 * Payment recording is on CLAUDE.md §4's audit-worthy list; the audit check reads action bodies,
 * so a write one file away went unseen (walk-oct-batch 03, F4).
 */
export async function createManualInvoice(params: {
  actorEmail: string;
  type: string;
  studentId?: string;
  billingEntityId?: string;
  lineItems: InvoiceLineItem[];
  paymentMethod: "eft" | "cash" | "card";
  paymentReference?: string;
  currency?: string;
  invoiceDiscountPercent?: number;
  invoiceDiscountCents?: number;
  sessionType?: "individual" | "couples" | "free_consultation";
}): Promise<Invoice> {
  // Do NOT default to "ZAR". The VAT gate in createInvoiceRecord is only as
  // honest as the currency it is handed, and ZAR is the one value that turns VAT
  // ON — so a caller that omits currency would fail OPEN: an international
  // client's late-cancellation fee stamped in Rands, with 15% SA VAT on an
  // exported service. Fall back to the client's established currency instead.
  const currency =
    params.currency ??
    (params.studentId ? await resolveClientCurrency(params.studentId) : "ZAR");

  let billingName = "Unknown";
  let billingEmail = "";
  let billingAddress: string | undefined;
  let billingVatNumber: string | undefined;

  if (params.studentId) {
    const contact = await resolveBillingContact(params.studentId, params.sessionType);
    billingName = contact.name;
    billingEmail = contact.email;
    billingAddress = contact.address;
    billingVatNumber = contact.vatNumber;
  } else if (params.billingEntityId) {
    const entity = await prisma.billingEntity.findUniqueOrThrow({
      where: { id: params.billingEntityId },
    });
    billingName = entity.name;
    billingEmail = entity.email;
    billingAddress = entity.address ?? undefined;
    billingVatNumber = entity.vatNumber ?? undefined;
  }

  const invoice = await createInvoiceRecord({
    type: params.type,
    studentId: params.studentId,
    billingEntityId: params.billingEntityId,
    billingName,
    billingEmail,
    billingAddress,
    billingVatNumber,
    currency,
    lineItems: params.lineItems,
    invoiceDiscountPercent: params.invoiceDiscountPercent,
    invoiceDiscountCents: params.invoiceDiscountCents,
    paymentMethod: params.paymentMethod,
    eftReference: params.paymentMethod === "eft" ? params.paymentReference : undefined,
    status: "paid",
  });

  await recordAudit({
    action: "payment_recorded",
    entityType: "invoice",
    entityId: invoice.id,
    actorEmail: params.actorEmail,
    before: null,
    after: { status: "paid", paymentMethod: params.paymentMethod, reference: params.paymentReference ?? null, totalCents: invoice.totalCents, currency },
    metadata: { studentId: params.studentId ?? null, billingEntityId: params.billingEntityId ?? null, source: params.type },
  });

  return invoice;
}
