import type { Metadata } from "next";
import { CartPageClient } from "./cart-client";

export const metadata: Metadata = {
  title: "Shopping Cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageClient />;
}
