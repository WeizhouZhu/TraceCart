import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Breadcrumbs, SectionHeader } from "../components";
import { getProductById } from "../data/catalog";
import { api } from "../lib/api";
import { money } from "../lib/catalog";
import { trackBusiness } from "../lib/telemetry";
import type { Order, OrderStatus } from "../types";

type StatusMeta = {
  label: string;
  description: string;
  className: string;
  step: number;
  icon: ComponentType<{ size?: number }>;
};

const statusMeta: Record<OrderStatus, StatusMeta> = {
  awaiting_payment: {
    label: "等待支付",
    description: "订单已创建，请完成支付",
    className: "pending",
    step: 0,
    icon: Clock3,
  },
  paid: {
    label: "备货中",
    description: "支付已确认，商品正在准备出库",
    className: "processing",
    step: 1,
    icon: PackageCheck,
  },
  shipped: {
    label: "已发货",
    description: "包裹已交付承运商",
    className: "shipping",
    step: 2,
    icon: Truck,
  },
  completed: {
    label: "已完成",
    description: "订单已完成，感谢你的选购",
    className: "completed",
    step: 3,
    icon: CheckCircle2,
  },
  cancelled: {
    label: "已取消",
    description: "订单已取消",
    className: "cancelled",
    step: 0,
    icon: XCircle,
  },
};

export function getOrderStatusMeta(status: OrderStatus) {
  return statusMeta[status];
}

function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setOrders(await api.listOrders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "订单加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return { orders, setOrders, loading, error, reload };
}

function OrderCard({
  order,
  compact = false,
  confirming,
  onConfirm,
}: {
  order: Order;
  compact?: boolean;
  confirming?: boolean;
  onConfirm?: (order: Order) => void;
}) {
  const meta = getOrderStatusMeta(order.status);
  const Icon = meta.icon;
  const firstProduct = getProductById(order.items[0]?.productId);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className={"order-card " + (compact ? "order-card--compact" : "")}>
      <header>
        <div><span>订单 {order.id}</span><small>{new Date(order.createdAt).toLocaleString("zh-CN")}</small></div>
        <strong className={"order-status-badge " + meta.className}><Icon size={16} />{meta.label}</strong>
      </header>
      <div className="order-card__body">
        <div className="order-card__product">
          {firstProduct ? <img src={firstProduct.images[0]} alt="" /> : <span className="order-card__placeholder"><ShoppingBag /></span>}
          <div>
            <strong>{firstProduct?.title ?? "商城商品"}</strong>
            <small>{itemCount} 件商品{order.items.length > 1 ? ` · 另有 ${order.items.length - 1} 种商品` : ""}</small>
            <p>{meta.description}</p>
          </div>
        </div>
        <div className="order-card__total"><span>订单金额</span><strong>{money(order.quote.total)}</strong></div>
      </div>
      <footer>
        {order.status === "awaiting_payment" && <Link className="button button--primary" to={"/order/" + order.token}>继续支付</Link>}
        {order.status === "shipped" && onConfirm && <button className="button button--primary" disabled={confirming} onClick={() => onConfirm(order)}>{confirming ? <><LoaderCircle className="spin" size={16} />处理中</> : "确认收货"}</button>}
        <Link className="button button--ghost" to={"/order/" + order.token}>订单详情<ArrowRight size={16} /></Link>
      </footer>
    </article>
  );
}

export function HomeOrdersSection() {
  const { orders, loading } = useOrders();

  return (
    <section className="page-section page-section--orders">
      <div className="container">
        <SectionHeader
          eyebrow="MY ORDERS"
          title="我的订单"
          description="查看最近购买、配送进度与待处理事项。"
          link={{ label: "查看全部订单", to: "/orders" }}
        />
        {loading ? (
          <div className="orders-loading"><LoaderCircle className="spin" size={24} />正在加载订单</div>
        ) : orders.length ? (
          <div className="home-orders-grid">{orders.slice(0, 2).map((order) => <OrderCard order={order} compact key={order.id} />)}</div>
        ) : (
          <div className="home-orders-empty"><ShoppingBag size={32} /><div><strong>还没有订单</strong><span>选购心仪商品后，订单进度会显示在这里。</span></div><Link className="button button--dark" to="/search">开始选购</Link></div>
        )}
      </div>
    </section>
  );
}

export function OrdersPage() {
  const { orders, setOrders, loading, error, reload } = useOrders();
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [confirming, setConfirming] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    document.title = "我的订单 · TraceCart";
  }, []);

  const filtered = useMemo(() => orders.filter((order) => {
    if (filter === "active") return order.status !== "completed" && order.status !== "cancelled";
    if (filter === "completed") return order.status === "completed";
    return true;
  }), [orders, filter]);

  async function confirm(order: Order) {
    setConfirming(order.id);
    setActionError("");
    try {
      const updated = await api.confirmReceipt(order.token);
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
      trackBusiness("order_receipt_confirmed", { orderId: order.id });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "确认收货失败");
    } finally {
      setConfirming("");
    }
  }

  return (
    <div className="container orders-page">
      <Breadcrumbs items={[{ label: "我的订单" }]} />
      <div className="page-title-row"><div><span className="eyebrow">ORDER CENTER</span><h1>我的订单</h1><p>订单会随配送进度自动更新，你也可以在包裹送达后确认收货。</p></div></div>
      <div className="order-filters" role="tablist" aria-label="订单筛选">
        {[["all", "全部订单"], ["active", "进行中"], ["completed", "已完成"]].map(([value, label]) => <button role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value as typeof filter)} key={value}>{label}</button>)}
      </div>
      {actionError && <div className="notice notice--error"><XCircle size={18} /><span>{actionError}</span></div>}
      {loading ? <div className="orders-loading"><LoaderCircle className="spin" />正在加载订单</div> : error ? <div className="orders-loading error"><span>{error}</span><button className="button button--ghost" onClick={reload}><RefreshCw size={16} />重试</button></div> : filtered.length ? <div className="orders-list">{filtered.map((order) => <OrderCard order={order} confirming={confirming === order.id} onConfirm={confirm} key={order.id} />)}</div> : <div className="empty-state orders-empty"><ShoppingBag size={48} /><h2>这里还没有订单</h2><p>完成购买后，你可以在这里跟踪配送进度。</p><Link className="button button--primary" to="/search">去选购商品</Link></div>}
    </div>
  );
}
