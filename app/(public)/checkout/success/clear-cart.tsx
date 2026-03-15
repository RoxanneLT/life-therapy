"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

/** Clears the local cart when the success page mounts */
export function ClearCart() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return null;
}
