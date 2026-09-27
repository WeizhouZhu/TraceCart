import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProductById, getVariant } from "../data/catalog";
import { trackBusiness } from "../lib/telemetry";
import type { CartItem, CheckoutDraft, ScenarioSettings } from "../types";

interface StoreState {
  cart: CartItem[];
  favorites: string[];
  compare: string[];
  checkout: CheckoutDraft;
  scenario: ScenarioSettings;
}

interface StoreContextValue extends StoreState {
  cartCount: number;
  cartSubtotal: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (productId: string, variantId: string, quantity?: number) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  toggleSelected: (itemId: string) => void;
  removeItems: (itemIds: string[]) => void;
  undoRemove: () => void;
  lastRemovedCount: number;
  toggleFavorite: (productId: string) => void;
  toggleCompare: (productId: string) => void;
  updateCheckout: (patch: Partial<CheckoutDraft>) => void;
  setScenario: (scenario: ScenarioSettings) => void;
  clearCart: () => void;
}

const initialCheckout: CheckoutDraft = {
  address: {
    recipient: "",
    phone: "",
    province: "",
    city: "",
    district: "",
    detail: "",
    postalCode: "",
  },
  deliveryMethod: "standard",
  couponCode: "",
  giftWrap: false,
  invoice: false,
  note: "",
};

const initialScenario: ScenarioSettings = {
  latency: 200,
  failRate: 0,
  paymentOutcome: "random",
  lowStock: false,
  priceChanged: false,
};

const defaultState: StoreState = {
  cart: [],
  favorites: [],
  compare: [],
  checkout: initialCheckout,
  scenario: initialScenario,
};

const StoreContext = createContext<StoreContextValue | null>(null);

function readState(): StoreState {
  try {
    const value = localStorage.getItem("tracecart.store");
    if (!value) return defaultState;
    return { ...defaultState, ...JSON.parse(value) };
  } catch {
    return defaultState;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(readState);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<CartItem[]>([]);

  useEffect(() => {
    localStorage.setItem("tracecart.store", JSON.stringify(state));
    sessionStorage.setItem("tracecart.scenario", JSON.stringify(state.scenario));
  }, [state]);

  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = state.cart
    .filter((item) => item.selected)
    .reduce((sum, item) => {
      const product = getProductById(item.productId);
      if (!product) return sum;
      return sum + getVariant(product, item.variantId).price * item.quantity;
    }, 0);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      cartCount,
      cartSubtotal,
      cartOpen,
      setCartOpen,
      lastRemovedCount: lastRemoved.length,
      addToCart(productId, variantId, quantity = 1) {
        setState((current) => {
          const existing = current.cart.find(
            (item) => item.productId === productId && item.variantId === variantId,
          );
          const cart = existing
            ? current.cart.map((item) =>
                item.id === existing.id
                  ? { ...item, quantity: Math.min(item.quantity + quantity, 99) }
                  : item,
              )
            : [
                ...current.cart,
                {
                  id: crypto.randomUUID(),
                  productId,
                  variantId,
                  quantity,
                  selected: true,
                  addedAt: new Date().toISOString(),
                },
              ];
          return { ...current, cart };
        });
        trackBusiness("add_to_cart", { productId, variantId, quantity });
        setCartOpen(true);
      },
      updateQuantity(itemId, quantity) {
        setState((current) => ({
          ...current,
          cart: current.cart.map((item) =>
            item.id === itemId ? { ...item, quantity: Math.max(1, Math.min(quantity, 99)) } : item,
          ),
        }));
        trackBusiness("update_cart_quantity", { itemId, quantity });
      },
      toggleSelected(itemId) {
        setState((current) => ({
          ...current,
          cart: current.cart.map((item) =>
            item.id === itemId ? { ...item, selected: !item.selected } : item,
          ),
        }));
      },
      removeItems(itemIds) {
        setState((current) => {
          setLastRemoved(current.cart.filter((item) => itemIds.includes(item.id)));
          return { ...current, cart: current.cart.filter((item) => !itemIds.includes(item.id)) };
        });
        trackBusiness("remove_cart_item", { itemIds });
      },
      undoRemove() {
        if (!lastRemoved.length) return;
        setState((current) => ({ ...current, cart: [...current.cart, ...lastRemoved] }));
        trackBusiness("undo_remove_cart_item", { count: lastRemoved.length });
        setLastRemoved([]);
      },
      toggleFavorite(productId) {
        setState((current) => ({
          ...current,
          favorites: current.favorites.includes(productId)
            ? current.favorites.filter((id) => id !== productId)
            : [...current.favorites, productId],
        }));
        trackBusiness("toggle_favorite", { productId });
      },
      toggleCompare(productId) {
        setState((current) => {
          const has = current.compare.includes(productId);
          const compare = has
            ? current.compare.filter((id) => id !== productId)
            : [...current.compare.slice(-3), productId];
          return { ...current, compare };
        });
        trackBusiness("toggle_compare", { productId });
      },
      updateCheckout(patch) {
        setState((current) => ({
          ...current,
          checkout: {
            ...current.checkout,
            ...patch,
            address: patch.address
              ? { ...current.checkout.address, ...patch.address }
              : current.checkout.address,
          },
        }));
      },
      setScenario(scenario) {
        setState((current) => ({ ...current, scenario }));
        trackBusiness("scenario_changed", { ...scenario });
      },
      clearCart() {
        setState((current) => ({ ...current, cart: [] }));
      },
    }),
    [state, cartCount, cartSubtotal, cartOpen, lastRemoved],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
