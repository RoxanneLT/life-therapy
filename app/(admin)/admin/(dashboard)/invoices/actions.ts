"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { sendInvoiceEmail } from "@/lib/send-invoice";
import { saDateStr, saDayStart, addSaDays } from "@/lib/dates";
import { resolveClientCurrencies, receivedCents } from "@/lib/billing";

// ────────────────────────────────────────────────────────────
// Mark invoice as paid (from invoice list page)
// ────────────────────────────────────────────────────────────

export async function markInvoicePaidFromListAction(
  invoiceId: string,
  method: string,
  reference?: string,
) {
  const { adminUser } = await requireRole("super_admin");

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paymentMethod: method,
      eftReference: method === "eft" ? reference : undefined,
      paidAt: new Date(),
    },
    select: { paymentRequestId: true, studentId: true },
  });

  if (invoice.paymentRequestId) {
    await prisma.paymentRequest.update({
      where: { id: invoice.paymentRequestId },
      data: { status: "paid" },
    });
  }

  await recordAudit({
    action: "payment_recorded",
    entityType: "invoice",
    entityId: invoiceId,
    actorEmail: adminUser.email,
    before: { status: "pending" },
    after: { status: "paid", paymentMethod: method, reference: reference ?? null },
    metadata: { studentId: invoice.studentId, source: "invoice_list" },
  });

  revalidatePath("/admin/invoices");
  if (invoice.studentId) {
    revalidatePath(`/admin/clients/${invoice.studentId}`);
  }
}

// ────────────────────────────────────────────────────────────
// Void invoice (from invoice list page)
// ────────────────────────────────────────────────────────────

export async function voidInvoiceFromListAction(invoiceId: string) {
  const { adminUser } = await requireRole("super_admin");

  const prevInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, paidAmountCents: true },
  });

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "cancelled" },
    select: { studentId: true },
  });

  // Only release the bookings if no money arrived — see voidInvoiceAction for
  // the full reasoning. The list view hides Void on a "paid" invoice, but a
  // partly-paid one is not "paid", and that is the case that re-bills a client
  // for a session they have already put money towards.
  const moneyReceived =
    (prevInvoice?.paidAmountCents ?? 0) > 0 ||
    prevInvoice?.status === "paid" ||
    prevInvoice?.status === "credited";

  let released = 0;
  if (!moneyReceived) {
    const res = await prisma.booking.updateMany({
      where: { invoiceId },
      data: { invoiceId: null, paymentRequestId: null },
    });
    released = res.count;
  }

  await recordAudit({
    action: "invoice_voided",
    entityType: "invoice",
    entityId: invoiceId,
    actorEmail: adminUser.email,
    before: { status: prevInvoice?.status ?? null },
    after: { status: "cancelled" },
    metadata: {
      studentId: invoice.studentId,
      source: "invoice_list",
      paidAmountCents: prevInvoice?.paidAmountCents ?? 0,
      bookingsReleased: released,
      bookingsKeptLinked: moneyReceived,
    },
  });

  revalidatePath("/admin/invoices");
  if (invoice.studentId) {
    revalidatePath(`/admin/clients/${invoice.studentId}`);
  }
}

// ────────────────────────────────────────────────────────────
// Resend invoice (from invoice list page)
// ────────────────────────────────────────────────────────────

export async function resendInvoiceFromListAction(invoiceId: string) {
  await requireRole("super_admin");

  await generateAndStoreInvoicePDF(invoiceId);
  await sendInvoiceEmail(invoiceId);

  revalidatePath("/admin/invoices");
}

// ────────────────────────────────────────────────────────────
// Payment Requests — Mark as paid (creates invoice + PDF + email)
// ────────────────────────────────────────────────────────────

