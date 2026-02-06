import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { getStripe } from "@/lib/stripe";
import { resolveCartItems, validateCoupon } from "@/lib/cart";
import { createOrderNumber } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import type { CartItemLocal } from "@/lib/cart-store";

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for the student's cart.
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

    // Resolve cart items to real products with server-verified prices
    const resolved = await resolveCartItems(items);
    if (resolved.length === 0) {
      return NextResponse.json(
        { error: "No valid items in cart" },
        { status: 400 }
      );
    }

    // Duplicate purchase prevention: filter out courses the student already owns
    const nonGiftCourseIds = resolved
      .filter((r) => r.product.type === "course" && !r.isGift)
      .map((r) => r.product.id);

    if (nonGiftCourseIds.length > 0) {
      const existingEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: auth.student.id,
          courseId: { in: nonGiftCourseIds },
        },
        select: { courseId: true },
      });

      if (existingEnrollments.length > 0) {
        const ownedIds = new Set(existingEnrollments.map((e) => e.courseId));
        const ownedTitles = resolved
          .filter((r) => ownedIds.has(r.product.id))
          .map((r) => r.product.title);
        return NextResponse.json(
          { error: `You already own: ${ownedTitles.join(", ")}. Please remove ${ownedTitles.length === 1 ? "it" : "them"} from your cart.` },
          { status: 400 }
        );
      }
    }

    // Calculate subtotal from server-verified prices
    const subtotalCents = resolved.reduce(
      (sum, r) => sum + r.product.priceCents * r.quantity,
      0
    );

    // Validate coupon if provided
    let discountCents = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const courseIds = resolved
        .filter((r) => r.product.type === "course")
        .map((r) => r.product.id);
      const bundleIds = resolved
        .filter((r) => r.product.type === "bundle")
        .map((r) => r.product.id);

      const couponResult = await validateCoupon(
        couponCode,
        { courseIds, bundleIds },
        subtotalCents
      );
      if (couponResult.valid) {
        discountCents = couponResult.coupon.discountCents;
        couponId = couponResult.coupon.id;
      }
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    // Persist cart items (with gift details) to DB so the webhook can access them
    const hasGifts = resolved.some((r) => r.isGift);
    if (hasGifts) {
      let cart = await prisma.cart.findUnique({
        where: { studentId: auth.student.id },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { studentId: auth.student.id },
        });
      }
      // Save gift items with recipient details
      for (const r of resolved.filter((r) => r.isGift)) {
        await prisma.cartItem.upsert({
          where: {
            id: r.id, // localStorage ID won't match — use create path
          },
          create: {
            cartId: cart.id,
            courseId: r.product.type === "course" ? r.product.id : null,
            bundleId: r.product.type === "bundle" ? r.product.id : null,
            creditPackId: r.product.type === "credit_pack" ? r.product.id : null,
            isGift: true,
            giftRecipientName: r.giftRecipientName || null,
            giftRecipientEmail: r.giftRecipientEmail || null,
            giftMessage: r.giftMessage || null,
            giftDeliveryDate: r.giftDeliveryDate
              ? new Date(r.giftDeliveryDate)
              : null,
          },
          update: {
            giftRecipientName: r.giftRecipientName || null,
            giftRecipientEmail: r.giftRecipientEmail || null,
            giftMessage: r.giftMessage || null,
            giftDeliveryDate: r.giftDeliveryDate
              ? new Date(r.giftDeliveryDate)
              : null,
          },
        });
      }
    }

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
            bundleId: r.product.type === "bundle" ? r.product.id : null,
            creditPackId:
              r.product.type === "credit_pack" ? r.product.id : null,
            description: r.product.title,
            unitPriceCents: r.product.priceCents,
            quantity: r.quantity,
            totalCents: r.product.priceCents * r.quantity,
            isGift: r.isGift,
          })),
        },
      },
    });

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://life-therapy.co.za";

    const lineItems = resolved.map((r) => ({
      price_data: {
        currency: "zar",
        product_data: {
          name: r.product.title,
          ...(r.product.imageUrl
            ? { images: [r.product.imageUrl] }
            : {}),
        },
        unit_amount: r.product.priceCents,
      },
      quantity: r.quantity,
    }));

    // Handle coupon discount in Stripe
    const discounts: { coupon: string }[] = [];
    if (discountCents > 0 && couponCode) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "zar",
        duration: "once",
        name: couponCode.toUpperCase(),
      });
      discounts.push({ coupon: stripeCoupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: auth.student.email,
      line_items: lineItems,
      discounts: discounts.length > 0 ? discounts : undefined,
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    });

    // Store Stripe session ID on our order
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
