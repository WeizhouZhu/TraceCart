import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  GitCompareArrows,
  Heart,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Truck,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Breadcrumbs,
  CartLine,
  ProductGrid,
  QuantityControl,
  Rating,
  SectionHeader,
} from "../components";
import { brands, categories, getProductById, getProductBySlug, getVariant, products } from "../data/catalog";
import { money, searchCatalog, type SortMode } from "../lib/catalog";
import { trackBusiness } from "../lib/telemetry";
import { useStore } from "../store/AppStore";

function useTitle(title: string) {
  useEffect(() => {
    document.title = title + " · TraceCart";
  }, [title]);
}

export function HomePage() {
  useTitle("品质生活商城");
  const featured = products.filter((product) => product.featured).slice(0, 10);
  const newItems = products.filter((product) => product.isNew).slice(0, 5);
  const heroProduct = products[0];

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="hero-kicker"><Sparkles size={16} /> EDITOR'S CHOICE · 2026</span>
            <h1>把复杂生活，<br /><em>整理得刚刚好。</em></h1>
            <p>从专注工作的桌面设备，到周末出发的户外装备。精选设计与可靠功能兼备的日常好物。</p>
            <div className="hero__actions">
              <Link className="button button--primary button--large" to="/search?sort=rating" data-track-id="hero-shop">
                探索编辑精选 <ArrowRight size={18} />
              </Link>
              <Link className="button button--ghost button--large" to={"/product/" + heroProduct.slug}>
                查看本期主打
              </Link>
            </div>
            <div className="hero__proof">
              <span><strong>40+</strong><small>精选商品</small></span>
              <span><strong>8</strong><small>生活分类</small></span>
              <span><strong>4.8</strong><small>平均评分</small></span>
            </div>
          </div>
          <div className="hero__visual">
            <div className="hero-orbit hero-orbit--one" />
            <div className="hero-orbit hero-orbit--two" />
            <img src={heroProduct.images[0]} alt={heroProduct.title} />
            <div className="hero-product-note">
              <span>本期主打</span>
              <strong>{heroProduct.title}</strong>
              <em>{money(heroProduct.variants[0].price)}</em>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-row">
        <div className="container">
          <span><Truck size={21} /><strong>快速配送</strong><small>多种配送方式灵活选择</small></span>
          <span><ShieldCheck size={21} /><strong>安全支付</strong><small>多重保护，支付更安心</small></span>
          <span><RefreshCw size={21} /><strong>30 天无忧退换</strong><small>售后流程清晰便捷</small></span>
          <span><PackageCheck size={21} /><strong>品质保障</strong><small>严格选品与库存管理</small></span>
        </div>
      </section>

      <section className="page-section container">
        <SectionHeader
          eyebrow="SHOP BY CATEGORY"
          title="按你的生活方式探索"
          description="八个精心组织的商品分类，丰富规格与筛选帮助你快速找到心仪好物。"
        />
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link
              to={"/search?category=" + category.slug}
              className="category-tile"
              style={{ "--accent": category.accent } as React.CSSProperties}
              key={category.id}
              data-track-id={"home-category-" + category.id}
            >
              <span className="category-tile__number">0{index + 1}</span>
              <div>
                <span className="category-tile__emoji">{["🎧", "💻", "🏠", "✨", "🏕️", "👜", "☕", "📚"][index]}</span>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </div>
              <ArrowRight size={20} />
            </Link>
          ))}
        </div>
      </section>

      <section className="page-section page-section--tinted">
        <div className="container">
          <SectionHeader
            eyebrow="TRENDING NOW"
            title="此刻值得入手"
            description="由销量、评分与编辑推荐共同选出的本周人气商品。"
            link={{ label: "查看全部", to: "/search?sort=sales" }}
          />
          <ProductGrid items={featured.slice(0, 5)} />
        </div>
      </section>

      <section className="story-banner container">
        <div className="story-banner__copy">
          <span className="eyebrow">WORKSPACE EDIT</span>
          <h2>重新设计你的专注空间</h2>
          <p>把显示、输入、声音与照明组织成真正服务于工作节奏的桌面系统。</p>
          <Link className="button button--light" to="/search?category=computing">选购桌面好物</Link>
        </div>
        <div className="story-banner__image">
          <img src={products.find((product) => product.categoryId === "computing")?.images[0]} alt="桌面设备" />
        </div>
      </section>

      <section className="page-section container">
        <SectionHeader
          eyebrow="JUST ARRIVED"
          title="新品抵达"
          description="新材质、新功能，以及更适合当下生活的新选择。"
          link={{ label: "查看新品", to: "/search?sort=newest" }}
        />
        <ProductGrid items={newItems} />
      </section>

      <section className="newsletter">
        <div className="container newsletter__inner">
          <div><span className="eyebrow">WEEKLY EDIT</span><h2>订阅 TraceCart 灵感周报</h2><p>新品、编辑精选与限时优惠，每周送达你的邮箱。</p></div>
          <form onSubmit={(event) => event.preventDefault()} data-track-mask>
            <input placeholder="请输入邮箱地址" aria-label="订阅邮箱" />
            <button className="button button--primary">立即订阅</button>
          </form>
        </div>
      </section>
    </>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = (params.get("sort") ?? "relevance") as SortMode;
  const brandParams = params.get("brand")?.split(",").filter(Boolean) ?? [];
  const [brandSearch, setBrandSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  useTitle(query ? "搜索：" + query : category ? categories.find((item) => item.slug === category)?.name ?? "商品分类" : "全部商品");

  const minPrice = Number(params.get("minPrice") ?? 0);
  const maxPrice = Number(params.get("maxPrice") ?? 0);
  const rating = Number(params.get("rating") ?? 0);
  const inStock = params.get("inStock") === "1";

  const result = useMemo(
    () =>
      searchCatalog({
        query,
        category: category || undefined,
        brands: brandParams,
        minPrice: minPrice ? minPrice * 100 : undefined,
        maxPrice: maxPrice ? maxPrice * 100 : undefined,
        minRating: rating || undefined,
        inStock,
        sort,
      }),
    [query, category, params.toString()],
  );

  const categoryInfo = categories.find((item) => item.slug === category);

  function update(name: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    setParams(next);
    trackBusiness("apply_filter", { name, value: value ?? null });
  }

  function toggleBrand(brand: string) {
    const next = brandParams.includes(brand)
      ? brandParams.filter((item) => item !== brand)
      : [...brandParams, brand];
    update("brand", next.join(","));
  }

  const activeCount = [brandParams.length > 0, minPrice > 0, maxPrice > 0, rating > 0, inStock].filter(Boolean).length;

  return (
    <div className="container listing-page">
      <Breadcrumbs items={[{ label: categoryInfo?.name ?? (query ? "搜索结果" : "全部商品") }]} />
      <div className="listing-hero">
        <div>
          <span className="eyebrow">{query ? "SEARCH RESULTS" : "COLLECTION"}</span>
          <h1>{query ? "“" + query + "”的搜索结果" : categoryInfo?.name ?? "全部商品"}</h1>
          <p>{categoryInfo?.description ?? "探索由设计、功能与真实使用场景组织的精选商品。"}</p>
        </div>
        <div className="result-count"><strong>{result.length}</strong><span>件商品</span></div>
      </div>

      <div className="listing-toolbar">
        <button className="filter-toggle" onClick={() => setFiltersOpen((value) => !value)}>
          <SlidersHorizontal size={17} /> 筛选 {activeCount > 0 && <em>{activeCount}</em>}
        </button>
        <div className="active-filters">
          {brandParams.map((brand) => <button key={brand} onClick={() => toggleBrand(brand)}>{brand}<X size={12} /></button>)}
          {inStock && <button onClick={() => update("inStock")}>仅看有货<X size={12} /></button>}
          {rating > 0 && <button onClick={() => update("rating")}>{rating} 星以上<X size={12} /></button>}
        </div>
        <label>
          排序
          <select value={sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="relevance">综合推荐</option>
            <option value="sales">销量优先</option>
            <option value="rating">评分优先</option>
            <option value="newest">新品优先</option>
            <option value="price-asc">价格从低到高</option>
            <option value="price-desc">价格从高到低</option>
          </select>
        </label>
      </div>

      <div className={"listing-layout " + (filtersOpen ? "" : "listing-layout--wide")}>
        {filtersOpen && (
          <aside className="filters">
            <FilterBlock title="商品分类">
              <button className={!category ? "selected" : ""} onClick={() => update("category")}>全部分类</button>
              {categories.map((item) => (
                <button className={category === item.slug ? "selected" : ""} key={item.id} onClick={() => update("category", item.slug)}>
                  <span>{item.name}</span><ChevronRight size={14} />
                </button>
              ))}
            </FilterBlock>
            <FilterBlock title="品牌">
              <input className="filter-search" value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} placeholder="搜索品牌" />
              <div className="check-list">
                {brands.filter((brand) => brand.toLowerCase().includes(brandSearch.toLowerCase())).slice(0, 15).map((brand) => (
                  <label key={brand}><input type="checkbox" checked={brandParams.includes(brand)} onChange={() => toggleBrand(brand)} /> {brand}</label>
                ))}
              </div>
            </FilterBlock>
            <FilterBlock title="价格区间">
              <div className="price-inputs">
                <input type="number" placeholder="最低" value={minPrice || ""} onChange={(event) => update("minPrice", event.target.value)} />
                <span>—</span>
                <input type="number" placeholder="最高" value={maxPrice || ""} onChange={(event) => update("maxPrice", event.target.value)} />
              </div>
            </FilterBlock>
            <FilterBlock title="用户评分">
              {[4.5, 4, 3.5].map((value) => <button key={value} className={rating === value ? "selected" : ""} onClick={() => update("rating", String(value))}><Star size={14} fill="currentColor" /> {value} 及以上</button>)}
            </FilterBlock>
            <FilterBlock title="库存">
              <label><input type="checkbox" checked={inStock} onChange={(event) => update("inStock", event.target.checked ? "1" : undefined)} /> 仅看现货商品</label>
            </FilterBlock>
            {activeCount > 0 && <button className="clear-filters" onClick={() => setParams(query ? { q: query } : {})}>清除全部筛选</button>}
          </aside>
        )}
        <section className="listing-results">
          <ProductGrid items={result} />
          {result.length > 0 && (
            <div className="pagination">
              <button disabled>上一页</button><button className="active">1</button><button disabled={result.length < 20}>2</button><button disabled={result.length < 20}>下一页</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="filter-block">
      <button className="filter-block__title" onClick={() => setOpen((value) => !value)}><strong>{title}</strong><ChevronRight size={15} className={open ? "rotate" : ""} /></button>
      {open && <div className="filter-block__content">{children}</div>}
    </section>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const product = getProductBySlug(slug ?? "");
  const { addToCart, favorites, toggleFavorite, compare, toggleCompare } = useStore();
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [tab, setTab] = useState("detail");
  useTitle(product?.title ?? "商品不存在");

  if (!product) return <NotFoundPage />;
  const variant = getVariant(product, variantId);
  const category = categories.find((item) => item.id === product.categoryId);
  const recommendations = products.filter((item) => item.categoryId === product.categoryId && item.id !== product.id).slice(0, 5);
  const favorite = favorites.includes(product.id);
  const compared = compare.includes(product.id);
  const selectedProductId = product.id;

  function add() {
    addToCart(selectedProductId, variant.id, quantity);
    trackBusiness("product_add_to_cart", { productId: selectedProductId, variantId: variant.id, quantity });
  }

  return (
    <div className="container product-page">
      <Breadcrumbs items={[{ label: category?.name ?? "商品", to: "/search?category=" + product.categoryId }, { label: product.title }]} />
      <section className="product-top">
        <div className="gallery">
          <div className="gallery__thumbs">
            {product.images.map((item, index) => <button key={index} className={index === imageIndex ? "active" : ""} onClick={() => setImageIndex(index)}><img src={item} alt="" /></button>)}
          </div>
          <div className="gallery__main"><img src={product.images[imageIndex]} alt={product.title} /><span>悬停查看细节</span></div>
        </div>
        <div className="product-buy">
          <span className="product-brand">{product.brand}</span>
          <h1>{product.title}</h1>
          <p className="product-subtitle">{product.subtitle}</p>
          <div className="product-meta"><Rating value={product.rating} count={product.reviewCount} /><span>已售 {product.soldCount.toLocaleString("zh-CN")}</span><span>商品编码 {variant.skuCode}</span></div>
          <div className="price-panel">
            <span>到手价</span><strong>{money(variant.price)}</strong>{variant.compareAtPrice && <del>{money(variant.compareAtPrice)}</del>}<em>限时</em>
            <p>满 500 减 40 · 结算时自动计算最优优惠</p>
          </div>
          <div className="delivery-line"><Truck size={19} /><span><strong>配送至 广州市</strong><small>预计明日送达 · 满 299 元免运费</small></span><ChevronRight size={16} /></div>
          <div className="variant-group">
            <label>选择规格</label>
            <div className="variant-options">
              {product.variants.map((item) => (
                <button className={item.id === variant.id ? "active" : ""} key={item.id} onClick={() => { setVariantId(item.id); setQuantity(1); trackBusiness("select_variant", { productId: product.id, variantId: item.id }); }}>
                  <span>{Object.values(item.attributes).join(" · ")}</span><small>{money(item.price)}</small>{item.id === variant.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
          <div className="stock-line"><span className={variant.stock < 10 ? "stock-low" : "stock-ok"}>{variant.stock < 10 ? "低库存" : "现货"}</span><span>当前规格剩余 {variant.stock} 件</span></div>
          <div className="buy-row">
            <QuantityControl value={quantity} onChange={setQuantity} max={variant.stock} />
            <button className="button button--primary button--large" onClick={add} data-track-id="product-add-to-cart"><ShoppingBag size={19} />加入购物车</button>
            <Link className="button button--dark button--large" to="/checkout" onClick={add}>立即购买</Link>
          </div>
          <div className="product-secondary-actions">
            <button className={favorite ? "active" : ""} onClick={() => toggleFavorite(product.id)}><Heart size={17} fill={favorite ? "currentColor" : "none"} />{favorite ? "已收藏" : "收藏商品"}</button>
            <button className={compared ? "active" : ""} onClick={() => toggleCompare(product.id)}><GitCompareArrows size={17} />{compared ? "已加入对比" : "加入对比"}</button>
          </div>
          <div className="service-promises"><span><ShieldCheck size={17} />正品保障</span><span><RefreshCw size={17} />7 天无理由退换</span><span><PackageCheck size={17} />两年质保</span></div>
        </div>
      </section>

      <section className="product-detail">
        <div className="detail-tabs">
          {[["detail", "商品详情"], ["spec", "规格参数"], ["reviews", "用户评价"], ["faq", "常见问题"]].map(([value, label]) => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{label}{value === "reviews" && <em>{product.reviewCount}</em>}</button>)}
        </div>
        {tab === "detail" && <div className="detail-story"><span className="eyebrow">DESIGNED FOR EVERYDAY</span><h2>{product.subtitle}</h2><p>{product.description}</p><div className="highlight-grid">{product.highlights.map((item, index) => <div key={item}><strong>0{index + 1}</strong><span>{item}</span></div>)}</div><img src={product.images[1]} alt="" /></div>}
        {tab === "spec" && <div className="spec-table">{Object.entries(product.specifications).map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>}
        {tab === "reviews" && <div className="review-layout"><div className="review-summary"><strong>{product.rating.toFixed(1)}</strong><Rating value={product.rating} /><span>来自 {product.reviewCount.toLocaleString("zh-CN")} 条用户评价</span></div><div className="review-list">{product.reviews.map((review) => <article key={review.id}><Rating value={review.rating} compact /><h3>{review.title}</h3><p>{review.content}</p><div><span>{review.author}</span><time>{new Date(review.date).toLocaleDateString("zh-CN")}</time></div></article>)}</div></div>}
        {tab === "faq" && <div className="faq-list">{["下单后什么时候发货？","商品是否提供质保？","支持哪些支付方式？","如何申请退换货？"].map((question, index) => <details key={question} open={index === 0}><summary>{question}<ChevronRight size={16} /></summary><p>{["现货商品通常会在付款后 24 小时内完成出库。","不同商品的质保期限以详情页说明为准，核心商品提供两年质保。","支持扫码支付、快捷卡支付、跳转支付及货到付款。","在订单详情中提交售后申请，符合条件的商品支持 7 天无理由退换。"][index]}</p></details>)}</div>}
      </section>

      <section className="page-section">
        <SectionHeader eyebrow="YOU MAY ALSO LIKE" title="同类好物推荐" />
        <ProductGrid items={recommendations} />
      </section>
    </div>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const { cart, cartSubtotal, removeItems, lastRemovedCount, undoRemove } = useStore();
  useTitle("购物车");
  const selected = cart.filter((item) => item.selected);
  const discount = cartSubtotal >= 50000 ? 4000 : 0;
  const shipping = cartSubtotal >= 29900 ? 0 : 1800;
  const total = Math.max(0, cartSubtotal - discount + shipping);

  return (
    <div className="container cart-page">
      <Breadcrumbs items={[{ label: "购物车" }]} />
      <div className="page-title-row"><div><span className="eyebrow">YOUR BAG</span><h1>购物车</h1><p>{cart.length} 种商品，已选择 {selected.length} 种</p></div><Link className="text-link" to="/search">继续购物 <ArrowRight size={16} /></Link></div>
      {lastRemovedCount > 0 && <div className="undo-banner wide">已删除 {lastRemovedCount} 件商品<button onClick={undoRemove}>撤销删除</button></div>}
      {!cart.length ? (
        <div className="empty-state large"><ShoppingBag size={54} /><h2>购物车还是空的</h2><p>从编辑精选中找到值得带回家的好物。</p><Link className="button button--primary" to="/search">开始选购</Link></div>
      ) : (
        <div className="cart-layout">
          <section className="cart-table">
            <div className="cart-table__head"><span>商品信息</span><span>数量与操作</span></div>
            {cart.map((item) => <CartLine item={item} key={item.id} />)}
            <div className="cart-bulk"><span>选中的商品将在结算前再次校验库存与价格</span><button onClick={() => removeItems(selected.map((item) => item.id))} disabled={!selected.length}><Trash2Icon />删除选中商品</button></div>
          </section>
          <aside className="order-summary">
            <span className="eyebrow">ORDER SUMMARY</span><h2>订单摘要</h2>
            <div><span>商品小计</span><strong>{money(cartSubtotal)}</strong></div>
            <div><span>满减优惠</span><strong className="discount">-{money(discount)}</strong></div>
            <div><span>预计运费</span><strong>{shipping ? money(shipping) : "免运费"}</strong></div>
            {cartSubtotal < 50000 && <div className="progress-note"><span>再购 {money(50000 - cartSubtotal)} 可享满 500 减 40</span><i><em style={{ width: Math.min(100, cartSubtotal / 500) + "%" }} /></i></div>}
            <div className="summary-total"><span>预计应付</span><strong>{money(total)}</strong></div>
            <button className="button button--primary button--full button--large" disabled={!selected.length} onClick={() => { trackBusiness("begin_checkout", { itemCount: selected.length, total }); navigate("/checkout"); }}>去结算 ({selected.length})</button>
            <p><ShieldCheck size={15} />价格与库存将在下一步进行最终确认</p>
          </aside>
        </div>
      )}
      <section className="page-section"><SectionHeader eyebrow="COMPLETE THE SET" title="也许你还需要" /><ProductGrid items={products.filter((item) => !cart.some((line) => line.productId === item.id)).slice(0, 5)} /></section>
    </div>
  );
}

function Trash2Icon() {
  return <X size={15} />;
}

export function FavoritesPage() {
  const { favorites } = useStore();
  useTitle("我的收藏");
  const items = favorites.map(getProductById).filter(Boolean) as typeof products;
  return <div className="container simple-page"><Breadcrumbs items={[{ label: "我的收藏" }]} /><div className="page-title-row"><div><span className="eyebrow">SAVED ITEMS</span><h1>我的收藏</h1><p>收藏内容保存在当前浏览器中。</p></div><span className="result-count"><strong>{items.length}</strong><span>件商品</span></span></div><ProductGrid items={items} emptyText="还没有收藏商品" /></div>;
}

export function ComparePage() {
  const { compare, toggleCompare } = useStore();
  useTitle("商品对比");
  const items = compare.map(getProductById).filter(Boolean) as typeof products;
  const specNames = [...new Set(items.flatMap((item) => Object.keys(item.specifications)))];
  return (
    <div className="container simple-page">
      <Breadcrumbs items={[{ label: "商品对比" }]} />
      <div className="page-title-row"><div><span className="eyebrow">COMPARE</span><h1>商品对比</h1><p>并排查看价格、评分与核心参数。</p></div></div>
      {!items.length ? <div className="empty-state large"><GitCompareArrows size={48} /><h2>还没有选择对比商品</h2><Link className="button button--primary" to="/search">浏览商品</Link></div> : (
        <div className="compare-table">
          <div className="compare-row compare-row--products"><strong>商品</strong>{items.map((product) => <div key={product.id}><button onClick={() => toggleCompare(product.id)}><X size={15} /></button><img src={product.images[0]} alt={product.title} /><Link to={"/product/" + product.slug}>{product.title}</Link></div>)}</div>
          <div className="compare-row"><strong>价格</strong>{items.map((product) => <span key={product.id}>{money(product.variants[0].price)}</span>)}</div>
          <div className="compare-row"><strong>评分</strong>{items.map((product) => <span key={product.id}>{product.rating} / 5</span>)}</div>
          {specNames.map((name) => <div className="compare-row" key={name}><strong>{name}</strong>{items.map((product) => <span key={product.id}>{product.specifications[name] ?? "—"}</span>)}</div>)}
        </div>
      )}
    </div>
  );
}

export function ServicePage() {
  useTitle("配送与售后");
  return (
    <div className="container prose-page">
      <Breadcrumbs items={[{ label: "配送与售后" }]} />
      <span className="eyebrow">CUSTOMER CARE</span><h1>从下单到售后，每一步都清晰可靠</h1>
      <p className="lead">我们提供灵活配送、安全支付和便捷退换服务，让你可以更安心地挑选每一件商品。</p>
      <div className="info-grid"><div><Truck /><h3>灵活配送</h3><p>支持标准配送、次日达、预约配送和门店自提。</p></div><div><RefreshCw /><h3>无忧退换</h3><p>符合条件的商品支持 7 天无理由退换，售后进度随时可查。</p></div><div><ShieldCheck /><h3>安全支付</h3><p>多种付款方式可选，订单和支付信息均受到加密保护。</p></div></div>
    </div>
  );
}

export function NotFoundPage() {
  useTitle("页面不存在");
  return <div className="container empty-state page-404"><strong>404</strong><h1>没有找到这个页面</h1><p>它可能已被移动，或者地址输入有误。</p><Link className="button button--primary" to="/">返回首页</Link></div>;
}