export async function markPaymentRequestPaidFromListAction(
  paymentRequestId: string,
  method: string,
  amountCents: number,
  reference?: string,
) {
  const { adminUser } = await requireRole("super_admin");

  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
  });

  // Check if an invoice already exists for this PR (from a prior partial payment)
  const existingInvoice = await prisma.invoice.findFirst({
    where: { paymentRequestId },
  });

  // Money that arrived BEFORE this payment. A Paystack short payment records
  // itself on the request and creates no invoice at all, so reading the invoice
  // alone lost it: a R1000 request that took R600 by card and R400 by EFT stayed
  // "pending, R600 short" forever, and no tax invoice was ever sent.
  const alreadyReceived = receivedCents(pr, existingInvoice);

  const auditPayment = (fullyPaid: boolean) =>
    recordAudit({
      action: "payment_recorded",
      entityType: "payment_request",
      entityId: paymentRequestId,
      actorEmail: adminUser.email,
      before: { status: "pending" },
      after: { status: fullyPaid ? "paid" : "partial", paymentMethod: method, reference: reference ?? null },
      metadata: {
        studentId: pr.studentId,
        amountCents,
        // What this payment brings the request to, so a part-paid request can be
        // reconstructed from the trail without replaying every entry.
        paidToDateCents: alreadyReceived + amountCents,
        totalCents: pr.totalCents,
        currency: pr.currency,
        source: "invoice_list",
      },
    });

  if (existingInvoice) {
    // Update existing invoice with additional payment
    const newPaidAmount = alreadyReceived + amountCents;
    const isFullyPaid = newPaidAmount >= pr.totalCents;

    await prisma.invoice.update({
      where: { id: existingInvoice.id },
      data: {
        paidAmountCents: newPaidAmount,
        status: isFullyPaid ? "paid" : "payment_requested",
        paidAt: isFullyPaid ? new Date() : existingInvoice.paidAt,
        paymentMethod: method,
        eftReference: method === "eft" ? [existingInvoice.eftReference, reference].filter(Boolean).join(", ") : existingInvoice.eftReference,
      },
    });

    // The running total belongs on the request too, not only on the invoice —
    // it is what the reminder/overdue emails and the pro-forma read.
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: {
        paidAmountCents: newPaidAmount,
        ...(isFullyPaid ? { status: "paid" } : {}),
      },
    });

    await generateAndStoreInvoicePDF(existingInvoice.id).catch(console.error);
    // Only send email on full payment
    if (isFullyPaid) {
      await sendInvoiceEmail(existingInvoice.id).catch(console.error);
    }

    await auditPayment(isFullyPaid);
    revalidatePath("/admin/invoices");
    return;
  }

  // No existing invoice — create one
  const { createInvoiceFromPaymentRequest } = await import("@/lib/create-invoice");

  const invoice = await createInvoiceFromPaymentRequest(paymentRequestId, {
    reference: reference || `manual-${Date.now()}`,
    method: method as "eft" | "cash" | "card",
    amountCents,
  });

  // Settlement is judged on everything received, not on this payment alone —
  // otherwise the EFT that finishes off a Paystack short payment reads as another
  // partial and the request never closes.
  const newPaidAmount = alreadyReceived + amountCents;
  const isPartial = newPaidAmount < pr.totalCents;

  // Partial payment: keep PR pending, invoice shows what has been received so far
  if (isPartial) {
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "pending", paidAmountCents: newPaidAmount },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "payment_requested",
        paidAmountCents: newPaidAmount,
      },
    });
  } else if (newPaidAmount > amountCents) {
    // Settled, but earlier money made up part of it — record the true total on
    // both rows so the invoice does not understate what was paid for it.
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { paidAmountCents: newPaidAmount },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paidAmountCents: newPaidAmount },
    });
  }

  await generateAndStoreInvoicePDF(invoice.id).catch(console.error);
  // Only on settlement, matching the branch above: a tax invoice emailed for a
  // request that is still short tells the client they are square when they are not.
  if (!isPartial) {
    await sendInvoiceEmail(invoice.id).catch(console.error);
  }

  await auditPayment(!isPartial);
  revalidatePath("/admin/invoices");
}

// ────────────────────────────────────────────────────────────
// Payment Requests — hold the chase while money is in flight
// ────────────────────────────────────────────────────────────

/** Default hold: long enough for an EFT to clear, short enough that a forgotten
 *  pause does not quietly become a permanently unchased invoice. */
