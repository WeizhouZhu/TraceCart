import type { OrderStatus } from "../src/types";

export const ORDER_SHIP_AFTER_MS = 24 * 60 * 60 * 1000;
export const ORDER_COMPLETE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export interface LifecycleOrder {
  status: OrderStatus;
  createdAt: string;
  statusUpdatedAt?: string;
  paidAt?: string;
  shippedAt?: string;
  completedAt?: string;
}

export function markOrderPaid(order: LifecycleOrder, timestamp = new Date().toISOString()) {
  order.status = "paid";
  order.paidAt = timestamp;
  order.statusUpdatedAt = timestamp;
}

export function confirmOrderReceipt(order: LifecycleOrder, timestamp = new Date().toISOString()) {
  if (order.status === "completed") return false;
  if (order.status !== "shipped") return false;
  order.status = "completed";
  order.completedAt = timestamp;
  order.statusUpdatedAt = timestamp;
  return true;
}

export function advanceOrderLifecycle(order: LifecycleOrder, currentTime = Date.now()) {
  if (order.status !== "paid" && order.status !== "shipped") return false;
  const paidAt = Date.parse(order.paidAt ?? order.createdAt);
  if (!Number.isFinite(paidAt)) return false;

  const shipAt = paidAt + ORDER_SHIP_AFTER_MS;
  const completeAt = paidAt + ORDER_COMPLETE_AFTER_MS;
  let changed = false;

  if (currentTime >= completeAt) {
    if (!order.shippedAt) order.shippedAt = new Date(shipAt).toISOString();
      order.status = "completed";
      order.completedAt = new Date(completeAt).toISOString();
      order.statusUpdatedAt = order.completedAt;
      changed = true;
    return changed;
  }

  if (currentTime >= shipAt && order.status === "paid") {
    order.status = "shipped";
    order.shippedAt = new Date(shipAt).toISOString();
    order.statusUpdatedAt = order.shippedAt;
    changed = true;
  }

  return changed;
}
