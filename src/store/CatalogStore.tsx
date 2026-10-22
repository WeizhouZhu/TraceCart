import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { CatalogPayload, Product, ProductVariant } from "../types";

interface CatalogContextValue extends CatalogPayload {
  getProductById: (id: string) => Product | undefined;
  getProductBySlug: (slug: string) => Product | undefined;
  getVariant: (product: Product, variantId: string) => ProductVariant;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.catalog()
      .then((payload) => {
        if (!active) return;
        setCatalog(payload);
        document.getElementById("ssr-content")?.remove();
        document.getElementById("ssr-style")?.remove();
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "商品数据加载失败");
      });
    return () => { active = false; };
  }, []);

  const value = useMemo<CatalogContextValue | null>(() => {
    if (!catalog) return null;
    const byId = new Map(catalog.products.map((product) => [product.id, product]));
    const bySlug = new Map(catalog.products.map((product) => [product.slug, product]));
    return {
      ...catalog,
      getProductById: (id) => byId.get(id),
      getProductBySlug: (slug) => bySlug.get(slug),
      getVariant: (product, variantId) =>
        product.variants.find((variant) => variant.id === variantId) ?? product.variants[0],
    };
  }, [catalog]);

  if (!value) {
    if (!error) return null;
    return <div className="container empty-state large"><h1>商品数据暂时无法加载</h1><p>{error}</p><button className="button button--primary" onClick={() => window.location.reload()}>重新加载</button></div>;
  }
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside CatalogProvider");
  return context;
}
