"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface CartItemLocal {
  id: string;
  courseId?: string;
  hybridPackageId?: string;
  moduleId?: string;
  quantity: number;
  isGift: boolean;
  giftRecipientName?: string;
  giftRecipientEmail?: string;
  giftMessage?: string;
  giftDeliveryDate?: string;
  addedAt: string;
}

interface CartContextType {
  items: CartItemLocal[];
  addItem: (item: Omit<CartItemLocal, "id" | "addedAt" | "quantity">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<CartItemLocal>) => void;
  clearCart: () => void;
  itemCount: number;
}

const CART_KEY = "life-therapy-cart";

function loadCart(): CartItemLocal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItemLocal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItemLocal[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveCart(items);
  }, [items, mounted]);

  const addItem = useCallback(
    (item: Omit<CartItemLocal, "id" | "addedAt" | "quantity">) => {
      setItems((prev) => {
        // Don't add duplicate non-gift items
        const existing = prev.find(
          (i) =>
            !i.isGift &&
            !item.isGift &&
            i.courseId === item.courseId &&
            i.hybridPackageId === item.hybridPackageId &&
            i.moduleId === item.moduleId
        );
        if (existing) return prev;
        return [
          ...prev,
          {
            ...item,
            id: crypto.randomUUID(),
            quantity: 1,
            addedAt: new Date().toISOString(),
          },
        ];
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback(
    (id: string, updates: Partial<CartItemLocal>) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateItem,
        clearCart,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
