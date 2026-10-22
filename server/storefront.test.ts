import { describe, expect, it } from "vitest";
import { calculateCartQuote, getSuggestions, products, renderStorefrontDocument, searchCatalog } from "./storefront";

describe("storefront backend", () => {
  it("searches and filters the server-side catalog", () => {
    expect(searchCatalog({ query: "耳机" }).some((product) => product.title.includes("耳机"))).toBe(true);
    const result = searchCatalog({ category: "computing", maxPrice: 100_000 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((product) => product.categoryId === "computing")).toBe(true);
    expect(getSuggestions("Aurora")[0]?.brand).toBe("Aurora");
  });

  it("validates cart pricing on the server", () => {
    const product = products[0];
    const variant = product.variants[0];
    const item = {
      id: "line-1",
      productId: product.id,
      variantId: variant.id,
      quantity: 2,
      selected: true,
      addedAt: new Date().toISOString(),
    };
    const quote = calculateCartQuote([item], {
      deliveryMethod: "next-day",
      couponCode: "TRACE30",
      giftWrap: true,
    });
    expect(quote.subtotal).toBe(variant.price * 2);
    expect(quote.shipping).toBe(1800);
    expect(quote.total).toBe(quote.subtotal - quote.discount + quote.shipping + 1200);
  });

  it("renders public product information into the initial HTML", () => {
    const product = products[0];
    const document = renderStorefrontDocument(
      '<html><head><title>TraceCart</title></head><body><div id="root"></div></body></html>',
      "/product/" + product.slug,
    );
    expect(document).toContain('data-render-mode="partial-ssr"');
    expect(document).toContain(product.title);
    expect(document).toContain("具体 SKU、实时价格和库存将在页面加载后通过接口获取");
    expect(document).not.toContain(`剩余 ${product.variants[0].stock} 件`);
  });
});
