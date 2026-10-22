import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { trackBusiness } from "../lib/telemetry";
import type { CartItem, CheckoutDraft, ScenarioSettings } from "../types";
import { useCatalog } from "./CatalogStore";

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
  refreshCart: () => void;
  clearCart: () => void;
}

const initialCheckout: CheckoutDraft = {
  address: { recipient: "", phone: "", province: "", city: "", district: "", detail: "" },
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
    const stored = JSON.parse(value) as Partial<StoreState>;
    const storedCheckout = stored.checkout;
    const normalizedAddress = { ...initialCheckout.address, ...storedCheckout?.address } as CheckoutDraft["address"] & { postalCode?: unknown };
    delete normalizedAddress.postalCode;
    return {
      ...defaultState,
      ...stored,
      cart: [],
      checkout: { ...initialCheckout, ...storedCheckout, address: normalizedAddress },
    };
  } catch {
    return defaultState;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { getProductById, getVariant } = useCatalog();
  const [state, setState] = useState<StoreState>(readState);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<CartItem[]>([]);
  const [serverSubtotal, setServerSubtotal] = useState<number | null>(null);

  function acceptCart(response: Awaited<ReturnType<typeof api.cart>>) {
    setState((current) => ({ ...current, cart: response.items }));
    setServerSubtotal(response.quote.subtotal);
  }

  useEffect(() => {
    let active = true;
    api.cart().then((response) => { if (active) acceptCart(response); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const persisted = { ...state, cart: [] };
    localStorage.setItem("tracecart.store", JSON.stringify(persisted));
    sessionStorage.setItem("tracecart.scenario", JSON.stringify(state.scenario));
  }, [state]);

  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const calculatedSubtotal = state.cart
    .filter((item) => item.selected)
    .reduce((sum, item) => {
      const product = getProductById(item.productId);
      if (!product) return sum;
      return sum + getVariant(product, item.variantId).price * item.quantity;
    }, 0);
  const cartSubtotal = serverSubtotal ?? calculatedSubtotal;

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      cartCount,
      cartSubtotal,
      cartOpen,
      setCartOpen,
      lastRemovedCount: lastRemoved.length,
      addToCart(productId, variantId, quantity = 1) {
        setCartOpen(true);
        void api.addCartItem(productId, variantId, quantity).then(acceptCart).catch(() => undefined);
        trackBusiness("add_to_cart", { productId, variantId, quantity });
      },
      updateQuantity(itemId, quantity) {
        const normalized = Math.max(1, Math.min(quantity, 99));
        setServerSubtotal(null);
        setState((current) => ({
          ...current,
          cart: current.cart.map((item) => item.id === itemId ? { ...item, quantity: normalized } : item),
        }));
        void api.updateCartItem(itemId, { quantity: normalized }).then(acceptCart).catch(() => {
          void api.cart().then(acceptCart);
        });
        trackBusiness("update_cart_quantity", { itemId, quantity: normalized });
      },
      toggleSelected(itemId) {
        const item = state.cart.find((entry) => entry.id === itemId);
        if (!item) return;
        const selected = !item.selected;
        setServerSubtotal(null);
        setState((current) => ({
          ...current,
          cart: current.cart.map((entry) => entry.id === itemId ? { ...entry, selected } : entry),
        }));
        void api.updateCartItem(itemId, { selected }).then(acceptCart).catch(() => {
          void api.cart().then(acceptCart);
        });
      },
      removeItems(itemIds) {
        const removed = state.cart.filter((item) => itemIds.includes(item.id));
        setLastRemoved(removed);
        setServerSubtotal(null);
        setState((current) => ({ ...current, cart: current.cart.filter((item) => !itemIds.includes(item.id)) }));
        void (async () => {
          let latest: Awaited<ReturnType<typeof api.cart>> | undefined;
          for (const itemId of itemIds) latest = await api.removeCartItem(itemId);
          if (latest) acceptCart(latest);
        })().catch(() => { void api.cart().then(acceptCart); });
        trackBusiness("remove_cart_item", { itemIds });
      },
      undoRemove() {
        if (!lastRemoved.length) return;
        const removed = [...lastRemoved];
        setLastRemoved([]);
        void (async () => {
          let latest: Awaited<ReturnType<typeof api.cart>> | undefined;
          for (const item of removed) latest = await api.addCartItem(item.productId, item.variantId, item.quantity);
          if (latest) acceptCart(latest);
        })().catch(() => { void api.cart().then(acceptCart); });
        trackBusiness("undo_remove_cart_item", { count: removed.length });
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
            address: patch.address ? { ...current.checkout.address, ...patch.address } : current.checkout.address,
          },
        }));
      },
      setScenario(scenario) {
        setState((current) => ({ ...current, scenario }));
        trackBusiness("scenario_changed", { ...scenario });
      },
      refreshCart() {
        void api.cart().then(acceptCart).catch(() => undefined);
      },
      clearCart() {
        setServerSubtotal(0);
        setState((current) => ({ ...current, cart: [] }));
        void api.clearCart().then(acceptCart).catch(() => undefined);
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
