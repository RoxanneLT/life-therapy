/**
 * Invoice and payment request email delivery.
 *
 * - sendInvoiceEmail: sends invoice with PDF attachment
 * - sendPaymentRequestEmail: sends payment request with pro-forma PDF attached
 * - sendPaymentReminder: friendly reminder before due date (pro-forma re-attached)
 * - sendDueTodayNotice: due today notice (pro-forma re-attached)
 * - sendOverdueNotice: overdue notice after due date (pro-forma re-attached)
 */

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import type { InvoiceLineItem } from "@/lib/billing-types";

// ─── Helpers ─────────────────────────────────────────────────

function fmt(cents: number, currency = "ZAR"): string {
  return formatPrice(cents, currency);
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "d MMMM yyyy");
}

function buildSessionSummaryHtml(lineItems: InvoiceLineItem[], currency = "ZAR"): string {
  const rows = lineItems
    .map(
      (item) =>
        `<tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">${item.description}${item.subLine ? `<br><span style="font-size: 12px; color: #6b7280;">${item.subLine}</span>` : ""}</td>
          <td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">${fmt(item.totalCents, currency)}</td>
        </tr>`,
    )
    .join("");

  return `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">${rows}</table>`;
}

/**
 * Generate pro-forma PDF for a payment request and return as a buffer.
 * Non-fatal: returns undefined if generation fails.
 */
async function tryGenerateProformaPDF(
  paymentRequestId: string,
): Promise<Buffer | undefined> {
  try {
    const { generateAndStoreProformaPDF } = await import("@/lib/generate-invoice-pdf");
    await generateAndStoreProformaPDF(paymentRequestId);
    // Re-download from storage to get the buffer for email attachment
    const { data, error } = await supabaseAdmin.storage
      .from("invoices")
      .download(`proforma/${paymentRequestId}.pdf`);
    if (error || !data) return undefined;
    return Buffer.from(await data.arrayBuffer());
  } catch (err) {
    console.error(`Pro-forma PDF generation failed for PR ${paymentRequestId}:`, err);
    return undefined;
  }
}

function buildProformaFilename(billingName: string, periodEnd: Date): string {
  const monthLabel = format(periodEnd, "MMMM_yyyy");
  const initials = billingName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
  return `ProForma_${monthLabel}_${initials}.pdf`;
}

// ─── Send Invoice Email ──────────────────────────────────────

/**
 * Send an invoice email with the PDF attached.
 * Fetches the PDF from Supabase Storage and attaches it.
 */
