import type { LabelTask, Order, PaymentMethod, PaymentSession, SessionInfo } from "../types";

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

  createOrder: (payload: unknown) =>
    request<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getOrder: (token: string) => request<Order>(`/api/orders/${encodeURIComponent(token)}`),

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
