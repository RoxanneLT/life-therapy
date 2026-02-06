import { getStripe } from "@/lib/stripe";
import { processCheckoutCompleted } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { orderConfirmationEmail } from "@/lib/email-templates";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events.
 * CRITICAL: Uses raw body for signature verification.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      console.error("Webhook: No orderId in session metadata");
      return new Response("OK", { status: 200 });
    }

    try {
      // Process the order (idempotent — safe to call multiple times)
      const order = await processCheckoutCompleted(orderId);

      // Store payment intent ID
      if (session.payment_intent && typeof session.payment_intent === "string") {
        await prisma.order.update({
          where: { id: orderId },
          data: { stripePaymentIntent: session.payment_intent },
        });
      }

      // Send confirmation email to the buyer
      if (order) {
        const fullOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: true,
            student: true,
          },
        });

        if (fullOrder) {
          const { subject, html } = orderConfirmationEmail(fullOrder);
          await sendEmail({
            to: fullOrder.student.email,
            subject,
            html,
          }).catch((err) =>
            console.error("Failed to send order confirmation:", err)
          );
        }
      }
    } catch (err) {
      console.error("Webhook: Failed to process checkout:", err);
      // Return 200 anyway to prevent Stripe retries for processing errors
      // The order can be reconciled later
    }
  }

  return new Response("OK", { status: 200 });
}
