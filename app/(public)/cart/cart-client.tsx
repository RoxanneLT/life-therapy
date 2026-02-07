"use client";

import { useEffect, useState, useCallback } from "react";
import { useCart } from "@/lib/cart-store";
import type { CartProductInfo } from "@/lib/cart";
import { getCartProducts, applyCoupon } from "./actions";
import { CartItemRow } from "@/components/public/cart/cart-item-row";
import { CouponInput } from "@/components/public/cart/coupon-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface AppliedCoupon {
  code: string;
  discountCents: number;
}

export function CartPageClient() {
  const { items, removeItem, updateItem, clearCart } = useCart();
  const [products, setProducts] = useState<
    Map<string, CartProductInfo>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  // Fetch product info when items change
  const fetchProducts = useCallback(async () => {
    if (items.length === 0) {
      setProducts(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resolved = await getCartProducts(items);
      const map = new Map<string, CartProductInfo>();
      for (const r of resolved) {
        map.set(r.localId, r.product);
      }
      setProducts(map);
    } catch {
      // Products will remain empty, items won't render
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

    const result = await applyCoupon(code, courseIds, packageIds, subtotalCents);

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

  // Checkout handler
  async function handleCheckout() {
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
        // Clear local cart (order is now in DB) and redirect to Stripe
        clearCart();
        globalThis.location.href = data.url;
      }
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    } finally {
      setCheckingOut(false);
    }
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
                    <span>{formatPrice(subtotalCents)}</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatPrice(discountCents)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(totalCents)}</span>
                    </div>
                  </div>
                </div>

                <CouponInput
                  onApply={handleApplyCoupon}
                  appliedCoupon={coupon}
                  onRemove={() => setCoupon(null)}
                />

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
                <p className="text-center text-xs text-muted-foreground">
                  You&apos;ll be redirected to Stripe for secure payment.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
