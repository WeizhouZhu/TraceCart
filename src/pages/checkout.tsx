import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  PackageCheck,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Truck,
  XCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Breadcrumbs } from "../components";
import { getProductById, getVariant } from "../data/catalog";
import { api } from "../lib/api";
import { money } from "../lib/catalog";
import { trackBusiness } from "../lib/telemetry";
import { useStore } from "../store/AppStore";
import type { Order, PaymentMethod, PaymentSession } from "../types";

function useTitle(title: string) {
  useEffect(() => {
    document.title = title + " · TraceCart";
  }, [title]);
}

const deliveryPrices = {
  standard: 0,
  "next-day": 1800,
  scheduled: 2600,
  pickup: 0,
};

export function CheckoutPage() {
  useTitle("游客结算");
  const navigate = useNavigate();
  const { cart, cartSubtotal, checkout, updateCheckout, clearCart } = useStore();
  const selected = cart.filter((item) => item.selected);
  const [step, setStep] = useState(1);
  const [couponStatus, setCouponStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const discount = cartSubtotal >= 50000 ? 4000 : couponStatus === "valid" ? 3000 : 0;
  const shipping = deliveryPrices[checkout.deliveryMethod];
  const total = Math.max(0, cartSubtotal - discount + shipping);

  const addressValid =
    checkout.address.recipient.trim().length >= 2 &&
    /^1\\d{10}$/.test(checkout.address.phone) &&
    checkout.address.province &&
    checkout.address.city &&
    checkout.address.district &&
    checkout.address.detail.trim().length >= 5;

  function fillDemoAddress() {
    updateCheckout({
      address: {
        recipient: "测试用户",
        phone: "13800000000",
        province: "广东省",
        city: "广州市",
        district: "天河区",
        detail: "演示路 88 号 TraceCart 测试地址",
        postalCode: "510000",
      },
    });
    trackBusiness("fill_demo_address");
  }

  function applyCoupon() {
    setCouponStatus(checkout.couponCode.toUpperCase() === "TRACE30" ? "valid" : "invalid");
    trackBusiness("apply_coupon", { valid: checkout.couponCode.toUpperCase() === "TRACE30" });
  }

  async function placeOrder() {
    if (!selected.length) {
      setError("购物车中没有已选择的商品。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await api.createOrder({
        items: selected,
        quote: { subtotal: cartSubtotal, discount, shipping, total },
        checkout,
        idempotencyKey: crypto.randomUUID(),
      });
      const payment = await api.createPayment(order.id, "qr");
      trackBusiness("order_created", { orderId: order.id, paymentId: payment.id, total });
      clearCart();
      navigate("/payment/" + payment.id, { state: { orderToken: order.token } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建订单失败，请重试。");
      trackBusiness("order_create_failed", { message: String(cause) });
    } finally {
      setSubmitting(false);
    }
  }

  if (!selected.length && !submitting) {
    return <div className="container empty-state page-404"><PackageCheck size={52} /><h1>没有可结算的商品</h1><p>请先将商品加入购物车并选中。</p><Link className="button button--primary" to="/search">继续购物</Link></div>;
  }

  return (
    <div className="container checkout-page">
      <Breadcrumbs items={[{ label: "购物车", to: "/cart" }, { label: "游客结算" }]} />
      <div className="checkout-header">
        <div><span className="eyebrow">SECURE DEMO CHECKOUT</span><h1>游客结算</h1><p>不要填写真实个人信息，建议使用一键测试地址。</p></div>
        <div className="checkout-steps">
          {["配送信息", "配送方式", "优惠选项", "确认订单"].map((label, index) => (
            <button key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} onClick={() => index + 1 < step && setStep(index + 1)}>
              <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span><em>{label}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="checkout-layout">
        <section className="checkout-panel">
          {step === 1 && (
            <div className="checkout-section">
              <div className="checkout-section__title"><div><span className="eyebrow">STEP 01</span><h2>配送信息</h2></div><button className="text-button" onClick={fillDemoAddress}>一键填入测试地址</button></div>
              <div className="notice notice--info"><ShieldCheck size={18} /><span><strong>隐私提示</strong>本页仅用于交互模拟，请勿填写真实姓名、电话或地址。</span></div>
              <div className="form-grid" data-track-mask>
                <label><span>收货人 *</span><input value={checkout.address.recipient} onChange={(event) => updateCheckout({ address: { ...checkout.address, recipient: event.target.value } })} placeholder="测试用户" /></label>
                <label><span>手机号 *</span><input value={checkout.address.phone} onChange={(event) => updateCheckout({ address: { ...checkout.address, phone: event.target.value } })} placeholder="13800000000" /></label>
                <label><span>省份 *</span><select value={checkout.address.province} onChange={(event) => updateCheckout({ address: { ...checkout.address, province: event.target.value } })}><option value="">请选择</option><option>广东省</option><option>浙江省</option><option>上海市</option><option>北京市</option></select></label>
                <label><span>城市 *</span><select value={checkout.address.city} onChange={(event) => updateCheckout({ address: { ...checkout.address, city: event.target.value } })}><option value="">请选择</option><option>广州市</option><option>深圳市</option><option>杭州市</option><option>上海市</option><option>北京市</option></select></label>
                <label><span>区县 *</span><select value={checkout.address.district} onChange={(event) => updateCheckout({ address: { ...checkout.address, district: event.target.value } })}><option value="">请选择</option><option>天河区</option><option>越秀区</option><option>南山区</option><option>西湖区</option><option>浦东新区</option></select></label>
                <label><span>邮政编码</span><input value={checkout.address.postalCode} onChange={(event) => updateCheckout({ address: { ...checkout.address, postalCode: event.target.value } })} placeholder="510000" /></label>
                <label className="full"><span>详细地址 *</span><textarea value={checkout.address.detail} onChange={(event) => updateCheckout({ address: { ...checkout.address, detail: event.target.value } })} placeholder="请使用虚构的测试地址" /></label>
              </div>
              <div className="step-actions"><Link className="button button--ghost" to="/cart"><ArrowLeft size={17} />返回购物车</Link><button className="button button--primary" disabled={!addressValid} onClick={() => { setStep(2); trackBusiness("checkout_step", { step: 2 }); }}>选择配送方式<ArrowRight size={17} /></button></div>
            </div>
          )}

          {step === 2 && (
            <div className="checkout-section">
              <div className="checkout-section__title"><div><span className="eyebrow">STEP 02</span><h2>配送方式</h2></div></div>
              <div className="delivery-options">
                {[
                  ["standard", "标准配送", "预计 2–3 个工作日", "免费", Truck],
                  ["next-day", "次日达", "明日 18:00 前送达", money(1800), Clock3],
                  ["scheduled", "预约配送", "选择希望送达的时间段", money(2600), MapPin],
                  ["pickup", "到店自提演示", "广州天河体验点", "免费", PackageCheck],
                ].map(([value, title, description, price, Icon]) => (
                  <label className={checkout.deliveryMethod === value ? "selected" : ""} key={String(value)}>
                    <input type="radio" name="delivery" checked={checkout.deliveryMethod === value} onChange={() => updateCheckout({ deliveryMethod: value as typeof checkout.deliveryMethod })} />
                    {typeof Icon !== "string" && <Icon size={23} />}
                    <span><strong>{String(title)}</strong><small>{String(description)}</small></span><em>{String(price)}</em>
                  </label>
                ))}
              </div>
              <div className="step-actions"><button className="button button--ghost" onClick={() => setStep(1)}><ArrowLeft size={17} />上一步</button><button className="button button--primary" onClick={() => { setStep(3); trackBusiness("checkout_step", { step: 3 }); }}>优惠与选项<ArrowRight size={17} /></button></div>
            </div>
          )}

          {step === 3 && (
            <div className="checkout-section">
              <div className="checkout-section__title"><div><span className="eyebrow">STEP 03</span><h2>优惠与其他选项</h2></div></div>
              <div className="coupon-box">
                <label><span>优惠码</span><div><input value={checkout.couponCode} onChange={(event) => { updateCheckout({ couponCode: event.target.value }); setCouponStatus("idle"); }} placeholder="试试 TRACE30" /><button className="button button--dark" onClick={applyCoupon}>应用</button></div></label>
                {couponStatus === "valid" && <p className="field-success"><CheckCircle2 size={16} />优惠码有效，已减免 {money(3000)}</p>}
                {couponStatus === "invalid" && <p className="field-error"><AlertCircle size={16} />优惠码不存在或不适用于当前商品</p>}
              </div>
              <div className="option-list">
                <label><input type="checkbox" checked={checkout.giftWrap} onChange={(event) => updateCheckout({ giftWrap: event.target.checked })} /><span><strong>礼品包装</strong><small>使用可回收包装纸与祝福卡片</small></span><em>{money(1200)}</em></label>
                <label><input type="checkbox" checked={checkout.invoice} onChange={(event) => updateCheckout({ invoice: event.target.checked })} /><span><strong>需要发票演示</strong><small>仅记录是否选择，不采集真实抬头</small></span><em>免费</em></label>
              </div>
              <label className="note-field" data-track-mask><span>订单备注</span><textarea value={checkout.note} onChange={(event) => updateCheckout({ note: event.target.value })} placeholder="请勿填写真实敏感信息" /></label>
              <div className="step-actions"><button className="button button--ghost" onClick={() => setStep(2)}><ArrowLeft size={17} />上一步</button><button className="button button--primary" onClick={() => { setStep(4); trackBusiness("checkout_step", { step: 4 }); }}>确认订单<ArrowRight size={17} /></button></div>
            </div>
          )}

          {step === 4 && (
            <div className="checkout-section">
              <div className="checkout-section__title"><div><span className="eyebrow">STEP 04</span><h2>确认订单</h2></div></div>
              <div className="review-block"><div><strong>配送信息</strong><button onClick={() => setStep(1)}>修改</button></div><p>{checkout.address.recipient} · {checkout.address.phone}</p><span>{checkout.address.province} {checkout.address.city} {checkout.address.district} {checkout.address.detail}</span></div>
              <div className="review-block"><div><strong>配送方式</strong><button onClick={() => setStep(2)}>修改</button></div><p>{{ standard: "标准配送", "next-day": "次日达", scheduled: "预约配送", pickup: "到店自提演示" }[checkout.deliveryMethod]}</p></div>
              <div className="checkout-products">{selected.map((item) => { const product = getProductById(item.productId); if (!product) return null; const variant = getVariant(product, item.variantId); return <div key={item.id}><img src={variant.image ?? product.images[0]} alt="" /><span><strong>{product.title}</strong><small>{Object.values(variant.attributes).join(" · ")} · 数量 {item.quantity}</small></span><em>{money(variant.price * item.quantity)}</em></div>; })}</div>
              {error && <div className="notice notice--error"><AlertCircle size={18} /><span>{error}</span></div>}
              <div className="step-actions"><button className="button button--ghost" onClick={() => setStep(3)} disabled={submitting}><ArrowLeft size={17} />上一步</button><button className="button button--primary button--large" onClick={placeOrder} disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={18} />正在创建订单</> : <>提交订单并支付<ArrowRight size={17} /></>}</button></div>
            </div>
          )}
        </section>

        <aside className="checkout-summary">
          <span className="eyebrow">ORDER SUMMARY</span><h2>订单摘要</h2>
          <div className="checkout-summary__items">{selected.slice(0, 3).map((item) => { const product = getProductById(item.productId); if (!product) return null; return <span key={item.id}><img src={product.images[0]} alt="" /><em>{item.quantity}</em></span>; })}{selected.length > 3 && <strong>+{selected.length - 3}</strong>}</div>
          <div><span>商品小计</span><strong>{money(cartSubtotal)}</strong></div>
          <div><span>优惠</span><strong className="discount">-{money(discount)}</strong></div>
          <div><span>配送</span><strong>{shipping ? money(shipping) : "免费"}</strong></div>
          {checkout.giftWrap && <div><span>礼品包装</span><strong>{money(1200)}</strong></div>}
          <div className="summary-total"><span>应付金额</span><strong>{money(total + (checkout.giftWrap ? 1200 : 0))}</strong></div>
          <p><ShieldCheck size={15} />这是模拟结算，不会产生真实订单或扣款。</p>
        </aside>
      </div>
    </div>
  );
}

export function PaymentPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(120);
  useTitle("支付中心");

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    const load = async () => {
      try {
        const next = await api.getPayment(paymentId);
        if (!active) return;
        setPayment(next);
        if (!order) setOrder(await api.getOrder(next.orderId));
        const seconds = Math.max(0, Math.floor((new Date(next.expiresAt).getTime() - Date.now()) / 1000));
        setRemaining(seconds);
        if (next.status === "succeeded" || next.status === "failed" || next.status === "expired") {
          navigate("/payment/result/" + next.id, { replace: true });
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "无法查询支付状态");
      }
    };
    void load();
    const timer = window.setInterval(load, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [paymentId, navigate]);

  useEffect(() => {
    if (!payment) return;
    const confirmUrl = window.location.origin + "/payment/confirm/" + payment.id;
    QRCode.toDataURL(confirmUrl, { width: 260, margin: 1, color: { dark: "#102a43", light: "#ffffff" } }).then(setQrUrl);
  }, [payment?.id]);

  async function changeMethod(method: PaymentMethod) {
    if (!order) return;
    const next = await api.createPayment(order.id, method);
    trackBusiness("payment_method_changed", { method, paymentId: next.id });
    if (method === "redirect") navigate("/payment/redirect/" + next.id);
    else navigate("/payment/" + next.id, { replace: true });
  }

  if (error) return <PaymentError message={error} onRetry={() => window.location.reload()} />;
  if (!payment || !order) return <PaymentLoading />;

  return (
    <div className="payment-page">
      <div className="payment-topbar"><Link to="/"><span className="brand__mark">T</span><strong>TraceCart Pay</strong></Link><span><ShieldCheck size={17} />安全模拟支付 · 不会扣款</span></div>
      <div className="payment-shell">
        <div className="payment-order-head"><div><span>订单号 {order.id}</span><small>请在倒计时结束前完成模拟操作</small></div><div><span>应付金额</span><strong>{money(payment.amount)}</strong></div></div>
        <div className="payment-layout">
          <aside className="payment-methods">
            <h3>选择支付方式</h3>
            <button className={payment.method === "qr" ? "active" : ""} onClick={() => changeMethod("qr")}><QrCode size={21} /><span><strong>扫码支付</strong><small>使用手机打开确认页</small></span><Check size={16} /></button>
            <button onClick={() => changeMethod("redirect")}><Smartphone size={21} /><span><strong>跳转支付</strong><small>前往模拟第三方收银台</small></span></button>
            <button onClick={() => changeMethod("card-demo")}><CreditCard size={21} /><span><strong>快捷卡支付</strong><small>不需要输入真实卡号</small></span></button>
            <button onClick={() => changeMethod("cod")}><Banknote size={21} /><span><strong>货到付款</strong><small>立即模拟支付成功</small></span></button>
          </aside>
          <section className="qr-panel">
            <span className="eyebrow">SCAN TO CONFIRM</span><h1>扫描二维码完成模拟支付</h1>
            <p>使用另一台手机扫描，或点击下方“本机模拟确认”。</p>
            <div className="qr-box">{qrUrl ? <img src={qrUrl} alt="模拟支付二维码" /> : <LoaderCircle className="spin" />}{payment.status === "expired" && <div className="qr-expired">二维码已过期</div>}</div>
            <div className="countdown"><Clock3 size={17} />剩余 {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</div>
            <Link className="button button--dark" to={"/payment/confirm/" + payment.id}>本机打开模拟确认页</Link>
            <div className="payment-waiting"><span className="pulse-dot" /><span><strong>等待支付确认</strong><small>页面会自动更新，无需手动刷新</small></span></div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function PaymentConfirmPage() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  useTitle("确认模拟支付");

  useEffect(() => { if (paymentId) api.getPayment(paymentId).then(setPayment).catch(() => setMessage("支付会话不存在或已失效")); }, [paymentId]);

  async function confirm() {
    if (!paymentId) return;
    setProcessing(true);
    try {
      const next = await api.confirmPayment(paymentId);
      setPayment(next);
      trackBusiness("payment_confirmed_on_companion", { paymentId, outcome: next.outcome });
      setMessage(next.status === "succeeded" ? "支付成功，可以返回原设备。" : "本次支付未成功，请返回原设备查看详情。");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "确认失败");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="companion-page">
      <div className="companion-card">
        <span className="brand__mark">T</span><span className="eyebrow">TRACECART COMPANION</span><h1>确认模拟支付</h1>
        {payment && <><div className="companion-amount"><span>支付金额</span><strong>{money(payment.amount)}</strong></div><p>订单 {payment.orderId}</p></>}
        <div className="notice notice--info"><ShieldCheck size={18} /><span>这是模拟支付，不会调用真实支付渠道，也不会产生扣款。</span></div>
        {message ? <div className={payment?.status === "succeeded" ? "result-inline success" : "result-inline error"}>{payment?.status === "succeeded" ? <CheckCircle2 /> : <XCircle />}<strong>{message}</strong></div> : <button className="button button--primary button--full button--large" onClick={confirm} disabled={!payment || processing}>{processing ? <><LoaderCircle className="spin" />处理中</> : "确认支付"}</button>}
      </div>
    </div>
  );
}

export function RedirectPaymentPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [processing, setProcessing] = useState(false);
  useTitle("QuickPay 模拟收银台");
  useEffect(() => { if (paymentId) api.getPayment(paymentId).then(setPayment); }, [paymentId]);

  async function finish(confirm: boolean) {
    if (!paymentId) return;
    setProcessing(true);
    try {
      const next = confirm ? await api.confirmPayment(paymentId) : await api.cancelPayment(paymentId);
      trackBusiness(confirm ? "redirect_payment_confirm" : "redirect_payment_cancel", { paymentId });
      window.setTimeout(() => navigate("/payment/result/" + next.id), 700);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="redirect-pay">
      <header><strong>QUICK<span>PAY</span></strong><em>独立模拟收银台</em></header>
      <main>
        <div className="redirect-merchant"><span className="brand__mark">T</span><div><small>商户</small><strong>TraceCart Store</strong></div></div>
        <div className="redirect-amount"><span>应付金额</span><strong>{payment ? money(payment.amount) : "—"}</strong><small>订单 {payment?.orderId ?? "加载中"}</small></div>
        <div className="mock-account"><div><span>演示账户</span><strong>QuickPay 测试余额</strong></div><em>无需登录</em></div>
        <div className="notice notice--info"><ShieldCheck size={18} /><span>本页面为原创模拟界面，不代表任何真实支付机构。</span></div>
        <button className="button button--primary button--full button--large" onClick={() => finish(true)} disabled={!payment || processing}>{processing ? <><LoaderCircle className="spin" />正在返回商户</> : "确认模拟支付"}</button>
        <button className="text-button centered" onClick={() => finish(false)} disabled={processing}>取消并返回商户</button>
      </main>
    </div>
  );
}

export function PaymentResultPage() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useTitle("支付结果");

  useEffect(() => {
    if (!paymentId) return;
    api.getPayment(paymentId).then(async (next) => { setPayment(next); setOrder(await api.getOrder(next.orderId)); }).catch((cause) => setError(cause.message));
  }, [paymentId]);

  if (error) return <PaymentError message={error} onRetry={() => window.location.reload()} />;
  if (!payment || !order) return <PaymentLoading />;
  const success = payment.status === "succeeded";
  const errorMessages: Record<string, string> = {
    insufficient_funds: "模拟账户余额不足",
    risk_rejected: "本次交易未通过模拟风险检查",
    network_error: "支付网络暂时不可用",
    expired: "支付会话已过期",
  };

  return (
    <div className="container payment-result">
      <div className={"result-hero " + (success ? "success" : "failure")}>
        {success ? <CheckCircle2 size={58} /> : <XCircle size={58} />}
        <span className="eyebrow">{success ? "PAYMENT COMPLETE" : "PAYMENT INTERRUPTED"}</span>
        <h1>{success ? "模拟支付成功" : errorMessages[payment.outcome] ?? "模拟支付未完成"}</h1>
        <p>{success ? "订单已进入模拟处理流程，你可以查看完整订单或继续购物。" : "订单仍然保留，可以更换支付方式或重新尝试。"}</p>
        <strong>{money(payment.amount)}</strong>
      </div>
      <div className="result-order-card">
        <div><span>订单编号</span><strong>{order.id}</strong></div><div><span>支付方式</span><strong>{{ qr: "扫码支付", redirect: "跳转支付", "card-demo": "快捷卡演示", cod: "货到付款" }[payment.method]}</strong></div><div><span>订单状态</span><strong>{success ? "已支付" : "待支付"}</strong></div>
      </div>
      <div className="result-actions">
        {success ? <><Link className="button button--primary" to={"/order/" + order.token}>查看订单</Link><Link className="button button--ghost" to="/">继续购物</Link></> : <><Link className="button button--primary" to={"/payment/" + payment.id}>重新支付</Link><Link className="button button--ghost" to={"/order/" + order.token}>返回订单</Link></>}
      </div>
    </div>
  );
}

export function OrderPage() {
  const { orderToken } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useTitle("订单详情");
  useEffect(() => { if (orderToken) api.getOrder(orderToken).then(setOrder).catch((cause) => setError(cause.message)); }, [orderToken]);
  if (error) return <PaymentError message={error} onRetry={() => window.location.reload()} />;
  if (!order) return <PaymentLoading />;

  return (
    <div className="container order-page">
      <Breadcrumbs items={[{ label: "订单详情" }]} />
      <div className="order-status-card"><div className="order-status-icon"><PackageCheck /></div><div><span className="eyebrow">ORDER STATUS</span><h1>{order.status === "paid" ? "订单已支付" : "订单等待支付"}</h1><p>订单 {order.id} · 创建于 {new Date(order.createdAt).toLocaleString("zh-CN")}</p></div>{order.status !== "paid" && order.paymentId && <Link className="button button--primary" to={"/payment/" + order.paymentId}>继续支付</Link>}</div>
      <div className="order-layout">
        <section><h2>商品清单</h2>{order.items.map((item) => { const product = getProductById(item.productId); if (!product) return null; const variant = getVariant(product, item.variantId); return <div className="order-item" key={item.id}><img src={product.images[0]} alt="" /><div><Link to={"/product/" + product.slug}>{product.title}</Link><small>{Object.values(variant.attributes).join(" · ")} · 数量 {item.quantity}</small></div><strong>{money(variant.price * item.quantity)}</strong></div>; })}</section>
        <aside><h2>配送与金额</h2><div><span>收货信息</span><strong>{order.checkout.address.recipient} · {order.checkout.address.phone}</strong><small>{order.checkout.address.province} {order.checkout.address.city} {order.checkout.address.district} {order.checkout.address.detail}</small></div><div><span>商品小计</span><strong>{money(order.quote.subtotal)}</strong></div><div><span>优惠</span><strong>-{money(order.quote.discount)}</strong></div><div><span>配送</span><strong>{order.quote.shipping ? money(order.quote.shipping) : "免费"}</strong></div><div className="summary-total"><span>订单总额</span><strong>{money(order.quote.total)}</strong></div></aside>
      </div>
      <div className="order-timeline"><span className="done"><i><Check /></i><strong>订单已创建</strong></span><em /><span className={order.status === "paid" ? "done" : ""}><i>{order.status === "paid" ? <Check /> : "2"}</i><strong>支付确认</strong></span><em /><span><i>3</i><strong>模拟配送</strong></span><em /><span><i>4</i><strong>完成</strong></span></div>
    </div>
  );
}

function PaymentLoading() {
  return <div className="payment-loading"><LoaderCircle className="spin" size={38} /><h2>正在加载支付信息</h2><p>请稍候，不要重复提交。</p></div>;
}

function PaymentError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="container empty-state page-404"><AlertCircle size={48} /><h1>暂时无法完成操作</h1><p>{message}</p><button className="button button--primary" onClick={onRetry}><RefreshCw size={17} />重新尝试</button></div>;
}
