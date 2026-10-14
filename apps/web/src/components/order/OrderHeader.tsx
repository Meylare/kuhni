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
  statusConfig: _statusConfig,
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
    <div className="flex flex-col gap-4 text-zinc-100">
      {/* Навигационная полоса: назад, автосохранение, версии и статус */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#121215] px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <span>←</span>
            <span>К списку сделок</span>
          </button>

          {/* Индикатор автосохранения */}
          {autoSaveToast && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-semibold text-emerald-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{autoSaveToast}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Кнопка версий расчёта */}
          <button
            type="button"
            onClick={onOpenVersionsModal}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            title="История версий расчёта"
          >
            <span>🕘</span>
            <span>Версии ({calculationsCount})</span>
          </button>

          {/* Статус заказа */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {statusLabel}
          </span>

          {/* Редактировать инфо */}
          <button
            type="button"
            onClick={onOpenEditHeader}
            className="rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            ✏️ Инфо
          </button>
        </div>
      </div>

      {/* Ошибка сети */}
      {networkError && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <strong className="text-sm font-bold text-white block">
                {networkError}
              </strong>
              <p className="mt-0.5 text-rose-300">
                Редактирование защищено от потери данных.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetryLoad}
            className="self-start sm:self-auto rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 cursor-pointer"
          >
            🔄 Повторить
          </button>
        </div>
      )}

      {/* Предупреждение о блокировке */}
      {locked && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">🔒</span>
            <div>
              <strong className="text-sm font-bold text-white">Заказ зафиксирован в статусе «{statusLabel}»</strong>
              <p className="mt-0.5 text-amber-300/80">
                Смета защищена от случайных изменений.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUnlockModal}
            className="self-start sm:self-auto rounded-full bg-amber-500 hover:bg-amber-400 px-4 py-1.5 text-xs font-bold text-black cursor-pointer"
          >
            Открыть для правок
          </button>
        </div>
      )}

      {/* Главная карточка проекта */}
      <div className="rounded-3xl border border-white/[0.07] bg-[#121215] p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
              {order.name}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400 font-medium flex-wrap">
              {order.client_label ? (
                <span className="text-zinc-200 font-semibold flex items-center gap-1">
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
              <p className="mt-2 text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800 p-2.5 rounded-xl italic">
                {order.note}
              </p>
            ) : null}
          </div>

          {/* Правая часть: договорная сумма и кнопка экспорта КП */}
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {order.contract_price !== null && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2 text-right">
                <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Договор
                </span>
                <span className="text-sm sm:text-base font-bold text-white tabular-nums font-mono">
                  {formatKzt(order.contract_price)} ₸
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onCopySummary}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                copySuccess
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-white/[0.08] bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800"
              }`}
              title="Скопировать коммерческое предложение для клиента (WhatsApp / Telegram)"
            >
              <span>{copySuccess ? "✓" : "📋"}</span>
              <span>{copySuccess ? "КП скопировано!" : "Скопировать КП"}</span>
            </button>
          </div>
        </div>

        {/* 3-Этапный конвейер проекта: Смета ──> Договор ──> Факт */}
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
            Этап проекта:
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-zinc-950/80 p-1.5 border border-zinc-850">
            <button
              type="button"
              onClick={() => onSelectStage("quote")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
                currentStage === "quote"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                1
              </span>
              <span>Смета</span>
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono">
                {linesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStage("contract")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
                currentStage === "contract"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">
                2
              </span>
              <span>Договор</span>
              {order.contract_price !== null && (
                <span className="hidden sm:inline rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-indigo-300 font-mono">
                  согласован
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectStage("fact")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
                currentStage === "fact"
                  ? "bg-zinc-800 text-white shadow-xs font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold">
                3
              </span>
              <span>Факт</span>
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono">
                {factCount}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
