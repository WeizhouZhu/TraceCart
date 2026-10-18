import { describe, expect, it } from "vitest";
import { isLowInformationUnlabeledSession } from "./data-quality";

const cutoff = Date.parse("2026-10-18T10:00:00.000Z");

describe("low-information session retention", () => {
  it("selects inactive unlabeled sessions without trajectories", () => {
    expect(isLowInformationUnlabeledSession(
      { label: null, endedAt: "2026-10-18T09:00:00.000Z" },
      { requests: 1, trajectories: 0 },
      cutoff,
    )).toBe(true);
  });

  it("never selects labeled sessions", () => {
    expect(isLowInformationUnlabeledSession(
      { label: "script", endedAt: "2026-10-18T09:00:00.000Z" },
      { requests: 0, trajectories: 0 },
      cutoff,
    )).toBe(false);
  });

  it("keeps sessions with trajectories or multiple requests", () => {
    expect(isLowInformationUnlabeledSession(
      { label: null, endedAt: "2026-10-18T09:00:00.000Z" },
      { requests: 1, trajectories: 1 },
      cutoff,
    )).toBe(false);
    expect(isLowInformationUnlabeledSession(
      { label: null, endedAt: "2026-10-18T09:00:00.000Z" },
      { requests: 2, trajectories: 0 },
      cutoff,
    )).toBe(false);
  });
});