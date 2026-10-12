import { type CalculationOutcome } from "@kuhni/calc";
import { type VersionSyncStatus } from "../../lib/calculation-versions";
import { getMarginColor } from "../../lib/margin-colors";
import { formatKzt } from "../../lib/money";
import {
  formatCalculationOutcomeError,
  getPlanCalculation,
  type OrderDisplayCalculation,
} from "../../lib/orders";
import { formatMarginPercent } from "../../lib/parameters";
import type { OrderCalculation } from "../../types/database";

export interface SummaryBarProps {
  displayCalc: OrderDisplayCalculation | null;
  calcOutcome: CalculationOutcome | null;
  calcMode: "quote" | "check_contract";
  calcSaveSuccess: string | null;
  syncStatus?: VersionSyncStatus;
  locked: boolean;
  calcSaving: boolean;
  networkError: string | null;
  showBreakdown: boolean;
  setShowBreakdown: (fn: (prev: boolean) => boolean) => void;
  calculations: OrderCalculation[];
  targetMarginPct?: number;
  onSaveCalculation: () => void;
  onOpenUnlockModal: () => void;
  onSetShowLivePreview: (show: boolean) => void;
}

export function SummaryBar({
  displayCalc,
  calcOutcome,
  calcMode,
  calcSaveSuccess,
  syncStatus,
  locked,
  calcSaving,
  networkError,
  showBreakdown,
  setShowBreakdown,
  calculations,
  targetMarginPct = 0.18,
  onSaveCalculation,
  onOpenUnlockModal,
  onSetShowLivePreview,
}: SummaryBarProps) {
  const marginStyle = getMarginColor(displayCalc?.marginPct, targetMarginPct);

  return (
    <>
      {/* Затемняющий оверлей для мобильной шторки (70% высоты) */}
      {showBreakdown && (
        <div
          onClick={() => setShowBreakdown(() => false)}
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Мобильная нижняя шторка и панель (U3.1, U3.2: lg:hidden) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col safe-bottom">
        {/* Предупреждения и ошибки над свёрнутой панелью (U3.3) */}
        {!displayCalc && calcOutcome && !calcOutcome.ok && (
          <div className="mx-2 mb-1 rounded-xl border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 shadow-md">
            ⚠️ {formatCalculationOutcomeError(calcOutcome.error)}
          </div>
        )}

        {displayCalc && displayCalc.warnings.length > 0 && (
          <div className="mx-2 mb-1 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900 shadow-md">
            ⚠️ {displayCalc.warnings.join("; ")}
          </div>
        )}

        {displayCalc?.contractPriceMismatch && (
          <div className="mx-2 mb-1 rounded-xl border border-amber-400 bg-amber-50 p-2 text-xs font-semibold text-amber-950 shadow-md">
            ⚠️ Цена договора в заказе отличается от версии №{displayCalc.version}.
          </div>
        )}

        {calcSaveSuccess && (
          <div className="mx-2 mb-1 rounded-xl border border-emerald-300 bg-emerald-50 p-2 text-xs font-bold text-emerald-900 shadow-md">
            ✓ {calcSaveSuccess}
          </div>
        )}

        {/* Раскрытая шторка (70% высоты экрана) */}
        {showBreakdown && displayCalc && (
          <div className="max-h-[70vh] flex flex-col rounded-t-3xl border-t border-stone-200 bg-white p-4 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">Подробная сводка расчёта</span>
              <button
                type="button"
                onClick={() => setShowBreakdown(() => false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 text-sm font-semibold"
              >
                ▼ Скрыть
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Себестоимость:</span>
                <span className="font-bold text-stone-900">{formatKzt(displayCalc.costTotal)} ₸</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Маржа:</span>
                <span className={`font-bold ${marginStyle.text}`}>
                  {formatKzt(displayCalc.margin)} ₸{" "}
                  {displayCalc.marginPct !== null && `(${formatMarginPercent(displayCalc.marginPct)})`}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Прямые материалы и работы:</span>
                <span className="font-semibold text-stone-800">{formatKzt(displayCalc.fixedCost)} ₸</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Сборка:</span>
                <span className="font-semibold text-stone-800">{formatKzt(displayCalc.assembly)} ₸</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Технолог:</span>
                <span className="font-semibold text-stone-800">{formatKzt(displayCalc.technolog)} ₸</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Резерв на риск:</span>
                <span className="font-semibold text-stone-800">{formatKzt(displayCalc.riskReserve)} ₸</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Мин. цена для целевой маржи:</span>
                <span className="font-bold text-stone-900">{formatKzt(displayCalc.minPriceForTargetMargin)} ₸</span>
              </div>

              {calculations.length > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-stone-50 p-2.5 border border-stone-200">
                  <span className="text-[11px] text-stone-700">
                    {displayCalc.source === "saved"
                      ? `Версия №${displayCalc.version}`
                      : "⚡ Актуальное превью"}
                  </span>
                  {displayCalc.source === "saved" ? (
                    <button
                      type="button"
                      onClick={() => onSetShowLivePreview(true)}
                      className="text-emerald-900 font-semibold underline text-[11px]"
                    >
                      Пересчитать
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetShowLivePreview(false)}
                      className="text-stone-600 underline text-[11px]"
                    >
                      К версии №{getPlanCalculation(calculations)?.version}
                    </button>
                  )}
                </div>
              )}
              {syncStatus && (
                <div
                  className={`mt-2 flex items-center justify-between rounded-xl p-2.5 border text-xs font-semibold ${
                    syncStatus.badgeColor === "warning"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-stone-50 text-stone-700 border-stone-200"
                  }`}
                >
                  <span className="text-stone-500">Версия расчёта:</span>
                  <span>{syncStatus.label}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Свёрнутая нижняя панель (U3.1: высота <= 64px) */}
        <div className="h-16 border-t border-stone-300 bg-white px-3 flex items-center justify-between shadow-2xl">
          {displayCalc ? (
            <div className="flex items-center gap-2.5">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-stone-500 leading-tight">
                  {calcMode === "quote" ? "Цена" : "Договор"}
                </span>
                <span className="text-lg font-black text-stone-900 leading-none">
                  {formatKzt(displayCalc.priceTotal)} ₸
                </span>
              </div>

              <div className="border-l border-stone-200 pl-2">
                <span className="block text-[10px] uppercase font-semibold text-stone-500 leading-tight">
                  Маржа
                </span>
                <span className={`text-xs font-black ${marginStyle.text} leading-none`}>
                  {formatMarginPercent(displayCalc.marginPct)}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-stone-500 font-medium">Расчёт обновляется…</span>
          )}

          <div className="flex items-center gap-1.5">
            {syncStatus && syncStatus.badgeColor === "warning" && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600 inline-block" />
                Есть изменения
              </span>
            )}
            {!locked ? (
              <button
                type="button"
                disabled={calcSaving || Boolean(networkError)}
                onClick={onSaveCalculation}
                className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-950 active:scale-95 disabled:opacity-50"
              >
                {calcSaving ? "…" : "Зафиксировать"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenUnlockModal}
                className="flex min-h-11 items-center justify-center rounded-xl bg-amber-900 px-3 text-xs font-bold text-white shadow-xs hover:bg-amber-950 active:scale-95"
              >
                🔒 Открыть
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBreakdown((prev) => !prev)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200 active:scale-95 text-xs font-bold"
              title="Раскрыть подробности"
            >
              {showBreakdown ? "▼" : "▲"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
