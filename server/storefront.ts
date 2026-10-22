import type { CartItem, CartQuote, CheckoutDraft, Product } from "../src/types";
import { brands, categories, getProductById, getProductBySlug, getVariant, products } from "./catalog";

export type SortMode = "relevance" | "sales" | "newest" | "price-asc" | "price-desc" | "rating";

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

export interface ValidatedCartItem {
  item: CartItem;
  product: Product;
  unitPrice: number;
  availableStock: number;
}

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("zh-CN") ?? "";
}

export function productPrice(product: Product) {
  return Math.min(...product.variants.map((variant) => variant.price));
}

export function searchCatalog(filters: CatalogFilters = {}) {
  const query = normalized(filters.query);
  let result = products.filter((product) => {
    const searchable = [
      product.title,
      product.subtitle,
      product.brand,
      product.description,
      ...product.keywords,
      ...product.highlights,
    ].join(" ").toLocaleLowerCase("zh-CN");
    const prices = product.variants.map((variant) => variant.price);
    return (!query || searchable.includes(query))
      && (!filters.category || product.categoryId === filters.category)
      && (!filters.brands?.length || filters.brands.includes(product.brand))
      && (filters.minPrice == null || Math.max(...prices) >= filters.minPrice)
      && (filters.maxPrice == null || Math.min(...prices) <= filters.maxPrice)
      && (filters.minRating == null || product.rating >= filters.minRating)
      && (!filters.inStock || product.variants.some((variant) => variant.stock > 0));
  });

  switch (filters.sort) {
    case "sales":
      result = result.sort((a, b) => b.soldCount - a.soldCount);
      break;
    case "newest":
      result = result.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
      break;
    case "price-asc":
      result = result.sort((a, b) => productPrice(a) - productPrice(b));
      break;
    case "price-desc":
      result = result.sort((a, b) => productPrice(b) - productPrice(a));
      break;
    case "rating":
      result = result.sort((a, b) => b.rating - a.rating);
      break;
    default:
      result = result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }
  return result;
}

export function getSuggestions(query: string) {
  const keyword = normalized(query);
  if (!keyword) return [];
  return products
    .filter((product) => [product.title, product.brand, ...product.keywords]
      .some((item) => item.toLocaleLowerCase("zh-CN").includes(keyword)))
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      price: productPrice(product),
      image: product.images[0],
    }));
}

export function recommendationsFor(product: Product) {
  return products
    .filter((candidate) => candidate.id !== product.id)
    .sort((a, b) => {
      const categoryScore = Number(b.categoryId === product.categoryId) - Number(a.categoryId === product.categoryId);
      return categoryScore || b.rating - a.rating || b.soldCount - a.soldCount;
    })
    .slice(0, 5);
}

export function validateCartItems(items: CartItem[]) {
  const valid: ValidatedCartItem[] = [];
  const errors: string[] = [];
  for (const item of items) {
    const product = getProductById(item.productId);
    const variant = product && getVariant(product, item.variantId);
    if (!product || !variant) {
      errors.push(`商品项 ${item.id} 不存在`);
      continue;
    }
    const quantity = Math.max(1, Math.min(99, Math.trunc(Number(item.quantity) || 1)));
    if (variant.stock < quantity) {
      errors.push(`${product.title} 库存不足`);
      continue;
    }
    valid.push({
      item: { ...item, quantity },
      product,
      unitPrice: variant.price,
      availableStock: variant.stock,
    });
  }
  return { valid, errors };
}

export function calculateCartQuote(items: CartItem[], checkout?: Partial<CheckoutDraft>): CartQuote {
  const selected = validateCartItems(items.filter((item) => item.selected)).valid;
  const subtotal = selected.reduce((sum, entry) => sum + entry.unitPrice * entry.item.quantity, 0);
  const discount = subtotal >= 50_000 ? 4_000
    : checkout?.couponCode?.trim().toUpperCase() === "TRACE30" ? Math.min(3_000, subtotal) : 0;
  const shippingByMethod = {
    standard: subtotal >= 29_900 ? 0 : 1_800,
    "next-day": 1_800,
    scheduled: 2_600,
    pickup: 0,
  } as const;
  const shipping = subtotal === 0 ? 0 : shippingByMethod[checkout?.deliveryMethod ?? "standard"];
  const giftWrap = checkout?.giftWrap && subtotal > 0 ? 1_200 : 0;
  return { subtotal, discount, shipping, total: Math.max(0, subtotal - discount + shipping + giftWrap) };
}

export function publicCatalog() {
  return { categories, brands, products };
}

export { brands, categories, getProductById, getProductBySlug, getVariant, products };

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(cents / 100);
}

function productCard(product: Product) {
  return `<article class="ssr-product"><a href="/product/${encodeURIComponent(product.slug)}"><img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.title)}" loading="eager"><h2>${escapeHtml(product.title)}</h2></a><p>${escapeHtml(product.subtitle)}</p><strong>${escapeHtml(money(productPrice(product)))}</strong><span>评分 ${product.rating} · 已售 ${product.soldCount}</span></article>`;
}

