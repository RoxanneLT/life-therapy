import { prisma } from "@/lib/prisma";
import { resolveCartItems } from "@/lib/cart";
import { createPendingOrder, processCheckoutCompleted } from "@/lib/order";
import { sendDownloadLinks } from "@/lib/order-paid";
import { initializeTransaction } from "@/lib/paystack";
import { isDeliverableEmail } from "@/lib/email-address";
import { downloadLinksConfigured } from "@/lib/download-token";

/**
 * Buy one digital product without logging in — the target of a ManyChat / Instagram link.
 *
 * Not a second checkout. The buyer becomes a client record and from there it is the ordinary
 * pipeline: `createPendingOrder` → Paystack → `settleOrderPayment` (webhook, or the thank-you page,
 * whichever is first) → DigitalProductAccess, invoice, confirmation, download email. ZAR only, like
 * the cart: Paystack here charges ZAR.
 *
 * NOTHING HERE MAY ANSWER DIFFERENTLY FOR DIFFERENT ADDRESSES. Whoever types an address learns
 * nothing about it: every valid request goes to Paystack, owner or not. The first version emailed
 * an owner their link instead of charging them, and that reply ("this is already yours") told a
 * stranger who knew someone's email that they had bought — on a therapy site — a named workbook.
 * An owner who buys again is flagged for a refund (`settleOrderPayment`); one who notices first
 * uses `resendGuestDownload`, which says the same thing whatever is true.
 */
export type GuestPurchaseResult = { url: string } | { error: string };

/**
 * The client record a guest buys under: found by address, or made as a "potential" client with
 * source "guest_purchase" — the digital-only customer. No login is created. Forgot password makes
 * one on request and binds it only when the emailed token is spent (lib/account-link.ts), so a
 * typed address never yields a usable account. No consent is recorded, so no marketing reaches it.
 *
 * A later session booking upgrades the same row in place — `upsertContact` fills in the name and
 * phone from the booking form and records consent — so there is nothing to migrate.
 */
async function findOrCreateGuest(email: string, firstName: string, lastName: string): Promise<string> {
  const existing = await prisma.student.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  // A staff address never becomes a client row — registration refuses the same way. Once one
  // existed, forgot-password would bind it to the admin's own login.
  //
  // THE ONE EXCEPTION to answering identically: a staff address fails (generic 500) where any
  // other goes to Paystack, so this says "that address is a staff login". Accepted: the practice's
  // staff addresses are on its own site and emails, and the alternative — a client row bound to an
  // admin login — is the worse failure. Walked: .handoff/guest-buy-now/04-walker.md W1.
  // Case-insensitive: an invited admin's address is stored as typed.
  const admin = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (admin) throw new Error("buy-now refused for a staff address");
  try {
    const created = await prisma.student.create({
      data: { email, firstName, lastName, source: "guest_purchase", clientStatus: "potential" },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Two clicks on Pay, or a booking for the same address, made the row in the meantime.
    if ((err as { code?: string })?.code !== "P2002") throw err;
    const raced = await prisma.student.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return raced.id;
  }
}

/** Students are stored lower-case (lib/contacts.ts, registration); a ManyChat prefill may not be. */
function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function startGuestPurchase(input: {
  slug: string;
  email: string;
  firstName: string;
  lastName: string;
  baseUrl: string;
}): Promise<GuestPurchaseResult> {
  const email = normaliseEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) return { error: "Please enter your first name." };
  if (!isDeliverableEmail(email)) {
    return { error: "That doesn't look like a working email address. Check for a missing dot or a typo — your download is sent there." };
  }

  // Without the signing secret no download link can be made, so the buyer would pay and receive
  // nothing they could open without an account. Refuse before taking money, not after.
  if (!downloadLinksConfigured()) {
    return { error: "Online purchase is unavailable right now. Please try again later." };
  }

  const product = await prisma.digitalProduct.findFirst({
    where: { slug: input.slug, isPublished: true },
    select: { id: true },
  });
  if (!product) return { error: "This product is no longer available." };

  const resolved = await resolveCartItems(
    [{ id: `buy-${product.id}`, digitalProductId: product.id, quantity: 1, isGift: false, addedAt: new Date().toISOString() }],
    "ZAR",
  );
  if (resolved.length === 0) return { error: "This product is no longer available." };

  const studentId = await findOrCreateGuest(email, firstName, lastName);
  const totalCents = resolved[0].product.priceCents;
  const { order, reference } = await createPendingOrder({
    studentId,
    resolved,
    subtotalCents: totalCents,
    discountCents: 0,
    totalCents,
    couponId: null,
    channel: "buy-now",
  });
  const thankYouUrl = `${input.baseUrl}/buy/thank-you?reference=${encodeURIComponent(reference)}`;

  // Free (a lead magnet): grant it and send the link — the cart's free path, plus the email. Not
  // settleOrderPayment: that issues a numbered tax invoice "paid by Paystack" for money that never
  // moved, and a confirmation email, for every claim of a free download.
  if (totalCents === 0) {
    await processCheckoutCompleted(order.id);
    await sendDownloadLinks(studentId, [product.id], "ZAR").catch((err) =>
      console.error("Failed to send free download link:", err),
    );
    return { url: thankYouUrl };
  }

  const paystack = await initializeTransaction({
    email,
    amount: totalCents,
    currency: "ZAR",
    reference,
    callback_url: thankYouUrl,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { paystackAccessCode: paystack.access_code },
  });
  return { url: paystack.authorization_url };
}

/**
 * "Already bought it? Resend my link." Emails the link if this address owns this product, and
 * nothing otherwise. The caller answers the same either way and runs this after responding, so
 * neither the words nor the timing say which happened — the forgot-password pattern.
 */
export async function resendGuestDownload(input: { slug: string; email: string }): Promise<void> {
  const email = normaliseEmail(input.email);
  if (!isDeliverableEmail(email) || !downloadLinksConfigured()) return;
  const [student, product] = await Promise.all([
    prisma.student.findUnique({ where: { email }, select: { id: true } }),
    prisma.digitalProduct.findFirst({ where: { slug: input.slug, isPublished: true }, select: { id: true } }),
  ]);
  if (!student || !product) return;
  // sendDownloadLinks sends only for products the student holds an access row for.
  await sendDownloadLinks(student.id, [product.id], "ZAR");
}
