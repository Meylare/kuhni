import { type CalculationOutcome } from "@kuhni/calc";
import { type VersionSyncStatus } from "../../lib/calculation-versions";
import { getMarginColor } from "../../lib/margin-colors";
import { formatKzt } from "../../lib/money";
import {
  formatCalculationOutcomeError,
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
  syncStatus: _syncStatus,
  locked,
  calcSaving,
  networkError,
  showBreakdown,
  setShowBreakdown,
  calculations,
  targetMarginPct = 0.28,
  onSaveCalculation,
  onOpenUnlockModal,
  onSetShowLivePreview,
}: SummaryBarProps) {
  const marginStyle = getMarginColor(displayCalc?.marginPct, targetMarginPct);

  return (
    <>
      {/* Затемняющий оверлей для мобильной шторки */}
      {showBreakdown && (
        <div
          onClick={() => setShowBreakdown(() => false)}
          className="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Мобильная нижняя шторка и закрепленная панель */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col safe-bottom">
        {/* Предупреждения и ошибки над панелью */}
        {!displayCalc && calcOutcome && !calcOutcome.ok && (
          <div className="mx-3 mb-1.5 rounded-2xl border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800 shadow-lg">
            ⚠️ {formatCalculationOutcomeError(calcOutcome.error)}
          </div>
        )}

        {displayCalc && displayCalc.warnings.length > 0 && (
          <div className="mx-3 mb-1.5 rounded-2xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-bold text-amber-900 shadow-lg">
            ⚠️ {displayCalc.warnings.join("; ")}
          </div>
        )}

        {calcSaveSuccess && (
          <div className="mx-3 mb-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-900 shadow-lg animate-pulse">
            ✓ {calcSaveSuccess}
          </div>
        )}

        {/* Раскрытая подробная шторка */}
        {showBreakdown && displayCalc && (
          <div className="max-h-[72vh] flex flex-col rounded-t-3xl border-t border-stone-200 bg-white p-5 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-black text-stone-900 text-sm">
                Финансовая сводка проекта
              </span>
              <button
                type="button"
                onClick={() => setShowBreakdown(() => false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mt-3.5 flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600 font-medium">Себестоимость:</span>
                <span className="font-black text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.costTotal)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600 font-medium">Чистая прибыль:</span>
                <span className="font-black text-emerald-800 tabular-nums">
                  +{formatKzt(displayCalc.margin)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600 font-medium">Маржинальность:</span>
                <span className={`font-black ${marginStyle.text}`}>
                  {displayCalc.marginPct !== null ? formatMarginPercent(displayCalc.marginPct) : "—"}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Прямые материалы и работы:</span>
                <span className="font-bold text-stone-800 tabular-nums">
                  {formatKzt(displayCalc.fixedCost)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Сборка и монтаж:</span>
                <span className="font-bold text-stone-800 tabular-nums">
                  {formatKzt(displayCalc.assembly)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Услуги технолога:</span>
                <span className="font-bold text-stone-800 tabular-nums">
                  {formatKzt(displayCalc.technolog)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">Резерв на риски:</span>
                <span className="font-bold text-stone-800 tabular-nums">
                  {formatKzt(displayCalc.riskReserve)} ₸
                </span>
              </div>

              <div className="flex justify-between pt-1 font-medium">
                <span className="text-stone-600">Мин. цена для целевой маржи:</span>
                <span className="font-black text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.minPriceForTargetMargin)} ₸
                </span>
              </div>

              {calculations.length > 0 && (
                <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-stone-50 p-3 border border-stone-200">
                  <span className="text-xs font-bold text-stone-700">
                    {displayCalc.source === "saved"
                      ? `Версия №${displayCalc.version}`
                      : "⚡ Актуальный расчёт"}
                  </span>
                  {displayCalc.source === "saved" ? (
                    <button
                      type="button"
                      onClick={() => onSetShowLivePreview(true)}
                      className="text-xs font-bold text-emerald-900 underline"
                    >
                      Показать актуальный
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetShowLivePreview(false)}
                      className="text-xs font-bold text-stone-600 underline"
                    >
                      К сохранённой версии
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Закрепленная панель внизу (Compact Bar) */}
        <div className="border-t border-stone-200/90 bg-[#fbfaf7]/95 px-4 py-3 backdrop-blur-lg shadow-lg">
          <div className="flex items-center justify-between gap-3">
            {/* Левая часть: сумма и маржа */}
            <div
              className="flex-1 cursor-pointer min-w-0"
              onClick={() => setShowBreakdown((prev) => !prev)}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-stone-900 tabular-nums truncate">
                  {displayCalc ? `${formatKzt(displayCalc.priceTotal)} ₸` : "— ₸"}
                </span>
                {displayCalc && (
                  <span className={`rounded-lg px-1.5 py-0.5 text-[11px] font-black ${marginStyle.badge}`}>
                    {displayCalc.marginPct !== null ? formatMarginPercent(displayCalc.marginPct) : "—"}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                <span>{calcMode === "quote" ? "Смета" : "Договор"}</span>
                <span>•</span>
                <span className="text-emerald-900 font-bold underline">
                  {showBreakdown ? "Скрыть детали" : "Детали расчёта ▲"}
                </span>
              </div>
            </div>

            {/* Правая часть: кнопка фиксации */}
            <div className="shrink-0">
              {!locked ? (
                <button
                  type="button"
                  disabled={calcSaving || Boolean(networkError)}
                  onClick={onSaveCalculation}
                  className="flex min-h-11 items-center justify-center rounded-2xl bg-emerald-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-950 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {calcSaving ? "Сохранение…" : "💾 Сохранить"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenUnlockModal}
                  className="flex min-h-11 items-center justify-center rounded-2xl bg-amber-900 px-3.5 text-xs font-bold text-white shadow-sm hover:bg-amber-950 active:scale-98 transition-all cursor-pointer"
                >
                  🔒 Править
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
