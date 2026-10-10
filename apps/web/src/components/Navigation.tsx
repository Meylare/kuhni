import { useAuth } from "../auth/AuthProvider";

export type ActiveTab = "orders" | "prices" | "parameters" | "templates";

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? "";

  return (
    <>
      {/* Верхняя шапка */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#f6f1ea]/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900 text-base font-bold text-white shadow-xs">
              К
            </div>
            <div>
              <span className="block text-base font-semibold text-stone-900 leading-tight">
                Калькулятор
              </span>
              <span className="block text-xs text-stone-500">v1 • Кухни и мебель</span>
            </div>
          </div>

          {/* Вкладки для ПК */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-stone-200/80 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => onTabChange("orders")}
              className={`min-h-9 rounded-lg px-3 py-1.5 transition-all ${
                activeTab === "orders"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Заказы
            </button>
            <button
              type="button"
              onClick={() => onTabChange("prices")}
              className={`min-h-9 rounded-lg px-3 py-1.5 transition-all ${
                activeTab === "prices"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Справочник цен
            </button>
            <button
              type="button"
              onClick={() => onTabChange("templates")}
              className={`min-h-9 rounded-lg px-3 py-1.5 transition-all ${
                activeTab === "templates"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Шаблоны
            </button>
            <button
              type="button"
              onClick={() => onTabChange("parameters")}
              className={`min-h-9 rounded-lg px-3 py-1.5 transition-all ${
                activeTab === "parameters"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Параметры
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden lg:inline text-xs text-stone-500 max-w-[160px] truncate">
                {email}
              </span>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-11 rounded-xl border border-stone-300 bg-white/70 px-3 text-xs font-medium text-stone-700 hover:bg-white active:scale-95 transition-all"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Нижняя панель навигации для мобильных устройств (mobile-first, min-h 44px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t border-stone-200 bg-[#f6f1ea]/95 backdrop-blur-md safe-bottom">
        <button
          type="button"
          onClick={() => onTabChange("orders")}
          className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            activeTab === "orders"
              ? "text-emerald-900 font-semibold bg-emerald-50/50"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <span className="text-lg">📦</span>
          <span>Заказы</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("prices")}
          className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            activeTab === "prices"
              ? "text-emerald-900 font-semibold bg-emerald-50/50"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <span className="text-lg">🏷️</span>
          <span>Прайс</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("parameters")}
          className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            activeTab === "parameters"
              ? "text-emerald-900 font-semibold bg-emerald-50/50"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <span className="text-lg">⚙️</span>
          <span>Параметры</span>
        </button>
      </nav>
    </>
  );
}
