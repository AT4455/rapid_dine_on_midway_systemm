"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { money } from "@/lib/utils";

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  prepTimeMinutes: number;
  dietaryTags: string[];
  imageUrl?: string | null;
};

type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  journeyId: string | null;
  lines: CartLine[];
};

const EMPTY: CartState = {
  restaurantId: null,
  restaurantName: null,
  journeyId: null,
  lines: [],
};

const STORAGE_KEY = "rapid-dine-cart-v1";

type CartContextValue = CartState & {
  ready: boolean;
  count: number;
  subtotal: number;
  addItem: (
    item: Omit<CartLine, "quantity">,
    restaurant: { id: string; name: string },
    journeyId: string | null,
  ) => { replaced: boolean };
  setQuantity: (menuItemId: string, quantity: number) => void;
  removeItem: (menuItemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function sanitize(raw: unknown): CartState {
  if (!raw || typeof raw !== "object") return EMPTY;
  const value = raw as Partial<CartState>;
  if (!Array.isArray(value.lines)) return EMPTY;
  const lines = value.lines
    .filter(
      (line): line is CartLine =>
        Boolean(line) &&
        typeof line.menuItemId === "string" &&
        typeof line.name === "string" &&
        typeof line.price === "number" &&
        typeof line.quantity === "number" &&
        line.quantity > 0,
    )
    .map((line) => ({ ...line, quantity: Math.min(20, Math.max(1, Math.floor(line.quantity))) }));
  if (!lines.length) return EMPTY;
  return {
    restaurantId: typeof value.restaurantId === "string" ? value.restaurantId : null,
    restaurantName: typeof value.restaurantName === "string" ? value.restaurantName : null,
    journeyId: typeof value.journeyId === "string" ? value.journeyId : null,
    lines,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) setState(sanitize(JSON.parse(stored)));
    } catch {
      /* ignore malformed cart */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (!state.lines.length) window.sessionStorage.removeItem(STORAGE_KEY);
      else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* session storage can be unavailable */
    }
  }, [state, ready]);

  const addItem = useCallback<CartContextValue["addItem"]>((item, restaurant, journeyId) => {
    let replaced = false;
    setState((current) => {
      const differentContext =
        current.lines.length > 0 &&
        (current.restaurantId !== restaurant.id || current.journeyId !== journeyId);
      const base = differentContext ? EMPTY : current;
      replaced = differentContext;
      const existing = base.lines.find((line) => line.menuItemId === item.menuItemId);
      const lines = existing
        ? base.lines.map((line) =>
            line.menuItemId === item.menuItemId
              ? { ...line, quantity: Math.min(20, line.quantity + 1) }
              : line,
          )
        : [...base.lines, { ...item, quantity: 1 }];
      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        journeyId,
        lines,
      };
    });
    return { replaced };
  }, []);

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setState((current) => {
      const lines = current.lines
        .map((line) =>
          line.menuItemId === menuItemId
            ? { ...line, quantity: Math.max(1, Math.min(20, Math.floor(quantity))) }
            : line,
        )
        .filter((line) => line.quantity > 0);
      return lines.length ? { ...current, lines } : EMPTY;
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setState((current) => {
      const lines = current.lines.filter((line) => line.menuItemId !== menuItemId);
      return lines.length ? { ...current, lines } : EMPTY;
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = money(state.lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
    return { ...state, ready, count, subtotal, addItem, setQuantity, removeItem, clear };
  }, [state, ready, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
