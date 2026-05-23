"use client";

// Cart Context — persists to localStorage. Used in public layout.
// Cart represents a single rental being booked (one product + date).
// The flow is single-item not multi-product (bounce houses are full-day rentals).

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  pricePerDay: number; // cents
  imageUrl: string | null;
  eventDate: string | null;   // YYYY-MM-DD
  startTime: string | null;   // "9:00 AM"
  endTime: string | null;     // "5:00 PM"
  addedAt: string;            // ISO timestamp
}

interface CartContextValue {
  item: CartItem | null;
  setItem: (item: CartItem | null) => void;
  updateDate: (date: string, startTime?: string, endTime?: string) => void;
  clear: () => void;
  hasItem: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "iaf_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [item, setItemState] = useState<CartItem | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem;
        // Expire if older than 24h
        const ageMs = Date.now() - new Date(parsed.addedAt).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) {
          setItemState(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated) return;
    if (item) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [item, hydrated]);

  const setItem = useCallback((newItem: CartItem | null) => {
    setItemState(newItem);
  }, []);

  const updateDate = useCallback((date: string, startTime?: string, endTime?: string) => {
    setItemState((prev) =>
      prev
        ? {
            ...prev,
            eventDate: date,
            startTime: startTime ?? prev.startTime,
            endTime: endTime ?? prev.endTime,
          }
        : null
    );
  }, []);

  const clear = useCallback(() => {
    setItemState(null);
  }, []);

  return (
    <CartContext.Provider
      value={{ item, setItem, updateDate, clear, hasItem: !!item }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
