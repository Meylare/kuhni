import { formatKzt } from "../../lib/money";
import type { Order } from "../../types/database";

export type OrderStage = "quote" | "contract" | "fact";

export interface OrderHeaderProps {
  order: Order;
  statusConfig: { bg: string; text: string; border: string; dot: string };
  statusLabel: string;
  locked: boolean;
  networkError: string | null;
  copySuccess: boolean;
  autoSaveToast?: string | null;
  currentStage: OrderStage;
  linesCount: number;
  calculationsCount: number;
  factCount: number;
  onBack: () => void;
  onOpenEditHeader: () => void;
  onRetryLoad: () => void;
  onOpenUnlockModal: () => void;
  onOpenVersionsModal: () => void;
  onCopySummary: () => void;
  onSelectStage: (stage: OrderStage) => void;
}

export function OrderHeader({
  order,
  statusConfig,
  statusLabel,
  locked,
  networkError,
  copySuccess,
  autoSaveToast,
  currentStage,
  linesCount,
  calculationsCount,
  factCount,
  onBack,
  onOpenEditHeader,
  onRetryLoad,
  onOpenUnlockModal,
  onOpenVersionsModal,
  onCopySummary,
  onSelectStage,
}: OrderHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Навигационная полоса: назад, автосохранение, версии и статус */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 text-xs font-bold text-stone-700 shadow-xs hover:bg-stone-50 hover:text-stone-900 active:scale-98 transition-all cursor-pointer"
          >
            <span>←</span>
            <span>К списку заказов</span>
          </button>

          {/* Индикатор автосохранения */}
          {autoSaveToast && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-800 transition-all animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{autoSaveToast}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Кнопка версий расчёта */}
          <button
            type="button"
            onClick={onOpenVersionsModal}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 shadow-xs hover:bg-stone-50 active:scale-98 transition-all cursor-pointer"
            title="История версий расчёта"
          >
            <span>🕘</span>
            <span>Версии ({calculationsCount})</span>
          </button>

          {/* Статус заказа */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
            {statusLabel}
          </span>

          {/* Редактировать инфо */}
          <button
            type="button"
            onClick={onOpenEditHeader}
            className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 hover:text-stone-900 shadow-xs transition-all cursor-pointer"
          >
            ✏️ Инфо
          </button>
        </div>
      </div>

      {/* Ошибка сети */}
      {networkError && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <strong className="text-sm font-bold text-rose-900 block">
                {networkError}
              </strong>
              <p className="mt-0.5 text-rose-700">
                Редактирование защищено от потери данных.
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

      {/* Предупреждение о блокировке */}
      {locked && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">🔒</span>
            <div>
              <strong className="text-sm font-bold text-amber-950">Заказ зафиксирован в статусе «{statusLabel}»</strong>
              <p className="mt-0.5 text-amber-800">
                Смета защищена от случайных изменений. Нажмите кнопку справа, чтобы внести правки.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUnlockModal}
            className="self-start sm:self-auto min-h-10 whitespace-nowrap rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-950 active:scale-98 cursor-pointer"
          >
            Открыть для правок
          </button>
        </div>
      )}

      {/* Главная карточка проекта */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight leading-tight">
              {order.name}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-xs text-stone-500 font-medium flex-wrap">
              {order.client_label ? (
                <span className="text-stone-800 font-bold flex items-center gap-1">
                  <span>👤</span>
                  <span>{order.client_label}</span>
                </span>
              ) : null}
              {order.created_at && (
                <span>
                  Создан: {new Date(order.created_at).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>

            {order.note ? (
              <p className="mt-2 text-xs text-stone-600 bg-stone-50 border border-stone-200/60 p-2.5 rounded-xl italic">
                {order.note}
              </p>
            ) : null}
          </div>

          {/* Правая часть: договорная сумма и кнопка экспорта КП */}
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {order.contract_price !== null && (
              <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200/60 px-3.5 py-2 text-right">
                <span className="block text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                  Договор
                </span>
                <span className="text-sm sm:text-base font-black text-indigo-950 tabular-nums">
                  {formatKzt(order.contract_price)} ₸
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onCopySummary}
              className={`flex min-h-11 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                copySuccess
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
              }`}
              title="Скопировать коммерческое предложение для клиента (WhatsApp / Telegram)"
            >
              <span>{copySuccess ? "✓" : "📋"}</span>
              <span>{copySuccess ? "КП скопировано!" : "Скопировать КП"}</span>
            </button>
          </div>
        </div>

        {/* 3-Этапный конвейер проекта: Смета ──> Договор ──> Факт */}
        <div className="mt-5 border-t border-stone-100 pt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Этап проекта:
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100/80 p-1.5 border border-stone-200/60">
            <button
              type="button"
              onClick={() => onSelectStage("quote")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-11 rounded-xl py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                currentStage === "quote"
                  ? "bg-white text-emerald-950 shadow-xs font-black"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 text-[11px]">
                1
              </span>
              <span>Смета</span>
              <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 font-semibold">
                {linesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStage("contract")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-11 rounded-xl py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                currentStage === "contract"
                  ? "bg-white text-indigo-950 shadow-xs font-black"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-900 text-[11px]">
                2
              </span>
              <span>Договор</span>
              {order.contract_price !== null && (
                <span className="hidden sm:inline rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700 font-semibold">
                  согласован
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectStage("fact")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-11 rounded-xl py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                currentStage === "fact"
                  ? "bg-white text-emerald-950 shadow-xs font-black"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-900 text-[11px]">
                3
              </span>
              <span>Факт</span>
              <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 font-semibold">
                {factCount}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
