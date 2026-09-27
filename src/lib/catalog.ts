import { categories, products } from "../data/catalog";
import type { Product } from "../types";

export type SortMode = "relevance" | "sales" | "rating" | "newest" | "price-asc" | "price-desc";

export interface CatalogFilters {
  query?: string;
  category?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  sort?: SortMode;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function searchCatalog(filters: CatalogFilters): Product[] {
  const query = normalize(filters.query ?? "");
  let result = products.filter((product) => {
    if (filters.category && product.categoryId !== filters.category) return false;
    if (filters.brands?.length && !filters.brands.includes(product.brand)) return false;
    if (filters.minRating && product.rating < filters.minRating) return false;
    if (filters.inStock && !product.variants.some((variant) => variant.stock > 0)) return false;

    const lowPrice = Math.min(...product.variants.map((variant) => variant.price));
    if (filters.minPrice != null && lowPrice < filters.minPrice) return false;
    if (filters.maxPrice != null && lowPrice > filters.maxPrice) return false;

    if (query) {
      const category = categories.find((item) => item.id === product.categoryId);
      const haystack = normalize([
        product.title,
        product.subtitle,
        product.brand,
        category?.name ?? "",
        ...product.keywords,
        ...product.variants.map((variant) => variant.skuCode),
      ].join(" "));
      if (!haystack.includes(query)) {
        const tokens = query.split(/[-_/]/).filter(Boolean);
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
    }
    return true;
  });

  const sort = filters.sort ?? "relevance";
  result = [...result].sort((a, b) => {
    const aPrice = Math.min(...a.variants.map((variant) => variant.price));
    const bPrice = Math.min(...b.variants.map((variant) => variant.price));
    if (sort === "price-asc") return aPrice - bPrice;
    if (sort === "price-desc") return bPrice - aPrice;
    if (sort === "sales") return b.soldCount - a.soldCount;
    if (sort === "rating") return b.rating - a.rating;
    if (sort === "newest") return Number(b.isNew) - Number(a.isNew);
    if (query) {
      const aStarts = normalize(a.title).startsWith(query) ? 1 : 0;
      const bStarts = normalize(b.title).startsWith(query) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
    }
    return Number(b.featured) - Number(a.featured) || b.soldCount - a.soldCount;
  });

  return result;
}

export function getSuggestions(query: string) {
  const normalized = normalize(query);
  if (!normalized) return [];
  return products
    .filter((product) => normalize(`${product.title} ${product.brand}`).includes(normalized))
    .slice(0, 6);
}

export function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
