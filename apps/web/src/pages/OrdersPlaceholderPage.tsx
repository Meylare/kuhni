import { isCalcModuleReady } from "../lib/calc-ready";

export function OrdersPlaceholderPage() {
  const calcReady = isCalcModuleReady();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 pb-24 md:pb-12 text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-white tracking-tight">Заказы</h1>
          <p className="text-xs text-zinc-400 mt-1">Список текущих и выполненных договоров</p>
        </div>
      </div>

      <button
        className="mt-6 min-h-11 w-full rounded-xl bg-white px-4 text-xs font-semibold text-black disabled:opacity-40 md:max-w-xs shadow-md"
        type="button"
        disabled
      >
        Новый заказ
      </button>

      <p className="mt-8 rounded-3xl border border-dashed border-white/10 bg-zinc-900/30 px-4 py-8 text-center text-xs text-zinc-400">
        Заказов пока нет.
      </p>

      <p className="mt-8 text-xs text-zinc-500">
        {calcReady
          ? "✓ Модуль расчёта packages/calc успешно подключён."
          : "⚠ Модуль расчёта не ответил. Проверьте пакет packages/calc."}
      </p>
    </div>
  );
}
