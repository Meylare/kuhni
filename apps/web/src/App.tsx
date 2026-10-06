import { useEffect, useState } from "react";

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { Navigation, type ActiveTab } from "./components/Navigation";
import { OrdersPlaceholderPage } from "./pages/OrdersPlaceholderPage";
import { ParametersPage } from "./pages/ParametersPage";
import { PriceListPage } from "./pages/PriceListPage";

function getTabFromHash(): ActiveTab {
  if (typeof window === "undefined") return "orders";
  const hash = window.location.hash.replace("#", "");
  if (hash === "prices" || hash === "parameters") {
    return hash;
  }
  return "orders";
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromHash);

  useEffect(() => {
    function handleHashChange() {
      setActiveTab(getTabFromHash());
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = tab;
    }
  }

  return (
    <div className="min-h-svh bg-[#f6f1ea] flex flex-col">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1">
        {activeTab === "orders" && <OrdersPlaceholderPage />}
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
