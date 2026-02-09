import { prisma } from "@/lib/prisma";
import { getCoursePrice, getModulePrice, getPackagePrice, getDigitalProductPrice } from "./pricing";
import { getCurrency } from "./get-region";
import type { Currency } from "./region";
import type { CartItemLocal } from "./cart-store";

export interface CartProductInfo {
  id: string;
  type: "course" | "package" | "module" | "digital_product";
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
  items: CartItemLocal[],
  currency?: Currency
): Promise<(CartItemLocal & { product: CartProductInfo })[]> {
  const cur = currency || getCurrency();
  const courseIds = items.filter((i) => i.courseId).map((i) => i.courseId!);
  const packageIds = items
    .filter((i) => i.hybridPackageId)
    .map((i) => i.hybridPackageId!);
  const moduleIds = items.filter((i) => i.moduleId).map((i) => i.moduleId!);
  const digitalProductIds = items
    .filter((i) => i.digitalProductId)
    .map((i) => i.digitalProductId!);

  const [courses, packages, modules, digitalProducts] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({
          where: { id: { in: courseIds }, isPublished: true },
          select: {
            id: true,
            title: true,
            price: true,
            priceUsd: true,
            priceEur: true,
            priceGbp: true,
            imageUrl: true,
            slug: true,
          },
        })
      : [],
    packageIds.length
      ? prisma.hybridPackage.findMany({
          where: { id: { in: packageIds }, isPublished: true },
          select: {
            id: true,
            title: true,
            priceCents: true,
            priceCentsUsd: true,
            priceCentsEur: true,
            priceCentsGbp: true,
            imageUrl: true,
            slug: true,
          },
        })
      : [],
    moduleIds.length
      ? prisma.module.findMany({
          where: { id: { in: moduleIds }, isStandalonePublished: true },
          select: {
            id: true,
            standaloneTitle: true,
            title: true,
            standalonePrice: true,
            standalonePriceUsd: true,
            standalonePriceEur: true,
            standalonePriceGbp: true,
            standaloneImageUrl: true,
            standaloneSlug: true,
          },
        })
      : [],
    digitalProductIds.length
      ? prisma.digitalProduct.findMany({
          where: { id: { in: digitalProductIds }, isPublished: true },
          select: {
            id: true,
            title: true,
            priceCents: true,
            priceCentsUsd: true,
            priceCentsEur: true,
            priceCentsGbp: true,
            imageUrl: true,
            slug: true,
          },
        })
      : [],
  ]);

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const moduleMap = new Map(modules.map((m) => [m.id, m]));
  const dpMap = new Map(digitalProducts.map((d) => [d.id, d]));

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
          priceCents: getCoursePrice(c, cur),
          imageUrl: c.imageUrl,
          slug: c.slug,
        };
      }
    } else if (item.hybridPackageId) {
      const p = packageMap.get(item.hybridPackageId);
      if (p) {
        product = {
          id: p.id,
          type: "package",
          title: p.title,
          priceCents: getPackagePrice(p, cur),
          imageUrl: p.imageUrl,
          slug: p.slug,
        };
      }
    } else if (item.moduleId) {
      const m = moduleMap.get(item.moduleId);
      if (m && m.standalonePrice) {
        product = {
          id: m.id,
          type: "module",
          title: m.standaloneTitle || m.title,
          priceCents: getModulePrice(m, cur),
          imageUrl: m.standaloneImageUrl,
          slug: m.standaloneSlug || undefined,
        };
      }
    } else if (item.digitalProductId) {
      const d = dpMap.get(item.digitalProductId);
      if (d) {
        product = {
          id: d.id,
          type: "digital_product",
          title: d.title,
          priceCents: getDigitalProductPrice(d, cur),
          imageUrl: d.imageUrl,
          slug: d.slug,
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
  itemProductIds: { courseIds: string[]; packageIds: string[] },
  subtotalCents: number,
  currency: string = "ZAR"
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
    const allowedPackageIds = (coupon.packageIds as string[]) || [];
    const hasMatch =
      itemProductIds.courseIds.some((id) => allowedCourseIds.includes(id)) ||
      itemProductIds.packageIds.some((id) => allowedPackageIds.includes(id));
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
    // Pick currency-specific fixed amount
    const upper = currency.toUpperCase();
    if (upper === "USD" && coupon.valueUsd != null) discountCents = coupon.valueUsd;
    else if (upper === "EUR" && coupon.valueEur != null) discountCents = coupon.valueEur;
    else if (upper === "GBP" && coupon.valueGbp != null) discountCents = coupon.valueGbp;
    else discountCents = coupon.value; // ZAR fallback
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
        db.hybridPackageId === (local.hybridPackageId || null) &&
        db.moduleId === (local.moduleId || null) &&
        db.digitalProductId === (local.digitalProductId || null) &&
        !db.isGift &&
        !local.isGift
    );
    if (!exists) {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          courseId: local.courseId || null,
          hybridPackageId: local.hybridPackageId || null,
          moduleId: local.moduleId || null,
          digitalProductId: local.digitalProductId || null,
          packageSelections: local.packageSelections || undefined,
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
