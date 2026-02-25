import { verifyWebhookSignature } from "@/lib/paystack";
import { processCheckoutCompleted } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import type { Currency } from "@/lib/region";
import {
  createInvoiceFromPayment,
  createInvoiceFromPaymentRequest,
  determineInvoiceType,
  buildLineItemsFromOrder,
} from "@/lib/create-invoice";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { sendInvoiceEmail } from "@/lib/send-invoice";

/** Send order confirmation email to the buyer */
async function sendOrderConfirmation(orderId: string) {
  const fullOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, student: true },
  });
  if (!fullOrder) return;

  const currency = (fullOrder.currency || "ZAR") as Currency;
  const fmt = (cents: number) => formatPrice(cents, currency);

  const orderItemsTable = fullOrder.items
    .map(
      (item) => `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${fmt(item.totalCents)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    fullOrder.discountCents > 0
      ? `<tr>
          <td colspan="2" style="padding: 4px 0; text-align: right; color: #16a34a;">Discount</td>
          <td style="padding: 4px 0; text-align: right; color: #16a34a;">-${fmt(fullOrder.discountCents)}</td>
        </tr>`
      : "";

  const { subject, html } = await renderEmail("order_confirmation", {
    firstName: fullOrder.student.firstName,
    orderNumber: fullOrder.orderNumber,
    orderDate: format(new Date(fullOrder.createdAt), "d MMMM yyyy"),
    orderItemsTable,
    subtotal: fmt(fullOrder.subtotalCents),
    discountRow,
    total: fmt(fullOrder.totalCents),
    portalUrl: "https://life-therapy.co.za/portal",
  });

  await sendEmail({
    to: fullOrder.student.email,
    subject,
    html,
    templateKey: "order_confirmation",
    studentId: fullOrder.studentId,
    metadata: { orderId: fullOrder.id, orderNumber: fullOrder.orderNumber },
  });
}

/** Generate an invoice for a completed order (best-effort, non-blocking) */
async function generateOrderInvoice(orderId: string, paystackRef: string) {
  const fullOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!fullOrder) return;

  await createInvoiceFromPayment({
    type: determineInvoiceType(fullOrder.items),
    studentId: fullOrder.studentId,
    orderId: fullOrder.id,
    amountCents: fullOrder.totalCents,
    currency: fullOrder.currency,
    paymentReference: paystackRef || fullOrder.paystackReference || "",
    paymentMethod: "paystack",
    lineItems: buildLineItemsFromOrder(fullOrder.items),
  });
}

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
        const existingOrder = await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        if (existingOrder?.status === "paid") {
          console.log(`Order ${orderId} already processed, skipping`);
          return new Response("OK", { status: 200 });
        }

        const order = await processCheckoutCompleted(orderId);

        if (order) {
          await sendOrderConfirmation(orderId).catch((err) =>
            console.error("Failed to send order confirmation:", err),
          );

          await generateOrderInvoice(orderId, data.reference).catch((err) =>
            console.error("Failed to create invoice:", err),
          );
        }
      } catch (err) {
        console.error("Paystack webhook order error:", err);
      }
    }

    // ── Payment request payment ────────────────────────────
    if (paymentRequestId) {
      try {
        const pr = await prisma.paymentRequest.findUnique({
          where: { id: paymentRequestId },
          select: { status: true },
        });

        if (pr?.status === "paid") {
          console.log(`PR ${paymentRequestId} already paid, skipping`);
          return new Response("OK", { status: 200 });
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
        console.error("Paystack webhook PR error:", err);
      }
    }

    // ── Direct invoice payment ─────────────────────────────
    if (invoiceId) {
      try {
        const existing = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { status: true },
        });

        if (existing?.status === "paid") {
          console.log(`Invoice ${invoiceId} already paid, skipping`);
          return new Response("OK", { status: 200 });
        }

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "paid",
            paidAt: new Date(),
            paystackReference: data.reference,
            paymentMethod: "paystack",
            paidAmountCents: data.amount,
            paymentUrl: null,
          },
        });

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