function storefrontMarkup(rawUrl: string) {
  const url = new URL(rawUrl, "http://tracecart.local");
  const pathname = url.pathname;
  let title = "TraceCart 商城";
  let description = "公开商品、分类和服务信息";
  let body = "";

  if (pathname === "/") {
    const featured = products.filter((product) => product.featured).slice(0, 8);
    body = `<header><p class="ssr-kicker">TraceCart 公开商城</p><h1>发现值得买的商品</h1><p>浏览真实结构的商品分类与公开信息；价格、规格、库存和交易信息由接口动态更新。</p></header><nav aria-label="商品分类">${categories.map((category) => `<a href="/search?category=${encodeURIComponent(category.id)}">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</a>`).join("")}</nav><section class="ssr-grid">${featured.map(productCard).join("")}</section>`;
  } else if (pathname === "/search") {
    const query = url.searchParams.get("q") ?? "";
    const category = url.searchParams.get("category") ?? undefined;
    const items = searchCatalog({ query, category }).slice(0, 12);
    title = query ? `${query} - 商品搜索` : "商品搜索";
    description = query ? `“${query}”的公开商品搜索结果` : "浏览公开商品目录";
    body = `<header><p class="ssr-kicker">商品搜索</p><h1>${escapeHtml(query || "全部商品")}</h1><p>找到 ${items.length} 个首屏结果；筛选、排序和实时信息将在页面加载后更新。</p></header><section class="ssr-grid">${items.map(productCard).join("")}</section>`;
  } else {
    const match = pathname.match(/^\/product\/([^/]+)$/);
    if (match) {
      const product = getProductBySlug(decodeURIComponent(match[1]));
      if (product) {
        title = `${product.title} - TraceCart`;
        description = product.subtitle;
        body = `<article class="ssr-detail"><img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.title)}"><div><p class="ssr-kicker">${escapeHtml(product.brand)}</p><h1>${escapeHtml(product.title)}</h1><p>${escapeHtml(product.subtitle)}</p><strong>${escapeHtml(money(productPrice(product)))} 起</strong><p>评分 ${product.rating} · ${product.reviewCount} 条评价 · 已售 ${product.soldCount}</p><p>${escapeHtml(product.description)}</p><ul>${product.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p>具体 SKU、实时价格和库存将在页面加载后通过接口获取。</p></div></article>`;
      }
    } else if (pathname === "/service") {
      title = "客户服务 - TraceCart";
      description = "配送、退换货和支付服务";
      body = '<header><p class="ssr-kicker">客户服务</p><h1>购物服务与帮助</h1><p>支持标准配送、次日达、预约配送与到店自提。商品支持依法退换，订单与支付状态在页面加载后动态查询。</p></header>';
    }
  }

  if (!body) {
    body = '<header><p class="ssr-kicker">TraceCart</p><h1>安全购物体验</h1><p>此页面的账户、购物车、结算或订单信息将在页面加载后动态获取。</p></header>';
  }
  return { title, description, body };
}

export function renderStorefrontDocument(template: string, rawUrl: string) {
  const rendered = storefrontMarkup(rawUrl);
  const style = `<style id="ssr-style">#ssr-content{font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif;color:#172033;background:#f7f8fb;min-height:100vh;padding:32px}.ssr-shell{max-width:1200px;margin:auto}.ssr-kicker{color:#3563e9;font-weight:700}.ssr-shell h1{font-size:36px;margin:8px 0}.ssr-shell nav{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}.ssr-shell nav a{background:white;border:1px solid #e3e7ef;border-radius:999px;padding:9px 14px;color:#172033;text-decoration:none}.ssr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;margin-top:28px}.ssr-product{background:white;border:1px solid #e3e7ef;border-radius:16px;padding:16px;display:grid;gap:8px}.ssr-product img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px}.ssr-product a{color:inherit;text-decoration:none}.ssr-product h2{font-size:17px;margin:10px 0 0}.ssr-product p{color:#667085;margin:0}.ssr-product strong,.ssr-detail strong{color:#e5484d;font-size:20px}.ssr-product span{color:#667085;font-size:13px}.ssr-detail{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,1fr);gap:40px;background:white;padding:24px;border-radius:18px}.ssr-detail>img{width:100%;border-radius:14px}@media(max-width:720px){#ssr-content{padding:20px}.ssr-detail{grid-template-columns:1fr}.ssr-shell h1{font-size:28px}}</style>`;
  return template
    .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(rendered.title)}</title>`)
    .replace("</head>", `<meta name="description" content="${escapeHtml(rendered.description)}">${style}</head>`)
    .replace('<div id="root"></div>', `<div id="ssr-content" data-render-mode="partial-ssr"><main class="ssr-shell">${rendered.body}</main></div><div id="root"></div>`);
}
