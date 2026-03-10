"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";
import type { CartProductInfo } from "@/lib/cart";
import { getCartProducts, applyCoupon, checkFixedPackageOwnership } from "./actions";
import { CartItemRow } from "@/components/public/cart/cart-item-row";
import { CouponInput } from "@/components/public/cart/coupon-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { useRegion } from "@/lib/region-store";
import { ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface AppliedCoupon {
  code: string;
  discountCents: number;
}

export function CartPageClient() {
  const { items, removeItem, updateItem, clearCart } = useCart();
  const { currency } = useRegion();
  const [products, setProducts] = useState<
    Map<string, CartProductInfo>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string[] | null>(null);

  // Build a stable key that only changes when the *product identity* of the
  // cart changes (add / remove / swap items).  Gift-field edits don't alter
  // this key, so we won't re-fetch products on every keystroke.
  const structuralKey = items
    .map((i) => `${i.id}:${i.courseId || ""}:${i.hybridPackageId || ""}:${i.moduleId || ""}:${i.digitalProductId || ""}:${i.quantity}`)
    .join("|");

  // Fetch product info only when the structural cart changes
  useEffect(() => {
    if (items.length === 0) {
      setProducts(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCartProducts(items).then((resolved) => {
      if (cancelled) return;
      const map = new Map<string, CartProductInfo>();
      for (const r of resolved) {
        map.set(r.localId, r.product);
      }
      setProducts(map);
    }).catch(() => {
      // Products will remain empty, items won't render
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey]);

  // Calculate totals
  const subtotalCents = items.reduce((sum, item) => {
    const product = products.get(item.id);
    return sum + (product?.priceCents || 0) * item.quantity;
  }, 0);

  const discountCents = coupon?.discountCents || 0;
  const totalCents = Math.max(0, subtotalCents - discountCents);

  // Coupon handlers
  async function handleApplyCoupon(code: string) {
    const courseIds = items
      .filter((i) => i.courseId)
      .map((i) => i.courseId!);
    const packageIds = items
      .filter((i) => i.hybridPackageId)
      .map((i) => i.hybridPackageId!);

    const result = await applyCoupon(code, courseIds, packageIds, subtotalCents, currency);

    if (result.valid) {
      setCoupon({ code: result.code, discountCents: result.discountCents });
      return { valid: true, code: result.code, discountCents: result.discountCents };
    }
    return { valid: false, error: result.error };
  }

  function handleToggleGift(id: string) {
    const item = items.find((i) => i.id === id);
    if (item) {
      updateItem(id, {
        isGift: !item.isGift,
        // Clear gift fields when toggling off
        ...(!item.isGift
          ? {}
          : {
              giftRecipientName: undefined,
              giftRecipientEmail: undefined,
              giftMessage: undefined,
              giftDeliveryDate: undefined,
            }),
      });
    }
  }

  async function proceedToCheckout() {
    setDuplicateWarning(null);
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          couponCode: coupon?.code || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          // Not logged in — redirect to portal login
          globalThis.location.href = "/portal/login";
          return;
        }
        setCheckoutError(data.error || "Checkout failed");
        return;
      }
      if (data.url) {
        // Clear local cart (order is now in DB) and redirect to Paystack
        clearCart();
        globalThis.location.href = data.url;
      }
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  // Checkout handler — soft-blocks on fixed package duplicates
  async function handleCheckout() {
    setCheckoutError(null);
    const fixedPackageIds = items
      .filter((i) => i.hybridPackageId && i.packageSelections)
      .map((i) => i.hybridPackageId!);

    if (fixedPackageIds.length > 0) {
      const duplicates = await checkFixedPackageOwnership(fixedPackageIds);
      if (duplicates.length > 0) {
        setDuplicateWarning(duplicates);
        return;
      }
    }
    await proceedToCheckout();
  }

  // Valid items (those that resolved to a real product)
  const validItems = items.filter((item) => products.has(item.id));

  if (loading) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="font-heading text-2xl font-bold">
            Your cart is empty
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse our courses and add something to your cart.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/courses">Browse Courses</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-2xl font-bold">Shopping Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {validItems.length} item{validItems.length !== 1 && "s"}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Items */}
          <div className="space-y-4 lg:col-span-2">
            {validItems.map((item) => {
              const product = products.get(item.id);
              if (!product) return null;
              return (
                <CartItemRow
                  key={item.id}
                  item={item}
                  product={product}
                  onRemove={removeItem}
                  onToggleGift={handleToggleGift}
                  onUpdateGift={updateItem}
                />
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={clearCart}
            >
              Clear cart
            </Button>
          </div>

          {/* Summary */}
          <div>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="font-heading text-lg font-semibold">
                  Order Summary
                </h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(subtotalCents, currency)}</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatPrice(discountCents, currency)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(totalCents, currency)}</span>
                    </div>
                  </div>
                </div>

                <CouponInput
                  onApply={handleApplyCoupon}
                  appliedCoupon={coupon}
                  onRemove={() => setCoupon(null)}
                />

                {duplicateWarning && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      You already own:
                    </p>
                    <ul className="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
                      {duplicateWarning.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-amber-700 dark:text-amber-400">
                      You can still purchase this package if you&apos;d like the deal.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={proceedToCheckout} disabled={checkingOut} className="flex-1 gap-1">
                        {checkingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Continue anyway
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDuplicateWarning(null)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={checkingOut || validItems.length === 0}
                  onClick={handleCheckout}
                >
                  {checkingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Proceed to Checkout
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                {checkoutError && (
                  <p className="text-center text-xs text-destructive">
                    {checkoutError}
                  </p>
                )}
                {currency !== "ZAR" && (
                  <p className="text-center text-xs text-amber-600">
                    You&apos;ll be charged in ZAR (South African Rand). Your
                    bank will convert at the current exchange rate.
                  </p>
                )}
                <p className="text-center text-xs text-muted-foreground">
                  You&apos;ll be redirected to Paystack for secure payment.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
