"use server";

import { resolveCartItems, validateCoupon } from "@/lib/cart";
import type { CartItemLocal } from "@/lib/cart-store";

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
