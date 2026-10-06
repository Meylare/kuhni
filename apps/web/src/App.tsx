import { useEffect, useState } from "react";

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { Navigation, type ActiveTab } from "./components/Navigation";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ParametersPage } from "./pages/ParametersPage";
import { PriceListPage } from "./pages/PriceListPage";

function parseHash(): { tab: ActiveTab; orderId: string | null } {
  if (typeof window === "undefined") return { tab: "orders", orderId: null };
  const raw = window.location.hash.replace("#", "");
  if (raw.startsWith("order/")) {
    const id = raw.slice("order/".length);
    return { tab: "orders", orderId: id || null };
  }
  if (raw === "prices" || raw === "parameters") {
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
    <div className="min-h-svh bg-[#f6f1ea] flex flex-col">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1">
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
        {activeTab === "parameters" && <ParametersPage />}
      </div>
    </div>
  );
}

function Gate() {
  const { loading, session, configError } = useAuth();

  if (configError && !session) {
    return <LoginPage />;
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 text-stone-600">
        Загрузка…
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
