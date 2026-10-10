import { formatKzt } from "../../lib/money";
import type { Order } from "../../types/database";

export interface OrderHeaderProps {
  order: Order;
  statusConfig: { bg: string; text: string; border: string; dot: string };
  statusLabel: string;
  locked: boolean;
  networkError: string | null;
  copySuccess: boolean;
  orderTab: "calc" | "history" | "fact";
  linesCount: number;
  calculationsCount: number;
  factCount: number;
  onBack: () => void;
  onOpenEditHeader: () => void;
  onRetryLoad: () => void;
  onOpenUnlockModal: () => void;
  onCopySummary: () => void;
  onSelectTab: (tab: "calc" | "history" | "fact") => void;
}

export function OrderHeader({
  order,
  statusConfig,
  statusLabel,
  locked,
  networkError,
  copySuccess,
  orderTab,
  linesCount,
  calculationsCount,
  factCount,
  onBack,
  onOpenEditHeader,
  onRetryLoad,
  onOpenUnlockModal,
  onCopySummary,
  onSelectTab,
}: OrderHeaderProps) {
  return (
    <>
      {/* Верхняя навигация и статус */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white/80 px-3.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-white active:scale-98"
        >
          <span>←</span>
          <span>Заказы</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={onOpenEditHeader}
            className="min-h-10 rounded-xl border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Изменить заказ
          </button>
        </div>
      </div>

      {/* Баннер сетевой ошибки загрузки заказа (Step B4) */}
      {networkError && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <strong className="text-sm font-bold text-rose-900 block">
                {networkError}
              </strong>
              <p className="mt-0.5 text-rose-700">
                Редактирование, добавление позиций и сохранение расчёта заблокированы для предотвращения потери данных.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetryLoad}
            className="self-start sm:self-auto min-h-10 whitespace-nowrap rounded-xl bg-rose-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-900 active:scale-98 cursor-pointer"
          >
            🔄 Повторить загрузку
          </button>
        </div>
      )}

      {/* Предупреждение о блокировке (U5) */}
      {locked && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">🔒</span>
            <div>
              <strong className="text-sm font-bold text-amber-950">Заказ заблокирован от случайных правок</strong>
              <p className="mt-0.5 text-amber-800">
                Заказ находится в статусе «{statusLabel}». Позиции и параметры защищены от изменений.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUnlockModal}
            className="self-start sm:self-auto min-h-10 whitespace-nowrap rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-950 active:scale-98"
          >
            Создать новую версию расчёта
          </button>
        </div>
      )}

      {/* Карточка заказа: название, клиент, сумма */}
      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900 md:text-2xl">
              {order.name}
            </h1>
            {order.client_label && (
              <p className="mt-0.5 text-xs text-stone-500">
                Клиент: <span className="font-semibold text-stone-800">{order.client_label}</span>
              </p>
            )}
            {order.note && (
              <p className="mt-1 text-xs text-stone-600 bg-stone-50 p-2 rounded-lg italic">
                {order.note}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {order.contract_price !== null && (
              <div className="rounded-xl bg-stone-100 px-3 py-1.5 text-right">
                <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                  Договор
                </span>
                <span className="text-sm font-bold text-stone-900">
                  {formatKzt(order.contract_price)} ₸
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onCopySummary}
              className="min-h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700 hover:bg-stone-100"
              title="Копировать сводку расчёта"
            >
              {copySuccess ? "✓ Скопировано" : "📋 Скопировать"}
            </button>
          </div>
        </div>

        {/* Вкладки: Расчёт / История / Факт */}
        <div className="mt-4 flex items-center gap-1 border-t border-stone-100 pt-3">
          <button
            type="button"
            onClick={() => onSelectTab("calc")}
            className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all ${
              orderTab === "calc"
                ? "bg-emerald-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            1. Расчёт ({linesCount} поз.)
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("history")}
            className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all ${
              orderTab === "history"
                ? "bg-emerald-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            2. История версий ({calculationsCount})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("fact")}
            className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all ${
              orderTab === "fact"
                ? "bg-emerald-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            3. Факт ({factCount})
          </button>
        </div>
      </div>
    </>
  );
}
