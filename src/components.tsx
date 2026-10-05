import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  GitCompareArrows,
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  UserRoundSearch,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { categories, getProductById, getVariant, products } from "./data/catalog";
import { getSuggestions, money } from "./lib/catalog";
import { isCatalogTabActive } from "./lib/navigation";
import { trackBusiness } from "./lib/telemetry";
import { useStore } from "./store/AppStore";
import type { CartItem, Product } from "./types";

const categoryEmoji: Record<string, string> = {
  digital: "🎧",
  computing: "💻",
  home: "🏠",
  wellness: "✨",
  outdoor: "🏕️",
  fashion: "👜",
  grocery: "☕",
  books: "📚",
};

export function PageShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Header />
      <main>{children}</main>
      <CompareDock />
      <CartDrawer />
      <Footer />
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, favorites, setCartOpen } = useStore();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const suggestions = useMemo(() => getSuggestions(query), [query]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    trackBusiness("search_submit", { query: value, source: "header" });
    setFocused(false);
    navigate("/search?q=" + encodeURIComponent(value));
  }

  return (
    <>
      <div className="service-strip">
        <div className="container service-strip__inner">
          <span>配送至：广州市</span>
          <span className="service-strip__notice">正品保障 · 满 99 元免运费</span>
          <nav aria-label="辅助导航">
            <Link to="/service">帮助中心</Link>
            <Link to="/favorites">我的收藏</Link>
            <Link to="/cart">购物车</Link>
          </nav>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <Link className="brand" to="/" data-track-id="header-logo">
            <span className="brand__mark">T</span>
            <span>
              <strong>TraceCart</strong>
              <small>CURATED MARKET</small>
            </span>
          </Link>

          <div className="header-categories">
            <button
              className="category-trigger"
              onClick={() => setMegaOpen((value) => !value)}
              data-track-id="category-menu-trigger"
              aria-expanded={megaOpen}
            >
              <Menu size={18} />
              全部分类
              <ChevronDown size={16} />
            </button>
            {megaOpen && (
              <div className="mega-menu card-elevated">
                <div className="mega-menu__list">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      to={"/search?category=" + category.slug}
                      onClick={() => setMegaOpen(false)}
                      data-track-id={"mega-category-" + category.id}
                    >
                      <span>{categoryEmoji[category.id]}</span>
                      <span>
                        <strong>{category.name}</strong>
                        <small>{category.description}</small>
                      </span>
                      <ArrowRight size={15} />
                    </Link>
                  ))}
                </div>
                <div className="mega-menu__feature">
                  <span className="eyebrow">本周策展</span>
                  <h3>让工作与生活<br />更从容的 24 件好物</h3>
                  <p>从桌面效率到周末户外，探索编辑精选。</p>
                  <Link className="text-link" to="/search?sort=rating" onClick={() => setMegaOpen(false)}>
                    查看精选 <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="global-search" ref={searchRef}>
            <form onSubmit={submit}>
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="搜索商品、品牌或 SKU"
                aria-label="搜索商品"
                data-track-id="global-search-input"
              />
              {query && (
                <button type="button" className="icon-button subtle" onClick={() => setQuery("")} aria-label="清空">
                  <X size={16} />
                </button>
              )}
              <button type="submit" className="search-submit" data-track-id="global-search-submit">搜索</button>
            </form>
            {focused && (
              <div className="search-suggest card-elevated">
                {!query ? (
                  <>
                    <div className="suggest-section">
                      <span className="suggest-title">热门搜索</span>
                      <div className="chip-row">
                        {["降噪耳机", "机械键盘", "通勤背包", "咖啡豆", "台灯"].map((term) => (
                          <button key={term} onClick={() => { setQuery(term); navigate("/search?q=" + encodeURIComponent(term)); setFocused(false); }}>
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="suggest-section">
                      <span className="suggest-title">浏览分类</span>
                      <div className="suggest-categories">
                        {categories.slice(0, 4).map((category) => (
                          <Link key={category.id} to={"/search?category=" + category.slug} onClick={() => setFocused(false)}>
                            {categoryEmoji[category.id]} {category.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : suggestions.length ? (
                  <>
                    <span className="suggest-title">商品建议</span>
                    {suggestions.map((product) => (
                      <Link
                        className="suggest-product"
                        to={"/product/" + product.slug}
                        key={product.id}
                        onClick={() => setFocused(false)}
                      >
                        <img src={product.images[0]} alt="" />
                        <span>
                          <strong>{product.title}</strong>
                          <small>{product.brand} · {money(product.variants[0].price)}</small>
                        </span>
                        <ArrowRight size={16} />
                      </Link>
                    ))}
                    <button className="suggest-all" onClick={() => { navigate("/search?q=" + encodeURIComponent(query)); setFocused(false); }}>
                      查看“{query}”的全部结果
                    </button>
                  </>
                ) : (
                  <div className="suggest-empty">
                    <UserRoundSearch size={30} />
                    <strong>未找到直接匹配</strong>
                    <span>按 Enter 搜索全部商品与关键词</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="header-actions">
            <Link to="/favorites" className="header-action" data-track-id="header-favorites">
              <span className="icon-wrap"><Heart size={20} /><em>{favorites.length}</em></span>
              <small>收藏</small>
            </Link>
            <button className="header-action" onClick={() => setCartOpen(true)} data-track-id="header-cart">
              <span className="icon-wrap"><ShoppingBag size={20} /><em>{cartCount}</em></span>
              <small>购物车</small>
            </button>
          </div>
        </div>
        <nav className="container category-nav" aria-label="主要分类">
          <NavLink to="/" end>首页</NavLink>
          {categories.slice(0, 6).map((category) => (
            <Link
              className={isCatalogTabActive(location.pathname, location.search, { type: "category", value: category.slug }) ? "active" : undefined}
              key={category.id}
              to={"/search?category=" + category.slug}
            >
              {category.name}
            </Link>
          ))}
          <Link
            className={isCatalogTabActive(location.pathname, location.search, { type: "sort", value: "rating" }) ? "active" : undefined}
            to="/search?sort=rating"
          >
            编辑精选
          </Link>
        </nav>
      </header>
    </>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="breadcrumbs" aria-label="面包屑">
      <Link to="/">首页</Link>
      {items.map((item, index) => (
        <span key={item.label}>
          <span>/</span>
          {item.to && index < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <em>{item.label}</em>}
        </span>
      ))}
    </nav>
  );
}

export function Rating({ value, count, compact = false }: { value: number; count?: number; compact?: boolean }) {
  return (
    <span className={"rating " + (compact ? "rating--compact" : "")}>
      <Star size={compact ? 13 : 15} fill="currentColor" />
      <strong>{value.toFixed(1)}</strong>
      {count != null && <span>({count.toLocaleString("zh-CN")})</span>}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { favorites, compare, toggleFavorite, toggleCompare, addToCart } = useStore();
  const variant = product.variants[0];
  const isFavorite = favorites.includes(product.id);
  const isCompared = compare.includes(product.id);

  return (
    <article className="product-card" data-track-id={"product-card-" + product.id}>
      <div className="product-card__media">
        <Link to={"/product/" + product.slug}>
          <img src={product.images[0]} alt={product.title} loading="lazy" />
        </Link>
        <div className="badge-stack">
          {product.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}
        </div>
        <div className="card-tools">
          <button
            className={isFavorite ? "active" : ""}
            onClick={() => toggleFavorite(product.id)}
            aria-label={isFavorite ? "取消收藏" : "收藏"}
            data-track-id={"favorite-" + product.id}
          >
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            className={isCompared ? "active" : ""}
            onClick={() => toggleCompare(product.id)}
            aria-label={isCompared ? "移出对比" : "加入对比"}
            data-track-id={"compare-" + product.id}
          >
            <GitCompareArrows size={17} />
          </button>
        </div>
      </div>
      <div className="product-card__content">
        <span className="product-brand">{product.brand}</span>
        <Link className="product-title" to={"/product/" + product.slug}>{product.title}</Link>
        <p>{product.subtitle}</p>
        <Rating value={product.rating} count={product.reviewCount} compact />
        <div className="product-price-row">
          <div>
            <strong>{money(variant.price)}</strong>
            {variant.compareAtPrice && <del>{money(variant.compareAtPrice)}</del>}
          </div>
          <span className={variant.stock < 10 ? "stock-low" : ""}>
            {variant.stock < 10 ? "仅剩 " + variant.stock + " 件" : "现货"}
          </span>
        </div>
        <button
          className="button button--dark button--full"
          onClick={() => addToCart(product.id, variant.id)}
          data-track-id={"quick-add-" + product.id}
        >
          <ShoppingBag size={17} />
          {product.variants.length > 1 ? "快速加入" : "加入购物车"}
        </button>
      </div>
    </article>
  );
}

export function ProductGrid({ items, emptyText = "没有符合条件的商品" }: { items: Product[]; emptyText?: string }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Search size={38} />
        <h3>{emptyText}</h3>
        <p>试试减少筛选条件，或搜索其他关键词。</p>
        <Link className="button button--primary" to="/search">查看全部商品</Link>
      </div>
    );
  }
  return <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

export function QuantityControl({
  value,
  onChange,
  max = 99,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  compact?: boolean;
}) {
  return (
    <div className={"quantity " + (compact ? "quantity--compact" : "")}>
      <button onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="减少数量">
        <Minus size={14} />
      </button>
      <input
        value={value}
        onChange={(event) => onChange(Math.max(1, Math.min(max, Number(event.target.value) || 1)))}
        aria-label="商品数量"
      />
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="增加数量">
        <Plus size={14} />
      </button>
    </div>
  );
}

export function CartLine({
  item,
  compact = false,
}: {
  item: CartItem;
  compact?: boolean;
}) {
  const { updateQuantity, removeItems, toggleSelected } = useStore();
  const product = getProductById(item.productId);
  if (!product) return null;
  const variant = getVariant(product, item.variantId);

  return (
    <div className={"cart-line " + (compact ? "cart-line--compact" : "")} data-track-id={"cart-line-" + item.id}>
      {!compact && (
        <input
          type="checkbox"
          checked={item.selected}
          onChange={() => toggleSelected(item.id)}
          aria-label={"选择 " + product.title}
        />
      )}
      <Link to={"/product/" + product.slug} className="cart-line__image">
        <img src={variant.image ?? product.images[0]} alt={product.title} />
      </Link>
      <div className="cart-line__info">
        <Link to={"/product/" + product.slug}>{product.title}</Link>
        <small>{Object.values(variant.attributes).join(" · ")}</small>
        {compact ? (
          <span>{item.quantity} × {money(variant.price)}</span>
        ) : (
          <QuantityControl
            value={item.quantity}
            max={variant.stock}
            compact
            onChange={(quantity) => updateQuantity(item.id, quantity)}
          />
        )}
      </div>
      <div className="cart-line__end">
        <strong>{money(variant.price * item.quantity)}</strong>
        <button onClick={() => removeItems([item.id])} aria-label="删除商品" data-track-id={"remove-cart-" + item.id}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function CartDrawer() {
  const { cart, cartOpen, setCartOpen, cartCount, cartSubtotal, lastRemovedCount, undoRemove } = useStore();

  if (!cartOpen) return null;
  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-backdrop" onClick={() => setCartOpen(false)} aria-label="关闭购物车" />
      <aside className="cart-drawer" aria-label="迷你购物车">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">YOUR BAG</span>
            <h2>购物车 <small>{cartCount} 件</small></h2>
          </div>
          <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="关闭">
            <X size={21} />
          </button>
        </div>
        {lastRemovedCount > 0 && (
          <div className="undo-banner">
            已删除 {lastRemovedCount} 件商品
            <button onClick={undoRemove}>撤销</button>
          </div>
        )}
        <div className="drawer-content">
          {cart.length ? cart.map((item) => <CartLine item={item} compact key={item.id} />) : (
            <div className="empty-state compact">
              <ShoppingBag size={42} />
              <h3>购物车还是空的</h3>
              <p>去挑选一些适合你的好物吧。</p>
              <Link className="button button--primary" to="/search" onClick={() => setCartOpen(false)}>开始选购</Link>
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="drawer-footer">
            <div><span>预计合计</span><strong>{money(cartSubtotal)}</strong></div>
            <small>运费和优惠将在结算时计算</small>
            <Link className="button button--primary button--full" to="/cart" onClick={() => setCartOpen(false)}>
              查看购物车
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function CompareDock() {
  const { compare, toggleCompare } = useStore();
  if (!compare.length) return null;
  const items = compare.map(getProductById).filter(Boolean) as Product[];
  return (
    <div className="compare-dock card-elevated">
      <div>
        <strong>商品对比</strong>
        <small>已选择 {items.length}/4</small>
      </div>
      <div className="compare-dock__items">
        {items.map((product) => (
          <span key={product.id}>
            <img src={product.images[0]} alt="" />
            <em>{product.title}</em>
            <button onClick={() => toggleCompare(product.id)} aria-label="移出对比"><X size={13} /></button>
          </span>
        ))}
      </div>
      <Link className="button button--dark" to="/compare">开始对比</Link>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand brand--footer" to="/">
            <span className="brand__mark">T</span>
            <span><strong>TraceCart</strong><small>CURATED MARKET</small></span>
          </Link>
          <p>发现兼具设计、品质与实用价值的日常好物，让每一次选购都更简单从容。</p>
        </div>
        <div><strong>购物指南</strong><Link to="/search">全部商品</Link><Link to="/cart">购物车</Link><Link to="/service">配送说明</Link></div>
        <div><strong>客户服务</strong><Link to="/service">退换货政策</Link><Link to="/service">支付与配送</Link><Link to="/favorites">我的收藏</Link></div>
        <div><strong>联系我们</strong><span>客服时间 9:00–21:00</span><span>配送覆盖全国主要城市</span><span>在线客服全天候响应</span></div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 TraceCart</span>
        <span>隐私政策 · 用户协议 · 消费者权益</span>
      </div>
    </footer>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  link,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  link?: { label: string; to: string };
}) {
  return (
    <div className="section-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {link && <Link className="text-link" to={link.to}>{link.label} <ArrowRight size={16} /></Link>}
    </div>
  );
}
