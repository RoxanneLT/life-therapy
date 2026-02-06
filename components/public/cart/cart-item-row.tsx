"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Trash2, Gift } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { CartProductInfo } from "@/lib/cart";
import type { CartItemLocal } from "@/lib/cart-store";
import { GiftForm } from "./gift-form";

interface CartItemRowProps {
  item: CartItemLocal;
  product: CartProductInfo;
  onRemove: (id: string) => void;
  onToggleGift: (id: string) => void;
  onUpdateGift: (id: string, updates: Partial<CartItemLocal>) => void;
}

export function CartItemRow({
  item,
  product,
  onRemove,
  onToggleGift,
  onUpdateGift,
}: CartItemRowProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex gap-4">
        {/* Image */}
        {product.imageUrl ? (
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
            <Image
              src={product.imageUrl}
              alt={product.title}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md bg-muted">
            <span className="text-xs text-muted-foreground">
              {product.type === "credit_pack" ? "Credits" : "Course"}
            </span>
          </div>
        )}

        {/* Details */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <h3 className="font-medium">{product.title}</h3>
            <p className="text-sm capitalize text-muted-foreground">
              {product.type.replace("_", " ")}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onToggleGift(item.id)}
            >
              <Gift
                className={`h-3.5 w-3.5 ${item.isGift ? "text-brand-500" : ""}`}
              />
              {item.isGift ? "Gifting" : "Gift this"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Price */}
        <div className="text-right font-semibold">
          {formatPrice(product.priceCents)}
        </div>
      </div>

      {/* Gift details */}
      <GiftForm item={item} onUpdate={onUpdateGift} />
    </div>
  );
}
