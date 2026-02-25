import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { initializeTransaction } from "@/lib/paystack";
import { resolveCartItems, validateCoupon } from "@/lib/cart";
import { createOrderNumber } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/get-region";
import type { CartItemLocal } from "@/lib/cart-store";

type ResolvedItem = Awaited<ReturnType<typeof resolveCartItems>>[number];

/** Check if student already owns any non-gift items and return error message if so */
async function checkDuplicatePurchases(
  studentId: string,
  resolved: ResolvedItem[],
): Promise<string | null> {
  const checks: { type: string; ids: string[]; lookup: () => Promise<string[]> }[] = [
    {
      type: "course",
      ids: resolved.filter((r) => r.product.type === "course" && !r.isGift).map((r) => r.product.id),
      lookup: async () => {
        const rows = await prisma.enrollment.findMany({ where: { studentId, courseId: { in: checks[0].ids } }, select: { courseId: true } });
        return rows.map((r) => r.courseId);
      },
    },
    {
      type: "module",
      ids: resolved.filter((r) => r.product.type === "module" && !r.isGift).map((r) => r.product.id),
      lookup: async () => {
        const rows = await prisma.moduleAccess.findMany({ where: { studentId, moduleId: { in: checks[1].ids } }, select: { moduleId: true } });
        return rows.map((r) => r.moduleId);
      },
    },
    {
      type: "digital_product",
      ids: resolved.filter((r) => r.product.type === "digital_product" && !r.isGift).map((r) => r.product.id),
      lookup: async () => {
        const rows = await prisma.digitalProductAccess.findMany({ where: { studentId, digitalProductId: { in: checks[2].ids } }, select: { digitalProductId: true } });
        return rows.map((r) => r.digitalProductId);
      },
    },
  ];

  for (const check of checks) {
    if (check.ids.length === 0) continue;
    const ownedIds = new Set(await check.lookup());
    if (ownedIds.size > 0) {
      const ownedTitles = resolved.filter((r) => ownedIds.has(r.product.id)).map((r) => r.product.title);
      return `You already own: ${ownedTitles.join(", ")}. Please remove ${ownedTitles.length === 1 ? "it" : "them"} from your cart.`;
    }
  }

  return null;
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

    // Duplicate purchase prevention
    const duplicateError = await checkDuplicatePurchases(auth.student.id, resolved);
    if (duplicateError) {
      return NextResponse.json({ error: duplicateError }, { status: 400 });
    }

    // Calculate subtotal from server-verified prices
    const subtotalCents = resolved.reduce((sum, r) => sum + r.product.priceCents * r.quantity, 0);

    // Validate coupon if provided
    let discountCents = 0;
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
    const order = await prisma.order.create({
      data: {
        orderNumber,
        studentId: auth.student.id,
        status: "pending",
        subtotalCents,
        discountCents,
        totalCents,
        couponId,
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

    // Create Paystack transaction
    const baseUrl = await getBaseUrl();
    const reference = `${order.orderNumber}-${Date.now()}`;

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
        paystackReference: reference,
        paystackAccessCode: paystack.access_code,
      },
    });

    return NextResponse.json({ url: paystack.authorization_url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
