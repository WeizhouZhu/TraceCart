import { describe, expect, it } from "vitest";
import { getSuggestions, searchCatalog } from "./catalog";

describe("catalog search", () => {
  it("finds products by keyword", () => {
    expect(searchCatalog({ query: "耳机" }).some((product) => product.title.includes("耳机"))).toBe(true);
  });

  it("filters by category and price", () => {
    const result = searchCatalog({ category: "computing", maxPrice: 100000 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((product) => product.categoryId === "computing")).toBe(true);
  });

  it("returns suggestions", () => {
    expect(getSuggestions("Aurora")[0]?.brand).toBe("Aurora");
  });
});
