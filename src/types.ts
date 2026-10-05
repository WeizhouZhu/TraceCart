export type ActorLabel = "human" | "script" | "ai";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  accent: string;
}

export interface ProductVariant {
  id: string;
  skuCode: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  date: string;
  tags: string[];
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  brand: string;
  categoryId: string;
  description: string;
  highlights: string[];
  images: string[];
  variants: ProductVariant[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  badges: string[];
  keywords: string[];
  specifications: Record<string, string>;
  reviews: Review[];
  featured?: boolean;
  isNew?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  selected: boolean;
  addedAt: string;
}

export interface CartQuote {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export interface Address {
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postalCode?: string;
}

export interface CheckoutDraft {
  address: Address;
  deliveryMethod: "standard" | "next-day" | "scheduled" | "pickup";
  couponCode: string;
  giftWrap: boolean;
  invoice: boolean;
  note: string;
}

export type PaymentMethod = "qr" | "redirect" | "quick-card" | "cod";
export type PaymentStatus =
  | "created"
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

export interface PaymentSession {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  outcome: "succeeded" | "insufficient_funds" | "risk_rejected" | "network_error" | "expired";
  amount: number;
  createdAt: string;
  expiresAt: string;
  errorCode?: string;
}

export interface Order {
  id: string;
  token: string;
  items: CartItem[];
  quote: CartQuote;
  checkout: CheckoutDraft;
  status: "awaiting_payment" | "paid" | "cancelled";
  createdAt: string;
  paymentId?: string;
}

export interface LabelTask {
  id: string;
  token: string;
  label: ActorLabel;
  expectedIp?: string;
  expectedUserAgent?: string;
  activeFrom: string;
  expiresAt: string;
  maxSessions: number;
  boundSessions: number;
  status: "waiting" | "collecting" | "completed" | "expired" | "conflict";
  note?: string;
}

export interface SessionInfo {
  sessionId: string;
  label: ActorLabel | null;
  collectionTaskId: string | null;
}

export interface ScenarioSettings {
  latency: number;
  failRate: number;
  paymentOutcome: "random" | PaymentSession["outcome"];
  lowStock: boolean;
  priceChanged: boolean;
}

export interface TelemetryEvent {
  id: string;
  pageViewId: string;
  sequence: number;
  eventType: string;
  clientTimestamp: string;
  route: string;
  payload: Record<string, unknown>;
}