export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  let pdfBuffer: Buffer | undefined;
  if (invoice.pdfUrl) {
    const { data, error } = await supabaseAdmin.storage
      .from("invoices")
      .download(invoice.pdfUrl);
    if (!error && data) {
      pdfBuffer = Buffer.from(await data.arrayBuffer());
    }
  }

  const { subject, html } = await renderEmail("invoice", {
    billingName: invoice.billingName,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: fmtDate(invoice.issuedAt || invoice.createdAt),
    total: fmt(invoice.totalCents, invoice.currency),
    isReplacingProforma: invoice.paymentRequestId ? "true" : "false",
  });

  await sendEmail({
    to: invoice.billingEmail,
    subject,
    html,
    templateKey: "invoice",
    studentId: invoice.studentId ?? undefined,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    ...(pdfBuffer
      ? {
          attachments: [
            {
              filename: `${invoice.invoiceNumber}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        }
      : {}),
  });
}

// ─── Send Payment Request Email ──────────────────────────────

/**
 * Send the initial payment request email with session summary, Pay Now link,
 * and pro-forma invoice PDF attached.
 * Updates sentAt on the PaymentRequest.
 */
export async function sendPaymentRequestEmail(paymentRequestId: string): Promise<void> {
  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
  });

  const lineItems = pr.lineItems as unknown as InvoiceLineItem[];
  const monthLabel = format(new Date(pr.periodEnd), "MMMM yyyy");

  let billingName = "Client";
  let to = "";

  if (pr.studentId) {
    const student = await prisma.student.findUnique({ where: { id: pr.studentId } });
    if (student) {
      billingName = `${student.firstName} ${student.lastName}`;
      to = student.billingEmail ?? student.email;
    }
  } else if (pr.billingEntityId) {
    const entity = await prisma.billingEntity.findUnique({ where: { id: pr.billingEntityId } });
    if (entity) {
      billingName = entity.contactPerson || entity.name;
      to = entity.email;
    }
  }

  if (!to) {
    console.error(`No email for payment request ${paymentRequestId}`);
    return;
  }

  // Generate and store pro-forma PDF, attach to email
  const pdfBuffer = await tryGenerateProformaPDF(paymentRequestId);
  const pdfFilename = buildProformaFilename(billingName, new Date(pr.periodEnd));

  const { subject, html } = await renderEmail("payment_request", {
    billingName,
    month: monthLabel,
    sessionSummary: buildSessionSummaryHtml(lineItems, pr.currency),
    total: fmt(pr.totalCents, pr.currency),
    dueDate: fmtDate(pr.dueDate),
    paymentUrl: pr.paymentUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
  });

  await sendEmail({
    to,
    subject,
    html,
    templateKey: "payment_request",
    studentId: pr.studentId ?? undefined,
    metadata: { paymentRequestId: pr.id, billingMonth: pr.billingMonth },
    ...(pdfBuffer
      ? {
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        }
      : {}),
  });

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { sentAt: new Date() },
  });
}

// ─── Send Payment Reminder ───────────────────────────────────

/**
 * Send a friendly reminder 2 business days before due date.
 * Re-attaches pro-forma PDF so client has the document.
 * Updates reminderSentAt on the PaymentRequest.
 */
export async function sendPaymentReminder(paymentRequestId: string): Promise<void> {
  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
  });

  if (pr.reminderSentAt) return;

  let billingName = "Client";
  let to = "";

  if (pr.studentId) {
    const student = await prisma.student.findUnique({ where: { id: pr.studentId } });
    if (student) {
      billingName = `${student.firstName} ${student.lastName}`;
      to = student.billingEmail ?? student.email;
    }
  } else if (pr.billingEntityId) {
    const entity = await prisma.billingEntity.findUnique({ where: { id: pr.billingEntityId } });
    if (entity) {
      billingName = entity.contactPerson || entity.name;
      to = entity.email;
    }
  }

  if (!to) return;

  const pdfBuffer = await tryGenerateProformaPDF(paymentRequestId);
  const pdfFilename = buildProformaFilename(billingName, new Date(pr.periodEnd));

  const { subject, html } = await renderEmail("payment_request_reminder", {
    billingName,
    total: fmt(pr.totalCents, pr.currency),
    dueDate: fmtDate(pr.dueDate),
    paymentUrl: pr.paymentUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
  });

  await sendEmail({
    to,
    subject,
    html,
    templateKey: "payment_request_reminder",
    studentId: pr.studentId ?? undefined,
    metadata: { paymentRequestId: pr.id },
    ...(pdfBuffer
      ? { attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" }] }
      : {}),
  });

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { reminderSentAt: new Date() },
  });
}

// ─── Send Due Today Notice ───────────────────────────────────

/**
 * Send a "due today" notice on the actual due date.
 * Re-attaches pro-forma PDF.
 */
export async function sendDueTodayNotice(paymentRequestId: string): Promise<void> {
  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
  });

  if (pr.dueTodaySentAt) return;

  let billingName = "Client";
  let to = "";

  if (pr.studentId) {
    const student = await prisma.student.findUnique({ where: { id: pr.studentId } });
    if (student) {
      billingName = `${student.firstName} ${student.lastName}`;
      to = student.billingEmail ?? student.email;
    }
  } else if (pr.billingEntityId) {
    const entity = await prisma.billingEntity.findUnique({ where: { id: pr.billingEntityId } });
    if (entity) {
      billingName = entity.contactPerson || entity.name;
      to = entity.email;
    }
  }

  if (!to) return;

  const pdfBuffer = await tryGenerateProformaPDF(paymentRequestId);
  const pdfFilename = buildProformaFilename(billingName, new Date(pr.periodEnd));

  const { subject, html } = await renderEmail("payment_request_due_today", {
    billingName,
    total: fmt(pr.totalCents, pr.currency),
    paymentUrl: pr.paymentUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
  });

  await sendEmail({
    to,
    subject,
    html,
    templateKey: "payment_request_due_today",
    studentId: pr.studentId ?? undefined,
    metadata: { paymentRequestId: pr.id },
    ...(pdfBuffer
      ? { attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" }] }
      : {}),
  });

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { dueTodaySentAt: new Date() },
  });
}

// ─── Send Overdue Notice ─────────────────────────────────────

/**
 * Send an overdue notice 1 business day after due date.
 * Re-attaches pro-forma so the client always has the document when chasing payment.
 * Updates overdueSentAt and sets status to "overdue".
 */
export async function sendOverdueNotice(paymentRequestId: string): Promise<void> {
  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
  });

  if (pr.overdueSentAt) return;

  const monthLabel = format(new Date(pr.periodEnd), "MMMM yyyy");

  let billingName = "Client";
  let to = "";

  if (pr.studentId) {
    const student = await prisma.student.findUnique({ where: { id: pr.studentId } });
    if (student) {
      billingName = `${student.firstName} ${student.lastName}`;
      to = student.billingEmail ?? student.email;
    }
  } else if (pr.billingEntityId) {
    const entity = await prisma.billingEntity.findUnique({ where: { id: pr.billingEntityId } });
    if (entity) {
      billingName = entity.contactPerson || entity.name;
      to = entity.email;
    }
  }

  if (!to) return;

  const pdfBuffer = await tryGenerateProformaPDF(paymentRequestId);
  const pdfFilename = buildProformaFilename(billingName, new Date(pr.periodEnd));

  const { subject, html } = await renderEmail("payment_request_overdue", {
    billingName,
    month: monthLabel,
    total: fmt(pr.totalCents, pr.currency),
    paymentUrl: pr.paymentUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
  });

  await sendEmail({
    to,
    subject,
    html,
    templateKey: "payment_request_overdue",
    studentId: pr.studentId ?? undefined,
    metadata: { paymentRequestId: pr.id },
    ...(pdfBuffer
      ? { attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" }] }
      : {}),
  });

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { overdueSentAt: new Date(), status: "overdue" },
  });
}
