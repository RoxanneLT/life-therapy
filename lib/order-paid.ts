import { prisma } from "@/lib/prisma";
import { processCheckoutCompleted } from "@/lib/order";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { formatPrice, escapeHtml } from "@/lib/utils";
import { saFormat } from "@/lib/dates";
import { getBaseUrlForCurrency, type Currency } from "@/lib/region";
import {
  createInvoiceFromPayment,
  determineInvoiceType,
  buildLineItemsFromOrder,
} from "@/lib/create-invoice";
import { recordAudit } from "@/lib/audit";
import { getSiteSettings } from "@/lib/settings";
import { paymentShortfallCents } from "@/lib/payment-shortfall";
import { createDownloadToken, downloadLinksConfigured, DOWNLOAD_LINK_DAYS } from "@/lib/download-token";

/**
 * What happens once money for an Order has arrived — whoever noticed first. Two callers: the
 * Paystack webhook, and the buy-now thank-you page, which asks Paystack itself rather than wait
 * for a webhook the buyer may beat back to the site. `processCheckoutCompleted` claims the order,
 * so exactly one of them fulfils and sends; the other gets "already".
 */
export type SettleResult = "fulfilled" | "already" | "short" | "missing";

export async function settleOrderPayment(input: {
  orderId: string;
  amountCents: number;
  currency: string | null;
  reference: string;
  actor: string;
}): Promise<SettleResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { status: true, totalCents: true, currency: true, studentId: true },
  });
  if (!order) return "missing";
  if (order.status === "paid") return "already";

  // Does the money cover the order? The payment-request and invoice branches of the webhook have
  // always asked this; the order branch never did, so any amount that arrived fulfilled it.
  const shortfallCents = paymentShortfallCents({
    expectedCents: order.totalCents,
    expectedCurrency: order.currency,
    receivedCents: input.amountCents,
    receivedCurrency: input.currency,
  });
  if (shortfallCents > 0) {
    console.error(
      `[order-paid] SHORT PAYMENT on order ${input.orderId}: expected ${order.totalCents}, ` +
        `received ${input.amountCents} ${input.currency ?? ""}. NOT fulfilling.`,
    );
    // Once per order: the thank-you page re-asks Paystack on every reload, and Paystack retries
    // webhooks, so without this one short payment fills the audit log.
    const logged = await prisma.auditLog.findFirst({
      where: { action: "payment_shortfall", entityType: "order", entityId: input.orderId },
      select: { id: true },
    });
    if (logged) return "short";
    await recordAudit({
      action: "payment_shortfall",
      entityType: "order",
      entityId: input.orderId,
      actorEmail: input.actor,
      metadata: {
        expectedCents: order.totalCents,
        receivedCents: input.amountCents,
        shortfallCents,
        currency: order.currency,
        reference: input.reference,
        studentId: order.studentId,
        note: "Order left pending. Reconcile by hand.",
      },
    });
    return "short";
  }

  // Read BEFORE fulfilment grants anything: what the buyer already owned. Buy-now does not refuse
  // an owner up front (that answer would say who bought what — see lib/guest-purchase.ts), so a
  // second purchase of the same thing is possible, and someone has to be told to refund it.
  const alreadyOwned = await prisma.digitalProductAccess.findMany({
    where: {
      studentId: order.studentId,
      digitalProduct: { orderItems: { some: { orderId: input.orderId, isGift: false } } },
    },
    select: { digitalProduct: { select: { title: true } } },
  });

  const claimed = await processCheckoutCompleted(input.orderId);
  if (!claimed) return "already";

  if (alreadyOwned.length > 0) {
    await flagDuplicatePurchase(input.orderId, input.reference, alreadyOwned.map((a) => a.digitalProduct.title)).catch(
      (err) => console.error("Failed to flag duplicate purchase:", err),
    );
  }

  await sendOrderConfirmation(input.orderId).catch((err) =>
    console.error("Failed to send order confirmation:", err),
  );
  await generateOrderInvoice(input.orderId, input.reference).catch((err) =>
    console.error("Failed to create invoice:", err),
  );
  await sendOrderDownloads(input.orderId).catch((err) =>
    console.error("Failed to send download links:", err),
  );
  return "fulfilled";
}

