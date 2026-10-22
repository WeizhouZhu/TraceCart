import type { CartResponse, CatalogPayload, CheckoutDraft, LabelTask, Order, PaymentMethod, PaymentSession, Product, ProductResponse, ProductSuggestion, ProductVariantsResponse, SearchResponse, SessionInfo } from "../types";

const API_BASE = "";

function scenarioOutcome() {
  try {
    const raw = sessionStorage.getItem("tracecart.scenario");
    if (!raw) return "random";
    return JSON.parse(raw).paymentOutcome ?? "random";
  } catch {
    return "random";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-TraceCart-Payment-Outcome": scenarioOutcome(),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(body.message ?? `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<SessionInfo>("/api/session"),

  catalog: () => request<CatalogPayload>("/api/store/catalog"),

  searchProducts: (params: URLSearchParams) =>
    request<SearchResponse>("/api/store/search?" + params.toString()),

  suggestions: (query: string) =>
    request<{ items: ProductSuggestion[]; fetchedAt: string }>("/api/store/search/suggestions?q=" + encodeURIComponent(query)),

  product: (slug: string) =>
    request<ProductResponse>("/api/store/products/" + encodeURIComponent(slug)),

  productVariants: (slug: string) =>
    request<ProductVariantsResponse>("/api/store/products/" + encodeURIComponent(slug) + "/variants"),

  recommendations: (slug: string) =>
    request<{ items: Product[]; fetchedAt: string }>("/api/store/products/" + encodeURIComponent(slug) + "/recommendations"),

  cart: () => request<CartResponse>("/api/store/cart"),

  addCartItem: (productId: string, variantId: string, quantity: number) =>
    request<CartResponse>("/api/store/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId, variantId, quantity }),
    }),

  updateCartItem: (itemId: string, patch: { quantity?: number; selected?: boolean }) =>
    request<CartResponse>("/api/store/cart/items/" + encodeURIComponent(itemId), {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  removeCartItem: (itemId: string) =>
    request<CartResponse>("/api/store/cart/items/" + encodeURIComponent(itemId), { method: "DELETE" }),

  clearCart: () => request<CartResponse>("/api/store/cart", { method: "DELETE" }),

  checkoutQuote: (checkout: Partial<CheckoutDraft>) =>
    request<CartResponse>("/api/store/checkout/quote", {
      method: "POST",
      body: JSON.stringify({ checkout }),
    }),

  createOrder: (payload: unknown) =>
    request<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listOrders: () => request<Order[]>("/api/orders"),

  getOrder: (token: string) => request<Order>(`/api/orders/${encodeURIComponent(token)}`),

  confirmReceipt: (token: string) =>
    request<Order>(`/api/orders/${encodeURIComponent(token)}/confirm-receipt`, {
      method: "POST",
      body: "{}",
    }),

  createPayment: (orderId: string, method: PaymentMethod) =>
    request<PaymentSession>("/api/payments", {
      method: "POST",
      body: JSON.stringify({ orderId, method }),
    }),

  getPayment: (paymentId: string) =>
    request<PaymentSession>(`/api/payments/${encodeURIComponent(paymentId)}`),

  confirmPayment: (paymentId: string) =>
    request<PaymentSession>(`/api/payments/${encodeURIComponent(paymentId)}/confirm`, {
      method: "POST",
      body: "{}",
    }),

  cancelPayment: (paymentId: string) =>
    request<PaymentSession>(`/api/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: "POST",
      body: "{}",
    }),

  listTasks: () => request<LabelTask[]>("/api/collector/tasks"),

  createTask: (payload: {
    label: "human" | "script" | "ai";
    expectedIp?: string;
    expectedUserAgent?: string;
    expiresInMinutes: number;
    maxSessions: number;
    note?: string;
  }) =>
    request<LabelTask>("/api/collector/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  exportData: () =>
    request<{ files: Array<{ name: string; url: string; rows: number }> }>("/api/collector/export", {
      method: "POST",
      body: "{}",
    }),
};
