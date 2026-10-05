import { describe, expect, it } from "vitest";
import { isCatalogTabActive } from "./navigation";

describe("isCatalogTabActive", () => {
  it("only activates the matching category", () => {
    const search = "?category=digital";
    expect(isCatalogTabActive("/search", search, { type: "category", value: "digital" })).toBe(true);
    expect(isCatalogTabActive("/search", search, { type: "category", value: "computing" })).toBe(false);
    expect(isCatalogTabActive("/search", search, { type: "sort", value: "rating" })).toBe(false);
  });

  it("only activates editor picks for its exact search state", () => {
    expect(isCatalogTabActive("/search", "?sort=rating", { type: "sort", value: "rating" })).toBe(true);
    expect(isCatalogTabActive("/search", "?sort=sales", { type: "sort", value: "rating" })).toBe(false);
  });

  it("only activates home on the home route", () => {
    expect(isCatalogTabActive("/", "", { type: "home" })).toBe(true);
    expect(isCatalogTabActive("/search", "", { type: "home" })).toBe(false);
  });
});
