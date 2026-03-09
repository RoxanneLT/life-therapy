import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { initializeTransaction } from "@/lib/paystack";
import { resolveCartItems, validateCoupon } from "@/lib/cart";
import { createOrderNumber, processCheckoutCompleted } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/get-region";
import type { CartItemLocal } from "@/lib/cart-store";

type ResolvedItem = Awaited<ReturnType<typeof resolveCartItems>>[number];

/** Check if student already owns any non-gift items and return error message if so */
async function checkDuplicatePurchases(
  studentId: string,
  resolved: ResolvedItem[],
): Promise<string | null> {
  const courseIds = resolved.filter((r) => r.product.type === "course" && !r.isGift).map((r) => r.product.id);
  const moduleIds = resolved.filter((r) => r.product.type === "module" && !r.isGift).map((r) => r.product.id);
  const digitalProductIds = resolved.filter((r) => r.product.type === "digital_product" && !r.isGift).map((r) => r.product.id);

  const [ownedCourses, ownedModules, ownedDigital] = await Promise.all([
    courseIds.length ? prisma.enrollment.findMany({ where: { studentId, courseId: { in: courseIds } }, select: { courseId: true } }) : [],
    moduleIds.length ? prisma.moduleAccess.findMany({ where: { studentId, moduleId: { in: moduleIds } }, select: { moduleId: true } }) : [],
    digitalProductIds.length ? prisma.digitalProductAccess.findMany({ where: { studentId, digitalProductId: { in: digitalProductIds } }, select: { digitalProductId: true } }) : [],
  ]);

  const ownedIds = new Set([
    ...ownedCourses.map((r) => r.courseId),
    ...ownedModules.map((r) => r.moduleId),
    ...ownedDigital.map((r) => r.digitalProductId),
  ]);

  if (ownedIds.size > 0) {
    const ownedTitles = resolved.filter((r) => ownedIds.has(r.product.id)).map((r) => r.product.title);
    return `You already own: ${ownedTitles.join(", ")}. Please remove ${ownedTitles.length === 1 ? "it" : "them"} from your cart.`;
  }

  return null;
}

/**
 * For gift items, check if the recipient (looked up by email) already owns the item.
 * Returns an error message if any recipient already has what's being gifted.
 */
async function checkGiftRecipientOwnership(resolved: ResolvedItem[]): Promise<string | null> {
  const giftItems = resolved.filter((r) => r.isGift && r.giftRecipientEmail);
  if (giftItems.length === 0) return null;

  const recipientEmails = [...new Set(giftItems.map((r) => r.giftRecipientEmail!.toLowerCase()))];
  const recipients = await prisma.student.findMany({
    where: { email: { in: recipientEmails } },
    select: { id: true, email: true, firstName: true },
  });
  if (recipients.length === 0) return null;

  const recipientMap = new Map(recipients.map((s) => [s.email.toLowerCase(), s]));

  for (const item of giftItems) {
    const recipient = recipientMap.get(item.giftRecipientEmail!.toLowerCase());
    if (!recipient) continue;

    const alreadyOwns =
      (item.product.type === "course" &&
        (await prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: recipient.id, courseId: item.product.id } },
        }))) ||
      (item.product.type === "module" &&
        (await prisma.moduleAccess.findUnique({
          where: { studentId_moduleId: { studentId: recipient.id, moduleId: item.product.id } },
        })));

    if (alreadyOwns) {
      return `${recipient.firstName} already owns "${item.product.title}". Why not gift them a different course from our catalog instead?`;
    }
  }

  return null;
}

/**
 * Calculate upgrade discounts for full-course purchases where the buyer/recipient
 * already owns short courses (standalone modules) from that course.
 * Deducts the amount already paid for those modules from the full course price.
 * Returns the total upgrade discount in cents.
 */
async function calculateUpgradeDiscounts(studentId: string, resolved: ResolvedItem[]): Promise<number> {
  let totalUpgradeDiscount = 0;

  for (const item of resolved) {
    if (item.product.type !== "course") continue;

    const courseId = item.product.id;
    let checkStudentId = studentId;

    // For gifts, check the recipient's ownership
    if (item.isGift && item.giftRecipientEmail) {
      const recipient = await prisma.student.findUnique({
        where: { email: item.giftRecipientEmail.toLowerCase() },
        select: { id: true },
      });
      if (!recipient) continue;
      checkStudentId = recipient.id;
    }

    // Find any standalone module access the student/recipient already has for this course
    const existingAccess = await prisma.moduleAccess.findMany({
      where: { studentId: checkStudentId, courseId },
      select: { pricePaid: true, module: { select: { title: true } } },
    });

    if (existingAccess.length === 0) continue;

    const alreadyPaid = existingAccess.reduce((sum, a) => sum + (a.pricePaid ?? 0), 0);
    // Discount = what they already paid, capped at the full course price
    const discount = Math.min(alreadyPaid, item.product.priceCents);
    totalUpgradeDiscount += discount;
  }

  return totalUpgradeDiscount;
}

