import { verifyWebhookSignature } from "@/lib/paystack";
import { settleOrderPayment } from "@/lib/order-paid";
import { prisma } from "@/lib/prisma";
import { createInvoiceFromPaymentRequest } from "@/lib/create-invoice";
import { recordAudit } from "@/lib/audit";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { sendInvoiceEmail } from "@/lib/send-invoice";
import { loadRequestAmounts, receivedCents } from "@/lib/billing";
import { refreshPaymentLink } from "@/lib/payment-request-link";
import type { Prisma } from "@/lib/generated/prisma/client";

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

        if (pr?.status === "paid" || pr?.status === "cancelled") {
          // A retry of the charge that settled it is skipped. Any other charge is real money on a
          // closed request (a second tab, an old link, a request marked paid by hand or voided).
          // The paid return dropped it without a trace (walk-oct-payments 01, F2), and a voided
          // request was settled as if it were owed (walk-oct-payments-2, W5).
          if (!(await counted("payment_request", paymentRequestId, data.reference))) {
            const { received } = await loadRequestAmounts(pr);
            await recordOverpayment("payment_request", paymentRequestId, closedRow(pr, received, data.amount), data.reference);
          }
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
          // The audit row is also the retry marker (partRecorded), so it is written in the same
          // transaction as the money: written after it, a failed audit let a redelivery add the
          // payment twice (walk-oct-payments 01, F4).
          await prisma.$transaction([
            prisma.paymentRequest.update({
              where: { id: paymentRequestId },
              data: { paidAmountCents: paidToDate, paystackReference: data.reference },
            }),
            ...(pr.invoiceId
              ? [prisma.invoice.update({ where: { id: pr.invoiceId }, data: { paidAmountCents: paidToDate } })]
              : []),
            shortfallMarker("payment_request", paymentRequestId, {
              expectedCents: pr.totalCents,
              receivedCents: data.amount,
              paidToDateCents: paidToDate,
              shortfallCents,
              currency: pr.currency,
              reference: data.reference,
              studentId: pr.studentId,
              note: "Part payment: the balance is still owed, and the stored payment link is now for it.",
            }),
          ]);
          // The stored link is what the pro-forma and the reminders send; it still charges the old amount.
          await refreshPaymentLink(paymentRequestId);
          // 200 so Paystack stops retrying — the money is real and recorded above.
          // The request deliberately stays unsettled so it keeps showing as owing.
          return new Response("OK", { status: 200 });
        }

        if (pr && shortfallCents < 0) {
          await recordOverpayment("payment_request", paymentRequestId, { owedCents: pr.totalCents, paidToDateCents: paidToDate, currency: pr.currency, note: OVERPAID }, data.reference);
        }

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
        // Not 200: Paystack retries until it gets one, and every write above is safe to repeat
        // (the marker, the invoice found by reference, the paid-row check). A 200 here dropped it.
        console.error("Paystack webhook PR error:", err);
        return new Response("Payment request not recorded", { status: 500 });
      }
    }

    // ── Direct invoice payment ─────────────────────────────
    if (invoiceId) {
      try {
        const existing = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { status: true, totalCents: true, currency: true, paidAmountCents: true, paymentRequestId: true },
        });

        // The request this invoice belongs to, if any: settling the invoice settles it too, so a
        // voided request closes the invoice as well. Reading the invoice's status alone let a
        // charge mark a cancelled request paid (walk-oct-payments-2 02, N2).
        const parent = existing?.paymentRequestId
          ? await prisma.paymentRequest.findUnique({ where: { id: existing.paymentRequestId }, select: { status: true, paidAmountCents: true } })
          : null;
        const closedAs = parent?.status === "cancelled" ? "cancelled" : existing?.status;
        if (existing && closedAs && ["paid", "cancelled", "credited"].includes(closedAs)) {
          // As for a request above: a retry is skipped, other money on a closed invoice is recorded.
          if (!(await counted("invoice", invoiceId, data.reference))) {
            const received = receivedCents(parent ?? { paidAmountCents: null }, existing);
            await recordOverpayment("invoice", invoiceId, closedRow({ ...existing, status: closedAs }, received, data.amount), data.reference);
          }
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
          // In one transaction with its retry marker, as on the request path.
          await prisma.$transaction([
            prisma.invoice.update({
              where: { id: invoiceId },
              data: {
                paidAmountCents: invPaidToDate,
                paystackReference: data.reference,
                paymentMethod: "paystack",
              },
            }),
            ...(request
              ? [prisma.paymentRequest.update({ where: { id: request.id }, data: { paidAmountCents: invPaidToDate } })]
              : []),
            shortfallMarker("invoice", invoiceId, {
              expectedCents: existing.totalCents,
              receivedCents: data.amount,
              paidToDateCents: invPaidToDate,
              shortfallCents: invShortfall,
              currency: existing.currency,
              reference: data.reference,
              note: "Part payment: the balance is still owed.",
            }),
          ]);
          if (request) await refreshPaymentLink(request.id);
          return new Response("OK", { status: 200 });
        }

        if (existing && invShortfall < 0) {
          await recordOverpayment("invoice", invoiceId, { owedCents: existing.totalCents, paidToDateCents: invPaidToDate, currency: existing.currency, note: OVERPAID }, data.reference);
        }

        // Both rows or neither: written apart, a failure between them left a paid invoice beside a
        // request still chased, and the retry saw the invoice paid and stopped (walk-oct-payments-2, W3).
        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: "paid",
              paidAt: new Date(),
              paystackReference: data.reference,
              paymentMethod: "paystack",
              paidAmountCents: invPaidToDate,
              paymentUrl: null,
            },
          }),
          ...(request
            ? [prisma.paymentRequest.update({ where: { id: request.id }, data: { status: "paid", paidAmountCents: invPaidToDate, invoiceId } })]
            : []),
        ]);

        await generateAndStoreInvoicePDF(invoiceId).catch((err) =>
          console.error("Failed to generate invoice PDF:", err),
        );

        await sendInvoiceEmail(invoiceId).catch((err) =>
          console.error("Failed to send invoice email:", err),
        );
      } catch (err) {
        // Retried, as on the request path above.
        console.error("Paystack webhook invoice error:", err);
        return new Response("Invoice payment not recorded", { status: 500 });
      }
    }

    if (!orderId && !paymentRequestId && !invoiceId) {
      console.warn("Paystack webhook: charge.success with no recognized metadata", data.metadata);
    }
  }

  return new Response("OK", { status: 200 });
}

