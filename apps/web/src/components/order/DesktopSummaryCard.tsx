import { type CalculationOutcome } from "@kuhni/calc";
import { getMarginColor } from "../../lib/margin-colors";
import { formatKzt } from "../../lib/money";
import {
  formatCalculationOutcomeError,
  getPlanCalculation,
  type OrderDisplayCalculation,
} from "../../lib/orders";
import { formatPercent } from "../../lib/parameters";
import type { OrderCalculation } from "../../types/database";

export interface DesktopSummaryCardProps {
  displayCalc: OrderDisplayCalculation | null;
  calcOutcome: CalculationOutcome | null;
  calcMode: "quote" | "check_contract";
  calcSaveSuccess: string | null;
  locked: boolean;
  calcSaving: boolean;
  networkError: string | null;
  calculations: OrderCalculation[];
  targetMarginPct?: number;
  onSaveCalculation: () => void;
  onOpenUnlockModal: () => void;
  onSetShowLivePreview: (show: boolean) => void;
}

export function DesktopSummaryCard({
  displayCalc,
  calcOutcome,
  calcMode,
  calcSaveSuccess,
  locked,
  calcSaving,
  networkError,
  calculations,
  targetMarginPct = 0.18,
  onSaveCalculation,
  onOpenUnlockModal,
  onSetShowLivePreview,
}: DesktopSummaryCardProps) {
  const marginStyle = getMarginColor(displayCalc?.marginPct, targetMarginPct);

  return (
    <aside className="sticky top-20 hidden lg:flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs w-[360px] shrink-0">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <h3 className="text-base font-bold text-stone-900">Итоги расчёта</h3>
        <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
          {calcMode === "quote" ? "Расчёт (quote)" : "Договор (check)"}
        </span>
      </div>

      {/* Ошибка расчёта */}
      {!displayCalc && calcOutcome && !calcOutcome.ok && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
          <strong>Ошибка расчёта:</strong> {formatCalculationOutcomeError(calcOutcome.error)}
        </div>
      )}

      {/* Предупреждения расчёта */}
      {displayCalc && displayCalc.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          ⚠️ {displayCalc.warnings.join("; ")}
        </div>
      )}

      {displayCalc?.contractPriceMismatch && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-2.5 text-xs text-amber-950 font-medium">
          ⚠️ Цена договора в заказе ({formatKzt(displayCalc.contractPriceMismatch.current)} ₸) отличается от версии №{displayCalc.version} ({formatKzt(displayCalc.contractPriceMismatch.snapshot)} ₸).
        </div>
      )}

      {calcSaveSuccess && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-900">
          ✓ {calcSaveSuccess}
        </div>
      )}

      {displayCalc && (
        <>
          {/* Главные цифры */}
          <div className="rounded-xl bg-stone-50 p-3.5 border border-stone-200/80">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Итоговая цена ({calcMode === "quote" ? "к оплате" : "договорная"})
            </div>
            <div className="mt-0.5 text-2xl font-black text-stone-900">
              {formatKzt(displayCalc.priceTotal)} ₸
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-200/60 pt-2.5 text-xs">
              <div>
                <span className="text-[10px] text-stone-500 block">Себестоимость</span>
                <span className="font-bold text-stone-800">{formatKzt(displayCalc.costTotal)} ₸</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 block">Маржа</span>
                <span className={`font-bold ${marginStyle.text}`}>
                  {formatKzt(displayCalc.margin)} ₸{" "}
                  {displayCalc.marginPct !== null && `(${formatPercent(displayCalc.marginPct)})`}
                </span>
              </div>
            </div>
          </div>

          {/* Кнопка фиксации версии (U4) */}
          {!locked ? (
            <button
              type="button"
              disabled={calcSaving || Boolean(networkError)}
              onClick={onSaveCalculation}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white shadow-xs hover:bg-emerald-950 active:scale-98 disabled:opacity-50"
            >
              {calcSaving ? "Фиксация…" : "Зафиксировать версию"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenUnlockModal}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-bold text-white shadow-xs hover:bg-amber-950 active:scale-98"
            >
              🔒 Открыть для правок
            </button>
          )}

          {/* Источник расчёта */}
          {calculations.length > 0 && (
            <div className="flex items-center justify-between text-xs text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-200">
              <span className="truncate pr-1">
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

          {/* Детализация расходов */}
          <div className="mt-1 flex flex-col gap-1.5 border-t border-stone-100 pt-3 text-xs">
            <span className="font-bold text-stone-800 text-[11px] uppercase tracking-wider">
              Структура затрат
            </span>
            <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
              <span>Прямые материалы и работы:</span>
              <span className="font-semibold text-stone-900">{formatKzt(displayCalc.fixedCost)} ₸</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
              <span>Сборка:</span>
              <span className="font-semibold text-stone-900">{formatKzt(displayCalc.assembly)} ₸</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
              <span>Технолог:</span>
              <span className="font-semibold text-stone-900">{formatKzt(displayCalc.technolog)} ₸</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
              <span>Резерв на риск:</span>
              <span className="font-semibold text-stone-900">{formatKzt(displayCalc.riskReserve)} ₸</span>
            </div>
            <div className="flex justify-between py-1 text-stone-600">
              <span>Мин. цена для целевой маржи:</span>
              <span className="font-bold text-stone-900">{formatKzt(displayCalc.minPriceForTargetMargin)} ₸</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
