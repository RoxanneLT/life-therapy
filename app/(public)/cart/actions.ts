"use server";

import { resolveCartItems, validateCoupon } from "@/lib/cart";
import type { CartItemLocal } from "@/lib/cart-store";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolve cart items to real product info (prices, titles, images).
 * Called from the client with localStorage items.
 */
export async function getCartProducts(items: CartItemLocal[]) {
  const resolved = await resolveCartItems(items);
  return resolved.map((r) => ({
    localId: r.id,
    product: r.product,
  }));
}

/**
 * Check if the logged-in student already owns any items inside fixed packages.
 * Returns titles of already-owned items, or an empty array if none / not logged in.
 */
export async function checkFixedPackageOwnership(
  packageIds: string[]
): Promise<string[]> {
  if (packageIds.length === 0) return [];

  const auth = await getAuthenticatedStudent().catch(() => null);
  if (!auth) return [];

  const packages = await prisma.hybridPackage.findMany({
    where: { id: { in: packageIds }, isFixed: true },
    select: { fixedCourseIds: true, fixedModuleIds: true, fixedDigitalProductIds: true },
  });

  const allCourseIds = packages.flatMap((p) =>
    Array.isArray(p.fixedCourseIds) ? p.fixedCourseIds.map(String) : []
  );
  const allModuleIds = packages.flatMap((p) =>
    Array.isArray(p.fixedModuleIds) ? p.fixedModuleIds.map(String) : []
  );
  const allProductIds = packages.flatMap((p) =>
    Array.isArray(p.fixedDigitalProductIds) ? p.fixedDigitalProductIds.map(String) : []
  );

  const [ownedCourses, ownedModules, ownedProducts] = await Promise.all([
    allCourseIds.length
      ? prisma.enrollment.findMany({
          where: { studentId: auth.student.id, courseId: { in: allCourseIds } },
          select: { course: { select: { title: true } } },
        })
      : [],
    allModuleIds.length
      ? prisma.moduleAccess.findMany({
          where: { studentId: auth.student.id, moduleId: { in: allModuleIds } },
          select: { module: { select: { standaloneTitle: true, title: true } } },
        })
      : [],
    allProductIds.length
      ? prisma.digitalProductAccess.findMany({
          where: { studentId: auth.student.id, digitalProductId: { in: allProductIds } },
          select: { digitalProduct: { select: { title: true } } },
        })
      : [],
  ]);

  return [
    ...ownedCourses.map((e) => e.course.title),
    ...ownedModules.map((a) => a.module.standaloneTitle || a.module.title),
    ...ownedProducts.map((a) => a.digitalProduct.title),
  ];
}

/**
 * Validate a coupon code against current cart contents.
 */
export async function applyCoupon(
  code: string,
  courseIds: string[],
  packageIds: string[],
  subtotalCents: number,
  currency: string = "ZAR"
) {
  const result = await validateCoupon(
    code,
    { courseIds, packageIds },
    subtotalCents,
    currency
  );

  if (!result.valid) {
    return { valid: false as const, error: result.error };
  }

  return {
    valid: true as const,
    code: result.coupon.code,
    discountCents: result.coupon.discountCents,
    type: result.coupon.type,
    value: result.coupon.value,
  };
}
