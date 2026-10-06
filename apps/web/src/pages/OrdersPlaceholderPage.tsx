import { isCalcModuleReady } from "../lib/calc-ready";

export function OrdersPlaceholderPage() {
  const calcReady = isCalcModuleReady();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 pb-24 md:pb-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Заказы</h1>
          <p className="text-xs text-stone-500 mt-1">Список текущих и выполненных договоров</p>
        </div>
      </div>

      <button
        className="mt-6 min-h-11 w-full rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white disabled:opacity-50 md:max-w-xs shadow-xs"
        type="button"
        disabled
      >
        Новый заказ
      </button>

      <p className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-8 text-center text-sm text-stone-600">
        Заказов пока нет. Создание заказа появится на шаге U3.
      </p>

      <p className="mt-8 text-xs text-stone-500">
        {calcReady
          ? "✓ Модуль расчёта packages/calc успешно подключён."
          : "⚠ Модуль расчёта не ответил. Проверьте пакет packages/calc."}
      </p>
    </div>
  );
}
