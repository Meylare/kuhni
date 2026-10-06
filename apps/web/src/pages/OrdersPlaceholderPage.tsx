import { isCalcModuleReady } from "../lib/calc-ready";
import { useAuth } from "../auth/AuthProvider";

export function OrdersPlaceholderPage() {
  const { signOut } = useAuth();
  const calcReady = isCalcModuleReady();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-900">Заказы</h1>
        <button
          className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm text-stone-700"
          type="button"
          onClick={() => {
            void signOut();
          }}
        >
          Выйти
        </button>
      </header>

      <button
        className="mt-6 min-h-11 w-full rounded-xl bg-emerald-900 px-4 text-base font-medium text-white disabled:opacity-50 md:max-w-xs"
        type="button"
        disabled
      >
        Новый заказ
      </button>

      <p className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-stone-600">
        Заказов пока нет. Создание заказа появится на следующем шаге.
      </p>

      <p className="mt-auto pt-8 text-xs text-stone-500">
        {calcReady
          ? "Модуль расчёта подключён."
          : "Модуль расчёта не ответил. Проверьте пакет packages/calc."}
      </p>
    </main>
  );
}
