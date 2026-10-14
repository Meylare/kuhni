import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { resetDemoState } from "../lib/demo-data";

export type ActiveTab = "orders" | "prices" | "parameters" | "templates";

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hidden?: boolean;
}

export function Navigation({ activeTab, onTabChange, hidden }: NavigationProps) {
  const { session, signOut, isDemoMode, exitDemoMode } = useAuth();
  const email = session?.user?.email ?? "";
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  if (hidden) return null;

  function handleResetDemo() {
    if (window.confirm("Сбросить все демо-заказы и материалы к начальным образцам?")) {
      resetDemoState();
      window.location.reload();
    }
  }

  return (
    <>
      {/* Верхняя ультра-минималистичная панель */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-2xl transition-all">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Бренд */}
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => onTabChange("orders")}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-black text-emerald-400">
              ⚡
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Cockpit
            </span>
          </div>

          {/* Вкладки для ПК (Segmented Pill) */}
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-[#141418] p-1 text-xs font-medium border border-white/[0.06]">
            <button
              type="button"
              onClick={() => onTabChange("orders")}
              className={`rounded-full px-4 py-1.5 transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "bg-zinc-800 text-white shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Сделки
            </button>
            <button
              type="button"
              onClick={() => onTabChange("prices")}
              className={`rounded-full px-4 py-1.5 transition-all cursor-pointer ${
                activeTab === "prices"
                  ? "bg-zinc-800 text-white shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Каталог
            </button>
            <button
              type="button"
              onClick={() => onTabChange("templates")}
              className={`rounded-full px-4 py-1.5 transition-all cursor-pointer ${
                activeTab === "templates"
                  ? "bg-zinc-800 text-white shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Шаблоны
            </button>
            <button
              type="button"
              onClick={() => onTabChange("parameters")}
              className={`rounded-full px-4 py-1.5 transition-all cursor-pointer ${
                activeTab === "parameters"
                  ? "bg-zinc-800 text-white shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Настройки
            </button>
          </nav>

          {/* Правая часть: Демо-бейдж и Профиль */}
          <div className="flex items-center gap-2">
            {isDemoMode ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDemoMenu((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Demo</span>
                </button>

                {showDemoMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#18181c] border border-white/[0.1] p-1.5 shadow-2xl z-50 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoMenu(false);
                        handleResetDemo();
                      }}
                      className="w-full text-left rounded-xl px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      🔄 Сбросить к образцам
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoMenu(false);
                        exitDemoMode();
                      }}
                      className="w-full text-left rounded-xl px-3 py-2 text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      🚪 Выйти из демо
                    </button>
                  </div>
                )}
              </div>
            ) : email ? (
              <span className="hidden lg:inline text-xs text-zinc-500 max-w-[140px] truncate">
                {email}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1"
            >
              {isDemoMode ? "Выход" : "Выйти"}
            </button>
          </div>
        </div>
      </header>

      {/* Нижний парящий стеклянный док (Floating Island Navigation) для мобильных */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex md:hidden rounded-full bg-[#121215]/90 border border-white/[0.08] backdrop-blur-2xl shadow-2xl p-1.5 gap-1 select-none">
        <button
          type="button"
          onClick={() => onTabChange("orders")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === "orders"
              ? "bg-zinc-800 text-white font-semibold shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>📋</span>
          <span>Сделки</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("prices")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === "prices"
              ? "bg-zinc-800 text-white font-semibold shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>🏷️</span>
          <span>Каталог</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("templates")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === "templates"
              ? "bg-zinc-800 text-white font-semibold shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>⚡</span>
          <span>Шаблоны</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("parameters")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === "parameters"
              ? "bg-zinc-800 text-white font-semibold shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>⚙️</span>
          <span>Настройки</span>
        </button>
      </nav>
    </>
  );
}
