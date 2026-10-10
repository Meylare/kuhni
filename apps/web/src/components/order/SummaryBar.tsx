import { type CalculationOutcome } from "@kuhni/calc";
import { formatKzt } from "../../lib/money";
import {
  formatCalculationOutcomeError,
  getPlanCalculation,
  type OrderDisplayCalculation,
} from "../../lib/orders";
import { formatPercent } from "../../lib/parameters";
import type { OrderCalculation } from "../../types/database";

export interface SummaryBarProps {
  displayCalc: OrderDisplayCalculation | null;
  calcOutcome: CalculationOutcome | null;
  calcMode: "quote" | "check_contract";
  calcSaveSuccess: string | null;
  locked: boolean;
  calcSaving: boolean;
  networkError: string | null;
  showBreakdown: boolean;
  setShowBreakdown: (fn: (prev: boolean) => boolean) => void;
  calculations: OrderCalculation[];
  onSaveCalculation: () => void;
  onOpenUnlockModal: () => void;
  onSetShowLivePreview: (show: boolean) => void;
}

export function SummaryBar({
  displayCalc,
  calcOutcome,
  calcMode,
  calcSaveSuccess,
  locked,
  calcSaving,
  networkError,
  showBreakdown,
  setShowBreakdown,
  calculations,
  onSaveCalculation,
  onOpenUnlockModal,
  onSetShowLivePreview,
}: SummaryBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-300/80 bg-white/95 backdrop-blur-md shadow-2xl safe-bottom">
      <div className="mx-auto max-w-4xl px-4 py-3">
        {/* Результаты или Ошибка расчёта */}
        {!displayCalc ? (
          calcOutcome && !calcOutcome.ok ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800">
              <strong>Ошибка расчёта:</strong>{" "}
              {formatCalculationOutcomeError(calcOutcome.error)}
            </div>
          ) : null
        ) : (
          <div>
            {/* Предупреждения расчёта */}
            {displayCalc.warnings.length > 0 && (
              <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-medium text-amber-900">
                ⚠️ {displayCalc.warnings.join("; ")}
              </div>
            )}

            {/* Несоответствие цены договора в заказе и сохранённой версии (Step A1) */}
            {displayCalc.contractPriceMismatch && (
              <div className="mb-2 rounded-lg border border-amber-400 bg-amber-50 p-2 text-xs font-semibold text-amber-950">
                ⚠️ Цена договора в заказе ({formatKzt(displayCalc.contractPriceMismatch.current)} ₸) отличается от версии №{displayCalc.version} ({formatKzt(displayCalc.contractPriceMismatch.snapshot)} ₸). Сохраните новую версию или пересчитайте по актуальным данным.
              </div>
            )}

            {/* Сообщение об успешном сохранении (U5) */}
            {calcSaveSuccess && (
              <div className="mb-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs font-bold text-emerald-900">
                ✓ {calcSaveSuccess}
              </div>
            )}

            {/* Основные цифры (крупно) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-1 items-baseline gap-2 sm:gap-4">
                <div>
                  <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                    Цена ({calcMode === "quote" ? "расчёт" : "договор"})
                  </span>
                  <span className="text-lg sm:text-2xl font-extrabold text-stone-900">
                    {formatKzt(displayCalc.priceTotal)} ₸
                  </span>
                </div>

                <div className="border-l border-stone-200 pl-2 sm:pl-4">
                  <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                    Себестоимость
                  </span>
                  <span className="text-sm sm:text-base font-bold text-stone-700">
                    {formatKzt(displayCalc.costTotal)} ₸
                  </span>
                </div>

                <div className="border-l border-stone-200 pl-2 sm:pl-4">
                  <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                    Маржа
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm sm:text-base font-bold text-emerald-900">
                      {formatKzt(displayCalc.margin)} ₸
                    </span>
                    {displayCalc.marginPct !== null && (
                      <span className="text-xs font-semibold text-emerald-700">
                        ({formatPercent(displayCalc.marginPct)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Кнопки действий: Сохранить расчёт и Сводка */}
              <div className="flex items-center gap-1.5">
                {!locked ? (
                  <button
                    type="button"
                    disabled={calcSaving || Boolean(networkError)}
                    onClick={onSaveCalculation}
                    className="min-h-11 rounded-xl bg-emerald-900 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-950 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={networkError ? "Сохранение заблокировано из-за сетевой ошибки" : "Зафиксировать версию расчёта в базе"}
                  >
                    {calcSaving ? "Сохранение…" : "💾 Сохранить"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenUnlockModal}
                    className="min-h-11 rounded-xl bg-amber-900 px-3 text-xs font-bold text-white shadow-xs hover:bg-amber-950 active:scale-95"
                    title="Создать новую версию расчёта"
                  >
                    🔒 Новая версия
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className="min-h-11 rounded-xl border border-stone-300 bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-95"
                >
                  {showBreakdown ? "Скрыть ▲" : "Сводка ▼"}
                </button>
              </div>
            </div>

            {/* Плашка источника расчёта (Step A6, Q2) */}
            {calculations.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/90 px-3 py-1.5 text-xs text-stone-700">
                <div className="flex items-center gap-1.5">
                  {displayCalc.source === "saved" ? (
                    <>
                      <span>📌</span>
                      <span>
                        Отображается расчёт из версии №{displayCalc.version} от{" "}
                        {displayCalc.createdAt
                          ? new Date(displayCalc.createdAt).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                        {displayCalc.isContractBaseline && " (договорная)"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span className="font-semibold text-amber-900">
                        Превью расчёта по актуальным параметрам (не сохранено в истории)
                      </span>
                    </>
                  )}
                </div>

                <div>
                  {displayCalc.source === "saved" ? (
                    <button
                      type="button"
                      onClick={() => onSetShowLivePreview(true)}
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-50 active:scale-95 transition-all"
                    >
                      🔄 Пересчитать по актуальным параметрам
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetShowLivePreview(false)}
                      className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 active:scale-95 transition-all"
                    >
                      Вернуться к версии №{getPlanCalculation(calculations)?.version}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Раскрывающаяся подробная сводка */}
            {showBreakdown && (
              <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs divide-y divide-stone-200">
                <div className="pb-2">
                  <span className="font-bold text-stone-800">
                    Фиксированные расходы: {formatKzt(displayCalc.fixedCost)} ₸
                  </span>
                  <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-stone-600">
                    <span>Материалы: {formatKzt(displayCalc.categoryTotals.materials)} ₸</span>
                    <span>Фасады: {formatKzt(displayCalc.categoryTotals.facades)} ₸</span>
                    <span>Цех: {formatKzt(displayCalc.categoryTotals.workshop)} ₸</span>
                    <span>Фурнитура: {formatKzt(displayCalc.categoryTotals.hardware)} ₸</span>
                    <span>Транспорт: {formatKzt(displayCalc.categoryTotals.transport)} ₸</span>
                    <span>Работа: {formatKzt(displayCalc.categoryTotals.labor)} ₸</span>
                    <span>Остальное: {formatKzt(displayCalc.categoryTotals.other)} ₸</span>
                    <span>Корректировки: {formatKzt(displayCalc.categoryTotals.adjustments)} ₸</span>
                  </div>
                </div>

                <div className="py-2 text-[11px] text-stone-700 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Сборка: {formatKzt(displayCalc.assembly)} ₸</span>
                  <span>Технолог: {formatKzt(displayCalc.technolog)} ₸</span>
                  <span>Резерв на риск: {formatKzt(displayCalc.riskReserve)} ₸</span>
                  <span className="font-semibold">
                    Мин. цена для целевой маржи: {formatKzt(displayCalc.minPriceForTargetMargin)} ₸
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