const CHASE_PAUSE_DAYS = 7;

/**
 * "Payment expected" — stop chasing for a week without pretending money arrived.
 *
 * The overdue notice repeats weekly now. That is right for an invoice nobody has
 * answered and wrong for one paid yesterday by EFT that cannot be recorded until
 * it reflects: the client gets chased for money they have already sent, which is
 * the single worst thing an automated chaser can do. Recording a payment that has
 * not cleared would be worse — it would report income that is not there — and
 * voiding the request loses the debt entirely. So: a hold, stated as a hold.
 */
export async function pauseChaseAction(paymentRequestId: string, days = CHASE_PAUSE_DAYS) {
  const { adminUser } = await requireRole("super_admin", "editor");

  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: { status: true, chasePausedUntil: true, studentId: true, totalCents: true },
  });
  if (!pr) return { success: false, error: "That payment request no longer exists." };
  if (pr.status === "paid" || pr.status === "cancelled") {
    return { success: false, error: `This request is already ${pr.status} — nothing is chasing it.` };
  }

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { chasePausedUntil: until },
  });

  await recordAudit({
    action: "chase_paused",
    entityType: "payment_request",
    entityId: paymentRequestId,
    actorEmail: adminUser.email,
    before: { chasePausedUntil: pr.chasePausedUntil?.toISOString() ?? null },
    after: { chasePausedUntil: until.toISOString() },
    metadata: { studentId: pr.studentId, days, totalCents: pr.totalCents },
  });

  revalidatePath("/admin/invoices");
  return { success: true, until: until.toISOString() };
}

/** Resume chasing — for when the expected payment did not turn up. */
export async function resumeChaseAction(paymentRequestId: string) {
  const { adminUser } = await requireRole("super_admin", "editor");

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { chasePausedUntil: null },
  });

  await recordAudit({
    action: "chase_resumed",
    entityType: "payment_request",
    entityId: paymentRequestId,
    actorEmail: adminUser.email,
    after: { chasePausedUntil: null },
  });

  revalidatePath("/admin/invoices");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Payment Requests — Resend email
// ────────────────────────────────────────────────────────────

export async function resendPaymentRequestEmailAction(paymentRequestId: string) {
  await requireRole("super_admin");

  const { sendPaymentRequestEmail } = await import("@/lib/send-invoice");
  await sendPaymentRequestEmail(paymentRequestId);

  revalidatePath("/admin/invoices");
}

// ────────────────────────────────────────────────────────────
// Client search for billing (used by global New PR dialog)
// ────────────────────────────────────────────────────────────

export async function searchClientsForBillingAction(query: string) {
  await requireRole("super_admin");

  if (!query.trim()) return [];

  const clients = await prisma.student.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { billingEmail: { contains: query, mode: "insensitive" } },
      ],
      clientStatus: { not: "archived" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      billingEmail: true,
      standingDiscountPercent: true,
      standingDiscountFixed: true,
    },
    take: 10,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  // Carry each client's billing currency, so the compose dialog labels amounts in
  // the currency the request will ACTUALLY be created in. Without it the dialog
  // showed "R" while the server stamped USD — the admin was told one thing and the
  // client billed another.
  const currencies = await resolveClientCurrencies(clients.map((c) => c.id));
  const byId = new Map(currencies.map((c) => [c.studentId, c.currency]));
  return clients.map((c) => ({ ...c, currency: byId.get(c.id) ?? "ZAR" }));
}

// ────────────────────────────────────────────────────────────
// CSV Export
// ────────────────────────────────────────────────────────────

interface ExportFilters {
  financialYear?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
}