type Entity = "payment_request" | "invoice";

/** A part payment already added by an earlier delivery of this webhook (Paystack retries until it gets a 200). */
async function partRecorded(entityType: Entity, entityId: string, reference: string): Promise<boolean> {
  return !!(await markerFor(["payment_shortfall"], entityType, entityId, reference));
}

/**
 * This charge is already on the books: it settled an invoice, or an earlier delivery recorded it as
 * a part payment or an overpayment.
 *
 * "Settled" is a paid invoice whose METHOD is Paystack with this reference. The reference alone is
 * not proof: a link stores it on the invoice when it is made, before any money moves, so an invoice
 * then marked paid by EFT still carried it, and the late charge read as already counted
 * (walk-oct-payments-2, W1).
 */
async function counted(entityType: Entity, entityId: string, reference: string): Promise<boolean> {
  const settledBy = await prisma.invoice.findFirst({
    where: { paystackReference: reference, status: "paid", paymentMethod: "paystack" },
    select: { id: true },
  });
  return !!settledBy || !!(await markerFor(["payment_shortfall", "payment_overpaid"], entityType, entityId, reference));
}

function markerFor(actions: string[], entityType: Entity, entityId: string, reference: string) {
  return prisma.auditLog.findFirst({
    where: { action: { in: actions }, entityType, entityId, metadata: { path: ["reference"], equals: reference } },
    select: { id: true },
  });
}

/**
 * The part payment's audit row, built to run inside the transaction that writes the money, since it
 * is also the retry marker. Written directly, not through recordAudit, which swallows its own
 * failure; the metadata is amounts and ids, nothing recordAudit would mask.
 */
function shortfallMarker(entityType: Entity, entityId: string, metadata: Prisma.InputJsonObject) {
  return prisma.auditLog.create({
    data: { action: "payment_shortfall", entityType, entityId, actorEmail: "paystack-webhook", metadata },
  });
}

const OVERPAID = "More was received than owed. Refund or credit the difference by hand.";

type Overpayment = { owedCents: number; paidToDateCents: number; currency: string | null; note: string };

/**
 * A charge on a row that is closed. A paid row is owed nothing more, and counts as paid in full even
 * where an admin's mark-paid wrote no amount (W1); a voided one was never owed.
 */
function closedRow(
  row: { status: string; totalCents: number; currency: string | null },
  receivedCents: number,
  amountCents: number,
): Overpayment {
  return row.status === "paid"
    ? { owedCents: row.totalCents, paidToDateCents: Math.max(receivedCents, row.totalCents) + amountCents, currency: row.currency, note: OVERPAID }
    : {
        owedCents: 0,
        paidToDateCents: amountCents,
        currency: row.currency,
        note: `Paid on a ${row.status} record, which is owed nothing. Refund it, or apply it to what replaced it.`,
      };
}

/**
 * More arrived than was owed: a link made before a part payment, two links paid, or money on a
 * closed row. The money is the client's; it is recorded for a human to refund or credit.
 */
async function recordOverpayment(entityType: Entity, entityId: string, o: Overpayment, reference: string) {
  // A retried delivery (now that a throw returns 500) must not record the same money twice.
  if (await markerFor(["payment_overpaid"], entityType, entityId, reference)) return;
  console.error(`[paystack] OVERPAYMENT on ${entityType} ${entityId}: owed ${o.owedCents}, received ${o.paidToDateCents} to date.`);
  await recordAudit({
    action: "payment_overpaid",
    entityType,
    entityId,
    actorEmail: "paystack-webhook",
    metadata: {
      expectedCents: o.owedCents,
      paidToDateCents: o.paidToDateCents,
      overpaidCents: o.paidToDateCents - o.owedCents,
      currency: o.currency,
      reference,
      note: o.note,
    },
  });
}