/** Persist gift cart items to DB so the webhook can access recipient details */
async function persistGiftCartItems(studentId: string, resolved: ResolvedItem[]) {
  const giftItems = resolved.filter((r) => r.isGift);
  if (giftItems.length === 0) return;

  const cart = await prisma.cart.findUnique({ where: { studentId } })
    ?? await prisma.cart.create({ data: { studentId } });

  for (const r of giftItems) {
    await prisma.cartItem.upsert({
      where: { id: r.id },
      create: {
        cartId: cart.id,
        courseId: r.product.type === "course" ? r.product.id : null,
        hybridPackageId: r.product.type === "package" ? r.product.id : null,
        moduleId: r.product.type === "module" ? r.product.id : null,
        digitalProductId: r.product.type === "digital_product" ? r.product.id : null,
        packageSelections: r.packageSelections || undefined,
        isGift: true,
        giftRecipientName: r.giftRecipientName || null,
        giftRecipientEmail: r.giftRecipientEmail || null,
        giftMessage: r.giftMessage || null,
        giftDeliveryDate: r.giftDeliveryDate ? new Date(r.giftDeliveryDate) : null,
      },
      update: {
        giftRecipientName: r.giftRecipientName || null,
        giftRecipientEmail: r.giftRecipientEmail || null,
        giftMessage: r.giftMessage || null,
        giftDeliveryDate: r.giftDeliveryDate ? new Date(r.giftDeliveryDate) : null,
      },
    });
  }
}

/**
 * POST /api/checkout
 * Creates a Paystack transaction for the student's cart.
 * Requires student authentication.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedStudent();
    if (!auth) {
      return NextResponse.json({ error: "Please log in to checkout" }, { status: 401 });
    }

    const body = await request.json();
    const items: CartItemLocal[] = body.items || [];
    const couponCode: string | null = body.couponCode || null;

    if (items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Always resolve prices in ZAR — Paystack only charges ZAR
    const resolved = await resolveCartItems(items, "ZAR");
    if (resolved.length === 0) {
      return NextResponse.json({ error: "No valid items in cart" }, { status: 400 });
    }

    // Duplicate purchase prevention (self)
    const duplicateError = await checkDuplicatePurchases(auth.student.id, resolved);
    if (duplicateError) {
      return NextResponse.json({ error: duplicateError }, { status: 400 });
    }

    // Duplicate purchase prevention (gift recipients)
    const giftOwnershipError = await checkGiftRecipientOwnership(resolved);
    if (giftOwnershipError) {
      return NextResponse.json({ error: giftOwnershipError }, { status: 400 });
    }

    // Calculate subtotal from server-verified prices
    const subtotalCents = resolved.reduce((sum, r) => sum + r.product.priceCents * r.quantity, 0);

    // Upgrade discount: buyer/recipient already owns short courses from this full course
    const upgradeDiscountCents = await calculateUpgradeDiscounts(auth.student.id, resolved);

    // Validate coupon if provided
    let discountCents = upgradeDiscountCents;
    let couponId: string | null = null;
    if (couponCode) {
      const courseIds = resolved.filter((r) => r.product.type === "course").map((r) => r.product.id);
      const packageIds = resolved.filter((r) => r.product.type === "package").map((r) => r.product.id);
      const couponResult = await validateCoupon(couponCode, { courseIds, packageIds }, subtotalCents, "ZAR");
      if (couponResult.valid) {
        discountCents = couponResult.coupon.discountCents;
        couponId = couponResult.coupon.id;
      }
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    await persistGiftCartItems(auth.student.id, resolved);

    // Create order in our DB
    const orderNumber = await createOrderNumber();
    const reference = `${orderNumber}-${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        studentId: auth.student.id,
        status: "pending",
        subtotalCents,
        discountCents,
        totalCents,
        couponId,
        paystackReference: reference,
        items: {
          create: resolved.map((r) => ({
            courseId: r.product.type === "course" ? r.product.id : null,
            hybridPackageId: r.product.type === "package" ? r.product.id : null,
            moduleId: r.product.type === "module" ? r.product.id : null,
            digitalProductId: r.product.type === "digital_product" ? r.product.id : null,
            packageSelections: r.packageSelections || undefined,
            description: r.product.title,
            unitPriceCents: r.product.priceCents,
            quantity: r.quantity,
            totalCents: r.product.priceCents * r.quantity,
            isGift: r.isGift,
          })),
        },
      },
    });

    const baseUrl = await getBaseUrl();

    // Free order (100% coupon) — skip Paystack, fulfill immediately
    if (totalCents === 0) {
      await processCheckoutCompleted(order.id);
      return NextResponse.json({ url: `${baseUrl}/checkout/success?reference=${reference}` });
    }

    // Create Paystack transaction
    const paystack = await initializeTransaction({
      email: auth.student.email,
      amount: totalCents,
      currency: "ZAR",
      reference,
      callback_url: `${baseUrl}/checkout/success?reference=${reference}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paystackAccessCode: paystack.access_code,
      },
    });

    return NextResponse.json({ url: paystack.authorization_url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
