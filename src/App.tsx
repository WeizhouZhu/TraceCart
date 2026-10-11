import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { PageShell } from "./components";
import { initTelemetry, trackPageView } from "./lib/telemetry";
import { AdminPage, ClaimPage, HumanPage } from "./pages/operations";
import { StoreProvider } from "./store/AppStore";
import {
  CartPage,
  ComparePage,
  FavoritesPage,
  HomePage,
  NotFoundPage,
  ProductPage,
  SearchPage,
  ServicePage,
} from "./pages/commerce";
import {
  CheckoutPage,
  OrderPage,
  PaymentConfirmPage,
  PaymentPage,
  PaymentResultPage,
  RedirectPaymentPage,
} from "./pages/checkout";
import { OrdersPage } from "./pages/orders";

function RouteTelemetry() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

function StoreRoutes() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/order/:orderToken" element={<OrderPage />} />
        <Route path="/service" element={<ServicePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PageShell>
  );
}

function StorefrontApp() {
  useEffect(() => {
    initTelemetry();
  }, []);
  return (
    <StoreProvider>
      <RouteTelemetry />
      <Routes>
        <Route path="/payment/:paymentId" element={<PaymentPage />} />
        <Route path="/payment/confirm/:paymentId" element={<PaymentConfirmPage />} />
        <Route path="/payment/redirect/:paymentId" element={<RedirectPaymentPage />} />
        <Route path="/payment/result/:paymentId" element={<PaymentResultPage />} />
        <Route path="*" element={<StoreRoutes />} />
      </Routes>
    </StoreProvider>
  );
}

export function App() {
  const pathname = window.location.pathname;
  if (pathname === "/admin") return <AdminPage />;
  if (pathname === "/human") return <HumanPage />;
  if (pathname === "/c") return <ClaimPage />;
  return <StorefrontApp />;
}