export async function exportInvoicesCsvAction(
  filters: ExportFilters,
): Promise<string> {
  await requireRole("super_admin");

  const where: Record<string, unknown> = {};

  // `createdAt` is a real instant, so every boundary here must be a SAST day
  // boundary (22:00 UTC the day before), not UTC or local midnight. Otherwise an
  // invoice raised at 00:30 SAST lands in the previous day — and at the 1 March
  // cutover, the previous financial year — while its exported row shows the SAST
  // date. Upper bounds are exclusive day-starts, never saDayEnd.

  // Financial year: FY2026 = 1 Mar 2025 → 28 Feb 2026
  if (filters.financialYear) {
    const fy = parseInt(filters.financialYear, 10);
    const fyStart = saDayStart(`${fy - 1}-03-01`); // March 1 of previous year
    const fyEnd = saDayStart(`${fy}-03-01`); // March 1 of FY year (exclusive)
    where.createdAt = { gte: fyStart, lt: fyEnd };
  } else if (filters.startDate || filters.endDate) {
    const range: Record<string, Date> = {};
    if (filters.startDate) range.gte = saDayStart(filters.startDate);
    // endDate is inclusive for the user, so bound by the start of the next day
    if (filters.endDate) range.lt = saDayStart(addSaDays(filters.endDate, 1));
    where.createdAt = range;
  }

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      student: { select: { firstName: true, lastName: true } },
      billingEntity: { select: { name: true } },
    },
  });

  const headers = [
    "Invoice Number",
    "Date",
    "Client",
    "Billing Contact",
    "Billing Email",
    "Type",
    "Currency",
    "Subtotal",
    "Discount",
    "VAT",
    "Total",
    "Status",
    "Payment Method",
    "Payment Date",
    "Reference",
  ];

  const rows = invoices.map((inv) => {
    const clientName = inv.student
      ? `${inv.student.firstName} ${inv.student.lastName}`
      : inv.billingEntity?.name ?? "";
    return [
      inv.invoiceNumber,
      // Resolve the SAST calendar day, not the UTC one. createdAt/paidAt are real
      // instants — paidAt comes from Paystack webhooks and can fire at any hour, so
      // a payment at 00:30 SAST would otherwise export as the previous day (and
      // reconcile into the wrong month).
      saDateStr(inv.createdAt),
      clientName,
      inv.billingName,
      inv.billingEmail,
      inv.type,
      inv.currency,
      (inv.subtotalCents / 100).toFixed(2),
      (inv.discountCents / 100).toFixed(2),
      (inv.vatAmountCents / 100).toFixed(2),
      (inv.totalCents / 100).toFixed(2),
      inv.status,
      inv.paymentMethod ?? "",
      inv.paidAt ? saDateStr(inv.paidAt) : "",
      inv.eftReference ?? inv.paystackReference ?? "",
    ];
  });

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  return csv;
}

// ────────────────────────────────────────────────────────────
// Upcoming billing: exclude / cancel sessions
// ────────────────────────────────────────────────────────────

export async function excludeFromBillingAction(bookingId: string) {
  const { adminUser } = await requireRole("super_admin", "editor");

  // Read the price BEFORE destroying it. This action sets priceZarCents to 0,
  // and without the old value in the trail there is no way to answer "what was
  // this session worth?" afterwards — the exclusion becomes unrecoverable and
  // indistinguishable from a session that was always free. The currency goes
  // with it: an amount without one means nothing here.
  const before = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { priceZarCents: true, priceCurrency: true, billingNote: true, studentId: true },
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      billingNote: "(excluded from billing — admin override)",
      priceZarCents: 0,
    },
  });

  await recordAudit({
    action: "booking_excluded_from_billing",
    entityType: "booking",
    entityId: bookingId,
    actorEmail: adminUser.email,
    before: {
      priceZarCents: before?.priceZarCents ?? null,
      billingNote: before?.billingNote ?? null,
    },
    after: { priceZarCents: 0, billingNote: "(excluded from billing — admin override)" },
    metadata: {
      studentId: before?.studentId ?? null,
      currency: before?.priceCurrency ?? null,
    },
  });

  revalidatePath("/admin/invoices");
  return { success: true };
}

export async function cancelBookingFromBillingAction(bookingId: string) {
  await requireRole("super_admin", "editor");

  const { updateBookingStatus } = await import(
    "@/app/(admin)/admin/(dashboard)/bookings/actions"
  );
  await updateBookingStatus(bookingId, "cancelled");

  revalidatePath("/admin/invoices");
  return { success: true };
}
