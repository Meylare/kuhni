import { Suspense, lazy, useEffect, useState, type ComponentType } from "react";

import { AccessDeniedPage } from "./auth/AccessDeniedPage";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { DialogProvider } from "./components/DialogProvider";
import { ErrorBoundary, isStaleChunkError, reloadClearingSwCaches } from "./components/ErrorBoundary";
import { Navigation, type ActiveTab } from "./components/Navigation";
import { UpdateBanner } from "./components/UpdateBanner";

const CHUNK_RELOAD_KEY = "kuhni_chunk_reload_ts";

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (typeof window !== "undefined" && isStaleChunkError(error)) {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
        if (Date.now() - lastReload > 15_000) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          await reloadClearingSwCaches();
        }
      }
      throw error;
    }
  });
}

const OrdersPage = lazyWithRetry(() =>
  import("./pages/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazyWithRetry(() =>
  import("./pages/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })),
);
const PriceListPage = lazyWithRetry(() =>
  import("./pages/PriceListPage").then((m) => ({ default: m.PriceListPage })),
);
const ParametersPage = lazyWithRetry(() =>
  import("./pages/ParametersPage").then((m) => ({ default: m.ParametersPage })),
);
const TemplatesPage = lazyWithRetry(() =>
  import("./pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })),
);

function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загрузка страницы"
      className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 animate-pulse"
    >
      <div className="h-8 w-44 rounded-xl bg-zinc-800/70 mb-6" />
      <div className="space-y-3">
        <div className="h-24 w-full rounded-2xl bg-zinc-900/80" />
        <div className="h-24 w-full rounded-2xl bg-zinc-900/80" />
        <div className="h-24 w-full rounded-2xl bg-zinc-900/80" />
      </div>
    </div>
  );
}

function parseHash(): { tab: ActiveTab; orderId: string | null } {
  if (typeof window === "undefined") return { tab: "orders", orderId: null };
  const raw = window.location.hash.replace("#", "");
  if (raw.startsWith("order/")) {
    const id = raw.slice("order/".length);
    return { tab: "orders", orderId: id || null };
  }
  if (raw === "prices" || raw === "parameters" || raw === "templates") {
    return { tab: raw, orderId: null };
  }
  return { tab: "orders", orderId: null };
}

function MainApp() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    function handleHashChange() {
      setRoute(parseHash());
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function handleTabChange(tab: ActiveTab) {
    setRoute({ tab, orderId: null });
    if (typeof window !== "undefined") {
      window.location.hash = tab;
    }
  }

  function handleSelectOrder(orderId: string) {
    setRoute({ tab: "orders", orderId });
    if (typeof window !== "undefined") {
      window.location.hash = `order/${orderId}`;
    }
  }

  function handleBackToOrders() {
    setRoute({ tab: "orders", orderId: null });
    if (typeof window !== "undefined") {
      window.location.hash = "orders";
    }
  }

  const { tab: activeTab, orderId: selectedOrderId } = route;

  return (
    <div className="min-h-svh bg-[#09090b] text-zinc-100 flex flex-col">
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hidden={activeTab === "orders" && Boolean(selectedOrderId)}
      />
      <div className="flex-1">
        <Suspense fallback={<PageSkeleton />}>
          {activeTab === "orders" && !selectedOrderId && (
            <OrdersPage onSelectOrder={handleSelectOrder} />
          )}
          {activeTab === "orders" && selectedOrderId && (
            <OrderDetailPage
              orderId={selectedOrderId}
              onBack={handleBackToOrders}
            />
          )}
          {activeTab === "prices" && <PriceListPage />}
          {activeTab === "templates" && <TemplatesPage onBack={handleBackToOrders} />}
          {activeTab === "parameters" && <ParametersPage />}
        </Suspense>
      </div>
      <UpdateBanner />
    </div>
  );
}

function Gate() {
  const { loading, session, isOwner, checkingRole, configError } = useAuth();

  if (configError && !session) {
    return <LoginPage />;
  }

  if (loading || (session && checkingRole && isOwner === null)) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 text-stone-600">
        Загрузка…
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  if (isOwner === false) {
    return <AccessDeniedPage />;
  }

  return <MainApp />;
}

export default function App() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <DialogProvider>
          {!isOnline && (
            <div
              role="status"
              className="bg-amber-600 text-white text-xs sm:text-sm font-medium py-1.5 px-4 text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-2"
            >
              <span>⚠️</span>
              <span>Нет подключения к сети. Работа в автономном режиме.</span>
            </div>
          )}
          <Gate />
        </DialogProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
