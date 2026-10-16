import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { resetDemoState } from "../lib/demo-data";

export type ActiveTab = "orders" | "prices" | "parameters" | "templates";

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hidden?: boolean;
}

const NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: "orders", label: "Сделки" },
  { id: "prices", label: "Каталог" },
  { id: "templates", label: "Шаблоны" },
  { id: "parameters", label: "Параметры" },
];

export function Navigation({ activeTab, onTabChange, hidden }: NavigationProps) {
  const { session, signOut, isDemoMode, exitDemoMode } = useAuth();
  const email = session?.user?.email ?? "";
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  if (hidden) return null;

  function handleResetDemo() {
    if (window.confirm("Сбросить демо-проекты и каталог к исходным данным?")) {
      resetDemoState();
      window.location.reload();
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#09090b]/90 backdrop-blur-xl select-none">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 h-13">
        {/* Навигационные вкладки (чистая типографика с тонким нижним индикатором) */}
        <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar h-full">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative h-full flex items-center text-[14px] tracking-[-0.01em] transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "font-medium text-white"
                    : "font-normal text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-[1.5px] bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Правая часть: статус Демо или аккаунт */}
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {isDemoMode ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDemoMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer py-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Демо</span>
              </button>

              {showDemoMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#141417] border border-white/[0.08] py-1 shadow-2xl z-50 text-[13px]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoMenu(false);
                      handleResetDemo();
                    }}
                    className="w-full text-left px-3.5 py-2 text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer"
                  >
                    Сбросить демо-данные
                  </button>
                  <div className="my-1 border-t border-white/[0.06]" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoMenu(false);
                      exitDemoMode();
                    }}
                    className="w-full text-left px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    Выйти из демо
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {email && (
                <span className="hidden md:inline text-[12px] text-zinc-500 max-w-[160px] truncate">
                  {email}
                </span>
              )}
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Выйти
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
