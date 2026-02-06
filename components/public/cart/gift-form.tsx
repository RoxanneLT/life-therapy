"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CartItemLocal } from "@/lib/cart-store";

interface GiftFormProps {
  item: CartItemLocal;
  onUpdate: (id: string, updates: Partial<CartItemLocal>) => void;
}

export function GiftForm({ item, onUpdate }: GiftFormProps) {
  if (!item.isGift) return null;

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed border-brand-200 bg-brand-50/50 p-3 dark:border-brand-800 dark:bg-brand-950/20">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`gift-name-${item.id}`} className="text-xs">
            Recipient Name
          </Label>
          <Input
            id={`gift-name-${item.id}`}
            value={item.giftRecipientName || ""}
            onChange={(e) =>
              onUpdate(item.id, { giftRecipientName: e.target.value })
            }
            placeholder="Their name"
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label htmlFor={`gift-email-${item.id}`} className="text-xs">
            Recipient Email
          </Label>
          <Input
            id={`gift-email-${item.id}`}
            type="email"
            value={item.giftRecipientEmail || ""}
            onChange={(e) =>
              onUpdate(item.id, { giftRecipientEmail: e.target.value })
            }
            placeholder="their@email.com"
            className="mt-1 h-8 text-sm"
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`gift-message-${item.id}`} className="text-xs">
          Personal Message (optional)
        </Label>
        <Textarea
          id={`gift-message-${item.id}`}
          value={item.giftMessage || ""}
          onChange={(e) =>
            onUpdate(item.id, { giftMessage: e.target.value })
          }
          placeholder="Write a personal message..."
          rows={2}
          className="mt-1 text-sm"
        />
      </div>
      <div>
        <Label htmlFor={`gift-date-${item.id}`} className="text-xs">
          Delivery Date (optional — defaults to immediately)
        </Label>
        <Input
          id={`gift-date-${item.id}`}
          type="date"
          value={item.giftDeliveryDate || ""}
          onChange={(e) =>
            onUpdate(item.id, { giftDeliveryDate: e.target.value })
          }
          className="mt-1 h-8 w-48 text-sm"
          min={new Date().toISOString().split("T")[0]}
        />
      </div>
    </div>
  );
}
