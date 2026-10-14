import { useAuth } from "../auth/AuthProvider";
import { resetDemoState } from "../lib/demo-data";

export type ActiveTab = "orders" | "prices" | "parameters" | "templates";

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hideMobileNav?: boolean;
}

export function Navigation({ activeTab, onTabChange, hideMobileNav }: NavigationProps) {
  const { session, signOut, isDemoMode, exitDemoMode } = useAuth();
  const email = session?.user?.email ?? "";

  function handleResetDemo() {
    if (window.confirm("Сбросить все демо-заказы и материалы к начальным образцам?")) {
      resetDemoState();
      window.location.reload();
    }
  }

  return (
    <>
      {/* Информационная плашка Демо-режима */}
      {isDemoMode && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 text-white text-xs px-4 py-2 border-b border-emerald-800/50 shadow-xs flex items-center justify-between flex-wrap gap-2 sticky top-0 z-40">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>✨ Демо-режим активен: вы можете свободно тестировать расчеты, добавлять кухни и менять цены</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleResetDemo}
              className="rounded-lg bg-emerald-800/80 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Восстановить исходные демонстрационные заказы"
            >
              🔄 Сбросить к образцам
            </button>
            <button
              type="button"
              onClick={exitDemoMode}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Выйти из демо и вернуться к форме входа"
            >
              🚪 Выйти из демо
            </button>
          </div>
        </div>
      )}

      {/* Верхняя навигационная панель */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Бренд */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange("orders")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-lg font-black text-emerald-400 shadow-sm shadow-emerald-500/10">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white leading-tight">
                  Cockpit 2.0
                </span>
                <span className="hidden sm:inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300 border border-zinc-700/60">
                  Luxury
                </span>
              </div>
              <span className="block text-[11px] text-zinc-400 font-medium">
                Кухни • Шкафы • Экспресс-смета
              </span>
            </div>
          </div>

          {/* Вкладки для ПК (Segmented Control) */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl bg-zinc-900/90 p-1 text-xs font-semibold border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => onTabChange("orders")}
              className={`flex items-center gap-1.5 min-h-8 rounded-xl px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <span>📋</span>
              <span>Заказы</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("prices")}
              className={`flex items-center gap-1.5 min-h-8 rounded-xl px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === "prices"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <span>🏷️</span>
              <span>Справочник цен</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("templates")}
              className={`flex items-center gap-1.5 min-h-8 rounded-xl px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === "templates"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <span>⚡</span>
              <span>Шаблоны</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("parameters")}
              className={`flex items-center gap-1.5 min-h-8 rounded-xl px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === "parameters"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <span>⚙️</span>
              <span>Параметры</span>
            </button>
          </nav>

          {/* Правая часть: пользователь и выход */}
          <div className="flex items-center gap-2.5">
            {isDemoMode ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                <span>🎮</span>
                <span>Тест-режим</span>
              </span>
            ) : email ? (
              <span className="hidden lg:inline text-xs text-zinc-400 max-w-[160px] truncate font-medium">
                {email}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => void signOut()}
              className="flex min-h-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              {isDemoMode ? "Выйти" : "Выход"}
            </button>
          </div>
        </div>
      </header>

      {/* Нижняя мобильная панель навигации */}
      {!hideMobileNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t border-zinc-800/90 bg-zinc-950/95 backdrop-blur-xl safe-bottom shadow-2xl">
          <button
            type="button"
            onClick={() => onTabChange("orders")}
            className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all ${
              activeTab === "orders"
                ? "text-emerald-400 font-bold bg-emerald-500/10"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="text-lg">📋</span>
            <span>Заказы</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("prices")}
            className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all ${
              activeTab === "prices"
                ? "text-emerald-400 font-bold bg-emerald-500/10"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="text-lg">🏷️</span>
            <span>Цены</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("templates")}
            className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all ${
              activeTab === "templates"
                ? "text-emerald-400 font-bold bg-emerald-500/10"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="text-lg">⚡</span>
            <span>Шаблоны</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("parameters")}
            className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all ${
              activeTab === "parameters"
                ? "text-emerald-400 font-bold bg-emerald-500/10"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="text-lg">⚙️</span>
            <span>Параметры</span>
          </button>
        </nav>
      )}
    </>
  );
}
