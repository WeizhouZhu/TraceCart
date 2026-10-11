import { describe, expect, it } from "vitest";
import {
  advanceOrderLifecycle,
  confirmOrderReceipt,
  markOrderPaid,
  ORDER_COMPLETE_AFTER_MS,
  ORDER_SHIP_AFTER_MS,
  type LifecycleOrder,
} from "./order-lifecycle";

function paidOrder(): LifecycleOrder {
  return {
    status: "paid",
    createdAt: "2026-10-01T00:00:00.000Z",
    paidAt: "2026-10-01T01:00:00.000Z",
  };
}

describe("order lifecycle", () => {
  it("keeps a recently paid order in processing", () => {
    const order = paidOrder();
    const changed = advanceOrderLifecycle(order, Date.parse(order.paidAt!) + ORDER_SHIP_AFTER_MS - 1);
    expect(changed).toBe(false);
    expect(order.status).toBe("paid");
  });

  it("ships after one day and completes after three days", () => {
    const order = paidOrder();
    const paidAt = Date.parse(order.paidAt!);

    expect(advanceOrderLifecycle(order, paidAt + ORDER_SHIP_AFTER_MS)).toBe(true);
    expect(order.status).toBe("shipped");
    expect(order.shippedAt).toBe("2026-10-02T01:00:00.000Z");

    expect(advanceOrderLifecycle(order, paidAt + ORDER_COMPLETE_AFTER_MS)).toBe(true);
    expect(order.status).toBe("completed");
    expect(order.completedAt).toBe("2026-10-04T01:00:00.000Z");
  });

  it("supports an explicit customer receipt confirmation", () => {
    const order = paidOrder();
    const paidAt = Date.parse(order.paidAt!);
    advanceOrderLifecycle(order, paidAt + ORDER_SHIP_AFTER_MS);
    expect(confirmOrderReceipt(order, "2026-10-02T06:00:00.000Z")).toBe(true);
    expect(order.status).toBe("completed");
    expect(order.completedAt).toBe("2026-10-02T06:00:00.000Z");
  });

  it("records the payment timestamp when payment succeeds", () => {
    const order: LifecycleOrder = { status: "awaiting_payment", createdAt: "2026-10-01T00:00:00.000Z" };
    markOrderPaid(order, "2026-10-01T02:00:00.000Z");
    expect(order.status).toBe("paid");
    expect(order.paidAt).toBe("2026-10-01T02:00:00.000Z");
  });
});