/** Tell the practice a buyer paid for something they already had, so it can be refunded. */
async function flagDuplicatePurchase(orderId: string, reference: string, titles: string[]) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, totalCents: true, currency: true, studentId: true, student: { select: { email: true } } },
  });
  if (!order) return;
  console.error(`[order-paid] DUPLICATE PURCHASE on order ${order.orderNumber}: already owned ${titles.join(", ")}`);
  await recordAudit({
    action: "duplicate_purchase",
    entityType: "order",
    entityId: orderId,
    actorEmail: "system",
    metadata: { orderNumber: order.orderNumber, reference, studentId: order.studentId, alreadyOwned: titles },
  });
  const settings = await getSiteSettings();
  const amount = formatPrice(order.totalCents, (order.currency || "ZAR") as Currency);
  await sendEmail({
    to: settings.email || "hello@life-therapy.co.za",
    subject: `Refund needed — ${order.orderNumber} was already owned`,
    html:
      `<p>${escapeHtml(order.student.email)} paid ${amount} for something they already had: ` +
      `<strong>${titles.map(escapeHtml).join(", ")}</strong>.</p>` +
      `<p>Order ${order.orderNumber}, Paystack reference ${escapeHtml(reference)}. ` +
      `Their download link was sent as usual. Please refund the payment in Paystack.</p>`,
    metadata: { orderId, kind: "duplicate_purchase" },
  });
}

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
    orderDate: saFormat(fullOrder.createdAt, "d MMMM yyyy"),
    orderItemsTable,
    subtotal: fmt(fullOrder.subtotalCents),
    discountRow,
    total: fmt(fullOrder.totalCents),
    portalUrl: `${getBaseUrlForCurrency(currency)}/portal`,
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
    include: { items: true, coupon: { select: { code: true } } },
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
    invoiceDiscountCents: fullOrder.discountCents || undefined,
    couponCode: fullOrder.coupon?.code || undefined,
  });
}

/** The digital products a paid order delivered to its buyer (gifts excluded — those are the recipient's). */
async function sendOrderDownloads(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      studentId: true,
      currency: true,
      items: { where: { digitalProductId: { not: null }, isGift: false }, select: { digitalProductId: true } },
    },
  });
  const productIds = order?.items.map((i) => i.digitalProductId!).filter(Boolean) ?? [];
  if (!order || productIds.length === 0) return;
  await sendDownloadLinks(order.studentId, productIds, order.currency);
}

/**
 * Email `studentId` a login-free download link for each product they own among `productIds`.
 * Sends nothing for a product they do not own, which is what makes buy-now's "resend my link"
 * safe to answer identically for every address (lib/guest-purchase.ts).
 */
export async function sendDownloadLinks(studentId: string, productIds: string[], currency: string | null) {
  if (!downloadLinksConfigured()) return;

  const [student, owned] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { email: true, firstName: true } }),
    prisma.digitalProductAccess.findMany({
      where: { studentId, digitalProductId: { in: productIds } },
      select: { digitalProduct: { select: { id: true, title: true } } },
    }),
  ]);
  if (!student || owned.length === 0) return;

  const baseUrl = getBaseUrlForCurrency(currency);
  const downloadLinks = owned
    .map(({ digitalProduct: p }) => {
      const url = `${baseUrl}/api/products/download?token=${createDownloadToken(studentId, p.id)}`;
      return `<div style="text-align: center; margin: 16px 0;"><a href="${url}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Download ${escapeHtml(p.title)}</a></div>`;
    })
    .join("");

  const { subject, html } = await renderEmail("digital_product_download", {
    firstName: student.firstName,
    downloadLinks,
    linkDays: String(DOWNLOAD_LINK_DAYS),
    forgotPasswordUrl: `${baseUrl}/forgot-password`,
    portalUrl: `${baseUrl}/portal/downloads`,
  });

  await sendEmail({
    to: student.email,
    subject,
    html,
    templateKey: "digital_product_download",
    studentId,
    metadata: { productIds: owned.map((o) => o.digitalProduct.id) },
  });
}
