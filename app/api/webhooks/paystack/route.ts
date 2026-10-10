import { verifyWebhookSignature } from "@/lib/paystack";
import { settleOrderPayment } from "@/lib/order-paid";
import { prisma } from "@/lib/prisma";
import { createInvoiceFromPaymentRequest } from "@/lib/create-invoice";
import { recordAudit } from "@/lib/audit";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { sendInvoiceEmail } from "@/lib/send-invoice";
import { loadRequestAmounts, receivedCents } from "@/lib/billing";
import { refreshPaymentLink } from "@/lib/payment-request-link";

/**
 * POST /api/webhooks/paystack
 * Handles Paystack webhook events.
 * Verifies HMAC-SHA512 signature from x-paystack-signature header.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature) {
    return new Response("Missing x-paystack-signature header", { status: 400 });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("Paystack webhook signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const data = event.data;
    const { orderId, paymentRequestId, invoiceId } = data.metadata || {};

    // ── Order payment ──────────────────────────────────────
    if (orderId) {
      try {
        // Shared with the buy-now thank-you page, which may have settled it first.
        await settleOrderPayment({
          orderId,
          amountCents: data.amount,
          currency: data.currency ?? null,
          reference: data.reference,
          actor: "paystack-webhook",
        });
      } catch (err) {
        console.error("Paystack webhook order error:", err);
      }
    }

    // ── Payment request payment ────────────────────────────
    if (paymentRequestId) {
      try {
        const pr = await prisma.paymentRequest.findUnique({
          where: { id: paymentRequestId },
          select: { status: true, totalCents: true, paidAmountCents: true, invoiceId: true, currency: true, studentId: true },
        });

        if (pr?.status === "paid") {
          console.log(`PR ${paymentRequestId} already paid, skipping`);
          return new Response("OK", { status: 200 });
        }
        // A part payment is added to what came before, so a retried webhook must not add it twice.
        if (await partRecorded("payment_request", paymentRequestId, data.reference)) {
          console.log(`PR ${paymentRequestId}: part payment ${data.reference} already recorded, skipping`);
          return new Response("OK", { status: 200 });
        }

        // Does the money that arrived, with what came before it, settle what is owed NOW?
        //
        // A link is for the balance (lib/payment-request-link.ts), so the charge that finishes a
        // part-paid request is less than its total and is judged with what was received before.
        // A link made before the request was amended carries an old amount, and this handler used
        // to stamp the request "paid" for whatever turned up, writing off the difference on an
        // invoice that then read as settled in full.
        //
        // Only compared when the currencies agree: `data.amount` is minor units of
        // the CHARGE currency, so comparing a ZAR charge against a USD total would
        // invent a shortfall that isn't there.
        const sameCurrency =
          !data.currency || !pr?.currency || data.currency === pr.currency;
        const paidToDate = (pr ? (await loadRequestAmounts(pr)).received : 0) + data.amount;
        const shortfallCents = pr && sameCurrency ? pr.totalCents - paidToDate : 0;

        if (pr && shortfallCents > 0) {
          console.error(
            `[paystack] SHORT PAYMENT on request ${paymentRequestId}: ` +
              `expected ${pr.totalCents}, received ${paidToDate} to date ${data.currency ?? ""} ` +
              `(short ${shortfallCents}). NOT marking paid.`,
          );
          // Record what arrived ON THE ROW, not only in the audit trail. Without
          // this the request read "pending, full amount owing" while the client had
          // genuinely paid most of it — a discrepancy only a human reading audit
          // entries could ever spot, and the reminder/overdue emails would chase the
          // whole amount. The linked invoice, if a part payment made one, keeps step.
          await prisma.paymentRequest.update({
            where: { id: paymentRequestId },
            data: { paidAmountCents: paidToDate, paystackReference: data.reference },
          });
          if (pr.invoiceId) {
            await prisma.invoice.update({ where: { id: pr.invoiceId }, data: { paidAmountCents: paidToDate } });
          }
          await recordAudit({
            action: "payment_shortfall",
            entityType: "payment_request",
            entityId: paymentRequestId,
            actorEmail: "paystack-webhook",
            metadata: {
              expectedCents: pr.totalCents,
              receivedCents: data.amount,
              paidToDateCents: paidToDate,
              shortfallCents,
              currency: pr.currency,
              reference: data.reference,
              studentId: pr.studentId,
              note: "Part payment: the balance is still owed, and the stored payment link is now for it.",
            },
          });
          // The stored link is what the pro-forma and the reminders send; it still charges the old amount.
          await refreshPaymentLink(paymentRequestId);
          // 200 so Paystack stops retrying — the money is real and recorded above.
          // The request deliberately stays unsettled so it keeps showing as owing.
          return new Response("OK", { status: 200 });
        }

        if (pr && shortfallCents < 0) await recordOverpayment("payment_request", paymentRequestId, pr, paidToDate, data.reference);

        const invoice = await createInvoiceFromPaymentRequest(
          paymentRequestId,
          {
            reference: data.reference,
            method: "paystack",
            amountCents: data.amount,
          },
        );

        await generateAndStoreInvoicePDF(invoice.id).catch((err) =>
          console.error("Failed to generate invoice PDF:", err),
        );

        await sendInvoiceEmail(invoice.id).catch((err) =>
          console.error("Failed to send invoice email:", err),
        );
      } catch (err) {
        console.error("Paystack webhook PR error:", err);
      }
    }

    // ── Direct invoice payment ─────────────────────────────
    if (invoiceId) {
      try {
        const existing = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { status: true, totalCents: true, currency: true, paidAmountCents: true, paymentRequestId: true },
        });

        if (existing?.status === "paid") {
          console.log(`Invoice ${invoiceId} already paid, skipping`);
          return new Response("OK", { status: 200 });
        }
        if (await partRecorded("invoice", invoiceId, data.reference)) {
          console.log(`Invoice ${invoiceId}: part payment ${data.reference} already recorded, skipping`);
          return new Response("OK", { status: 200 });
        }

        // An invoice made by a part payment on a request is the same money as the request: what
        // came before is read from both, and both rows are written (lib/billing.ts receivedCents).
        const request = existing?.paymentRequestId
          ? await prisma.paymentRequest.findUnique({ where: { id: existing.paymentRequestId }, select: { id: true, paidAmountCents: true } })
          : null;
        const invPaidToDate = (existing ? receivedCents(request ?? { paidAmountCents: null }, existing) : 0) + data.amount;

        // Same shortfall guard as the payment-request path above.
        const invSameCurrency =
          !data.currency || !existing?.currency || data.currency === existing.currency;
        const invShortfall =
          existing && invSameCurrency ? existing.totalCents - invPaidToDate : 0;

        if (existing && invShortfall > 0) {
          console.error(
            `[paystack] SHORT PAYMENT on invoice ${invoiceId}: expected ` +
              `${existing.totalCents}, received ${invPaidToDate} to date. NOT marking paid.`,
          );
          // Record what actually arrived — the invoice HAS a paidAmountCents column,
          // so the money is not lost, it is just not called settlement.
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              paidAmountCents: invPaidToDate,
              paystackReference: data.reference,
              paymentMethod: "paystack",
            },
          });
          if (request) {
            await prisma.paymentRequest.update({ where: { id: request.id }, data: { paidAmountCents: invPaidToDate } });
            await refreshPaymentLink(request.id);
          }
          await recordAudit({
            action: "payment_shortfall",
            entityType: "invoice",
            entityId: invoiceId,
            actorEmail: "paystack-webhook",
            metadata: {
              expectedCents: existing.totalCents,
              receivedCents: data.amount,
              paidToDateCents: invPaidToDate,
              shortfallCents: invShortfall,
              currency: existing.currency,
              reference: data.reference,
              note: "Part payment: the balance is still owed.",
            },
          });
          return new Response("OK", { status: 200 });
        }

        if (existing && invShortfall < 0) await recordOverpayment("invoice", invoiceId, existing, invPaidToDate, data.reference);

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "paid",
            paidAt: new Date(),
            paystackReference: data.reference,
            paymentMethod: "paystack",
            paidAmountCents: invPaidToDate,
            paymentUrl: null,
          },
        });
        if (request) {
          await prisma.paymentRequest.update({
            where: { id: request.id },
            data: { status: "paid", paidAmountCents: invPaidToDate, invoiceId },
          });
        }

        await generateAndStoreInvoicePDF(invoiceId).catch((err) =>
          console.error("Failed to generate invoice PDF:", err),
        );

        await sendInvoiceEmail(invoiceId).catch((err) =>
          console.error("Failed to send invoice email:", err),
        );
      } catch (err) {
        console.error("Paystack webhook invoice error:", err);
      }
    }

    if (!orderId && !paymentRequestId && !invoiceId) {
      console.warn("Paystack webhook: charge.success with no recognized metadata", data.metadata);
    }
  }

  return new Response("OK", { status: 200 });
}

/** A part payment already added by an earlier delivery of this webhook (Paystack retries until it gets a 200). */
async function partRecorded(entityType: "payment_request" | "invoice", entityId: string, reference: string): Promise<boolean> {
  const row = await prisma.auditLog.findFirst({
    where: { action: "payment_shortfall", entityType, entityId, metadata: { path: ["reference"], equals: reference } },
    select: { id: true },
  });
  return !!row;
}

/**
 * More arrived than was owed: a link made before a part payment, or two links paid. The money is
 * the client's; it is recorded for a human to refund or credit, and settlement goes ahead.
 */
async function recordOverpayment(
  entityType: "payment_request" | "invoice",
  entityId: string,
  row: { totalCents: number; currency: string | null },
  paidToDateCents: number,
  reference: string,
) {
  console.error(`[paystack] OVERPAYMENT on ${entityType} ${entityId}: owed ${row.totalCents}, received ${paidToDateCents} to date.`);
  await recordAudit({
    action: "payment_overpaid",
    entityType,
    entityId,
    actorEmail: "paystack-webhook",
    metadata: {
      expectedCents: row.totalCents,
      paidToDateCents,
      overpaidCents: paidToDateCents - row.totalCents,
      currency: row.currency,
      reference,
      note: "More was received than owed. Refund or credit the difference by hand.",
    },
  });
}
