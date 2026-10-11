import { createHmac, timingSafeEqual } from "node:crypto";

interface FailureState {
  failures: number[];
  lockedUntil: number;
}

export class FailureLimiter {
  private readonly states = new Map<string, FailureState>();

  check(key: string, current = Date.now()) {
    const state = this.states.get(key);
    if (!state || state.lockedUntil <= current) return 0;
    return Math.ceil((state.lockedUntil - current) / 1000);
  }

  fail(key: string, limit: number, windowMs: number, lockMs: number, current = Date.now()) {
    const previous = this.states.get(key) ?? { failures: [], lockedUntil: 0 };
    const failures = previous.failures.filter((value) => value > current - windowMs);
    failures.push(current);
    const lockedUntil = failures.length >= limit ? current + lockMs : previous.lockedUntil;
    this.states.set(key, { failures, lockedUntil });
    return lockedUntil > current ? Math.ceil((lockedUntil - current) / 1000) : 0;
  }

  success(key: string) {
    this.states.delete(key);
  }
}

export class WindowLimiter {
  private readonly events = new Map<string, number[]>();

  take(key: string, limit: number, windowMs: number, current = Date.now()) {
    const values = (this.events.get(key) ?? []).filter((value) => value > current - windowMs);
    if (values.length >= limit) {
      this.events.set(key, values);
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((values[0] + windowMs - current) / 1000)),
      };
    }
    values.push(current);
    this.events.set(key, values);
    return { allowed: true, retryAfter: 0 };
  }
}

export function secretDigest(secret: string, pepper: string) {
  return createHmac("sha256", pepper).update(secret, "utf8").digest("hex");
}

export function safeDigestEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function sanitizeNickname(value: unknown) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 40);
}
