"use client";

import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-store";
import { ShoppingCart, Check } from "lucide-react";

interface AddToCartButtonProps {
  courseId?: string;
  hybridPackageId?: string;
  moduleId?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "secondary" | "outline";
  label?: string;
  className?: string;
}

export function AddToCartButton({
  courseId,
  hybridPackageId,
  moduleId,
  size = "default",
  variant = "default",
  label = "Add to Cart",
  className,
}: AddToCartButtonProps) {
  const { items, addItem } = useCart();

  const isInCart = items.some(
    (i) =>
      (courseId && i.courseId === courseId) ||
      (hybridPackageId && i.hybridPackageId === hybridPackageId) ||
      (moduleId && i.moduleId === moduleId)
  );

  if (isInCart) {
    return (
      <Button size={size} variant="secondary" className={className} disabled>
        <Check className="mr-2 h-4 w-4" />
        In Cart
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() =>
        addItem({
          courseId,
          hybridPackageId,
          moduleId,
          isGift: false,
        })
      }
    >
      <ShoppingCart className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
