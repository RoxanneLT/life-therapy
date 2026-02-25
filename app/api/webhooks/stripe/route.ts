import { getStripe } from "@/lib/stripe";
import { processCheckoutCompleted } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import type { Currency } from "@/lib/region";

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
      </tr>`
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

/** Handle the checkout.session.completed Stripe event */
async function handleCheckoutCompleted(session: { metadata?: Record<string, string> | null; payment_intent?: unknown }) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error("Webhook: No orderId in session metadata");
    return;
  }

  const order = await processCheckoutCompleted(orderId);

  if (session.payment_intent && typeof session.payment_intent === "string") {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentIntent: session.payment_intent },
    });
  }

  if (order) {
    await sendOrderConfirmation(orderId).catch((err) =>
      console.error("Failed to send order confirmation:", err)
    );
  }
}

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events.
 * CRITICAL: Uses raw body for signature verification.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature header", { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      await handleCheckoutCompleted(event.data.object);
    } catch (err) {
      console.error("Webhook: Failed to process checkout:", err);
    }
  }

  return new Response("OK", { status: 200 });
}
