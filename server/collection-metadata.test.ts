import { describe, expect, it } from "vitest";
import {
  resolveSourceSubtype,
  seedSourceSubtypes,
  validateSubtypeIdentity,
} from "./collection-metadata";

const timestamp = "2026-10-22T00:00:00.000Z";

describe("collection metadata", () => {
  it("keeps actor labels stable while validating subtype prefixes", () => {
    expect(validateSubtypeIdentity("ai.browser_use", "ai")).toMatchObject({ ok: true });
    expect(validateSubtypeIdentity("script.browser_use", "ai")).toMatchObject({ ok: false });
    expect(validateSubtypeIdentity("robot.browser", "robot")).toMatchObject({ ok: false });
  });

  it("seeds editable defaults without duplicating existing definitions", () => {
    const first = seedSourceSubtypes([], timestamp);
    const second = seedSourceSubtypes(first.sourceSubtypes, timestamp);
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(new Set(second.sourceSubtypes.map((item) => item.id)).size).toBe(second.sourceSubtypes.length);
  });

  it("uses a legacy subtype for old clients and rejects disabled definitions", () => {
    const definitions = seedSourceSubtypes([], timestamp).sourceSubtypes;
    expect(resolveSourceSubtype(definitions, "ai", undefined)).toMatchObject({
      ok: true,
      definition: { id: "ai.legacy_unspecified" },
    });
    const disabled = definitions.map((item) => item.id === "ai.browser_use" ? { ...item, enabled: false } : item);
    expect(resolveSourceSubtype(disabled, "ai", "ai.browser_use")).toMatchObject({ ok: false });
  });
});
