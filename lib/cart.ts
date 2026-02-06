import { prisma } from "@/lib/prisma";
import type { CartItemLocal } from "./cart-store";

export interface CartProductInfo {
  id: string;
  type: "course" | "bundle" | "credit_pack" | "package";
  title: string;
  priceCents: number;
  imageUrl?: string | null;
  slug?: string;
}

/**
 * Resolve cart items to real product info from the database.
 * Only returns valid, published items.
 */
export async function resolveCartItems(
  items: CartItemLocal[]
): Promise<(CartItemLocal & { product: CartProductInfo })[]> {
  const courseIds = items.filter((i) => i.courseId).map((i) => i.courseId!);
  const bundleIds = items.filter((i) => i.bundleId).map((i) => i.bundleId!);
  const creditPackIds = items
    .filter((i) => i.creditPackId)
    .map((i) => i.creditPackId!);
  const packageIds = items
    .filter((i) => i.hybridPackageId)
    .map((i) => i.hybridPackageId!);

  const [courses, bundles, creditPacks, packages] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({
          where: { id: { in: courseIds }, isPublished: true },
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            slug: true,
          },
        })
      : [],
    bundleIds.length
      ? prisma.bundle.findMany({
          where: { id: { in: bundleIds }, isPublished: true },
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            slug: true,
          },
        })
      : [],
    creditPackIds.length
      ? prisma.sessionCreditPack.findMany({
          where: { id: { in: creditPackIds }, isPublished: true },
          select: { id: true, name: true, priceCents: true, credits: true },
        })
      : [],
    packageIds.length
      ? prisma.hybridPackage.findMany({
          where: { id: { in: packageIds }, isPublished: true },
          select: {
            id: true,
            title: true,
            priceCents: true,
            imageUrl: true,
            slug: true,
          },
        })
      : [],
  ]);

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const bundleMap = new Map(bundles.map((b) => [b.id, b]));
  const creditPackMap = new Map(creditPacks.map((p) => [p.id, p]));
  const packageMap = new Map(packages.map((p) => [p.id, p]));

  const resolved: (CartItemLocal & { product: CartProductInfo })[] = [];

  for (const item of items) {
    let product: CartProductInfo | null = null;

    if (item.courseId) {
      const c = courseMap.get(item.courseId);
      if (c) {
        product = {
          id: c.id,
          type: "course",
          title: c.title,
          priceCents: c.price,
          imageUrl: c.imageUrl,
          slug: c.slug,
        };
      }
    } else if (item.bundleId) {
      const b = bundleMap.get(item.bundleId);
      if (b) {
        product = {
          id: b.id,
          type: "bundle",
          title: b.title,
          priceCents: b.price,
          imageUrl: b.imageUrl,
          slug: b.slug,
        };
      }
    } else if (item.creditPackId) {
      const p = creditPackMap.get(item.creditPackId);
      if (p) {
        product = {
          id: p.id,
          type: "credit_pack",
          title: `${p.name} (${p.credits} credits)`,
          priceCents: p.priceCents,
        };
      }
    } else if (item.hybridPackageId) {
      const p = packageMap.get(item.hybridPackageId);
      if (p) {
        product = {
          id: p.id,
          type: "package",
          title: p.title,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          slug: p.slug,
        };
      }
    }

    if (product) {
      resolved.push({ ...item, product });
    }
  }

  return resolved;
}

/**
 * Validate and apply a coupon code.
 */
export async function validateCoupon(
  code: string,
  itemProductIds: { courseIds: string[]; bundleIds: string[] },
  subtotalCents: number
) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) return { valid: false as const, error: "Coupon not found" };
  if (!coupon.isActive)
    return { valid: false as const, error: "Coupon is no longer active" };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt)
    return { valid: false as const, error: "Coupon is not yet active" };
  if (coupon.expiresAt && now > coupon.expiresAt)
    return { valid: false as const, error: "Coupon has expired" };
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
    return { valid: false as const, error: "Coupon usage limit reached" };
  if (coupon.minOrderCents && subtotalCents < coupon.minOrderCents)
    return {
      valid: false as const,
      error: `Minimum order of R${(coupon.minOrderCents / 100).toFixed(2)} required`,
    };

  // Check if coupon applies to specific products
  if (!coupon.appliesToAll) {
    const allowedCourseIds = (coupon.courseIds as string[]) || [];
    const allowedBundleIds = (coupon.bundleIds as string[]) || [];
    const hasMatch =
      itemProductIds.courseIds.some((id) => allowedCourseIds.includes(id)) ||
      itemProductIds.bundleIds.some((id) => allowedBundleIds.includes(id));
    if (!hasMatch)
      return {
        valid: false as const,
        error: "Coupon does not apply to items in your cart",
      };
  }

  let discountCents = 0;
  if (coupon.type === "percentage") {
    discountCents = Math.round((subtotalCents * coupon.value) / 100);
  } else {
    discountCents = coupon.value;
  }
  discountCents = Math.min(discountCents, subtotalCents);

  return {
    valid: true as const,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountCents,
    },
  };
}

/**
 * Merge localStorage cart into DB cart for authenticated student.
 */
export async function mergeCartToDb(
  studentId: string,
  localItems: CartItemLocal[]
) {
  let cart = await prisma.cart.findUnique({
    where: { studentId },
    include: { items: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { studentId },
      include: { items: true },
    });
  }

  for (const local of localItems) {
    const exists = cart.items.some(
      (db) =>
        db.courseId === (local.courseId || null) &&
        db.bundleId === (local.bundleId || null) &&
        db.creditPackId === (local.creditPackId || null) &&
        db.hybridPackageId === (local.hybridPackageId || null) &&
        !db.isGift &&
        !local.isGift
    );
    if (!exists) {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          courseId: local.courseId || null,
          bundleId: local.bundleId || null,
          creditPackId: local.creditPackId || null,
          hybridPackageId: local.hybridPackageId || null,
          quantity: local.quantity,
          isGift: local.isGift,
          giftRecipientName: local.giftRecipientName || null,
          giftRecipientEmail: local.giftRecipientEmail || null,
          giftMessage: local.giftMessage || null,
          giftDeliveryDate: local.giftDeliveryDate
            ? new Date(local.giftDeliveryDate)
            : null,
        },
      });
    }
  }

  return prisma.cart.findUnique({
    where: { studentId },
    include: { items: true },
  });
}
