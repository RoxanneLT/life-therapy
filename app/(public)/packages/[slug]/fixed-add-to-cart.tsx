"use client";

import { useCart } from "@/lib/cart-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShoppingCart, CheckCircle2 } from "lucide-react";

interface FixedAddToCartProps {
  packageId: string;
  fixedCourseIds: string[];
  fixedModuleIds: string[];
  fixedDigitalProductIds: string[];
}

export function FixedAddToCart({
  packageId,
  fixedCourseIds,
  fixedModuleIds,
  fixedDigitalProductIds,
}: FixedAddToCartProps) {
  const { addItem, items } = useCart();
  const router = useRouter();

  const alreadyInCart = items.some((i) => i.hybridPackageId === packageId);

  function handleAddToCart() {
    addItem({
      hybridPackageId: packageId,
      packageSelections: {
        courseIds: fixedCourseIds,
        moduleIds: fixedModuleIds,
        digitalProductIds: fixedDigitalProductIds,
      },
      isGift: false,
    });
    router.push("/cart");
  }

  if (alreadyInCart) {
    return (
      <Button size="lg" variant="secondary" disabled>
        <CheckCircle2 className="mr-2 h-5 w-5" />
        Already in Cart
      </Button>
    );
  }

  return (
    <Button size="lg" onClick={handleAddToCart} className="gap-2">
      <ShoppingCart className="h-5 w-5" />
      Add to Cart
    </Button>
  );
}
