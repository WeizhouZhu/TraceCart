import { describe, expect, it } from "vitest";
import { FailureLimiter, WindowLimiter, safeDigestEqual, sanitizeNickname, secretDigest } from "./security";

describe("access security", () => {
  it("uses a keyed one-way digest and constant-time comparison", () => {
    const digest = secretDigest("secret", "pepper");
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain("secret");
    expect(safeDigestEqual(digest, secretDigest("secret", "pepper"))).toBe(true);
    expect(safeDigestEqual(digest, secretDigest("other", "pepper"))).toBe(false);
  });

  it("locks only the failing identity for the configured period", () => {
    const limiter = new FailureLimiter();
    expect(limiter.fail("a", 2, 1_000, 5_000, 100)).toBe(0);
    expect(limiter.fail("a", 2, 1_000, 5_000, 200)).toBe(5);
    expect(limiter.check("a", 201)).toBe(5);
    expect(limiter.check("b", 201)).toBe(0);
    expect(limiter.check("a", 5_201)).toBe(0);
  });

  it("limits events using an independent sliding window", () => {
    const limiter = new WindowLimiter();
    expect(limiter.take("key", 2, 1_000, 100).allowed).toBe(true);
    expect(limiter.take("key", 2, 1_000, 200).allowed).toBe(true);
    expect(limiter.take("key", 2, 1_000, 300).allowed).toBe(false);
    expect(limiter.take("other", 2, 1_000, 300).allowed).toBe(true);
    expect(limiter.take("key", 2, 1_000, 1_201).allowed).toBe(true);
  });

  it("normalizes participant nicknames", () => {
    expect(sanitizeNickname("  alice\nadmin  ")).toBe("aliceadmin");
    expect(sanitizeNickname("x".repeat(80))).toHaveLength(40);
  });
});
