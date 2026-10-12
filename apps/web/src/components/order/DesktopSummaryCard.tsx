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

export interface DesktopSummaryCardProps {
  displayCalc: OrderDisplayCalculation | null;
  calcOutcome: CalculationOutcome | null;
  calcMode: "quote" | "check_contract";
  calcSaveSuccess: string | null;
  syncStatus?: VersionSyncStatus;
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
  syncStatus,
  locked,
  calcSaving,
  networkError,
  calculations,
  targetMarginPct = 0.28,
  onSaveCalculation,
  onOpenUnlockModal,
  onSetShowLivePreview,
}: DesktopSummaryCardProps) {
  const marginStyle = getMarginColor(displayCalc?.marginPct, targetMarginPct);

  return (
    <aside className="sticky top-20 hidden lg:flex flex-col gap-4 rounded-3xl border border-stone-200/90 bg-white p-5 shadow-sm w-[360px] shrink-0">
      {/* Шапка пульта */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-black text-stone-900 tracking-tight">
            Финансовый пульт
          </h3>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold text-stone-600">
          {calcMode === "quote" ? "Смета • Quote" : "Договор • Contract"}
        </span>
      </div>

      {/* Ошибка расчёта */}
      {!displayCalc && calcOutcome && !calcOutcome.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <strong>Ошибка расчёта:</strong> {formatCalculationOutcomeError(calcOutcome.error)}
        </div>
      )}

      {/* Предупреждения расчёта */}
      {displayCalc && displayCalc.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 font-medium">
          ⚠️ {displayCalc.warnings.join("; ")}
        </div>
      )}

      {displayCalc?.contractPriceMismatch && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 font-bold">
          ⚠️ Цена договора в заказе ({formatKzt(displayCalc.contractPriceMismatch.current)} ₸) отличается от сохранённой версии №{displayCalc.version} ({formatKzt(displayCalc.contractPriceMismatch.snapshot)} ₸).
        </div>
      )}

      {calcSaveSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-900 animate-pulse">
          ✓ {calcSaveSuccess}
        </div>
      )}

      {displayCalc && (
        <>
          {/* Главная карточка с итоговой ценой и маржой */}
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-950 p-4 text-white shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              {calcMode === "quote" ? "Рекомендуемая стоимость" : "Согласованная цена"}
            </span>

            <div className="mt-1 text-3xl font-black tracking-tight tabular-nums">
              {formatKzt(displayCalc.priceTotal)} ₸
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-stone-800 pt-3 text-xs">
              <div>
                <span className="text-[10px] text-stone-400 block font-medium">Себестоимость</span>
                <span className="font-bold text-stone-200 tabular-nums">
                  {formatKzt(displayCalc.costTotal)} ₸
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 block font-medium">Чистая прибыль</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  +{formatKzt(displayCalc.margin)} ₸
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-stone-800/60 pt-2">
              <span className="text-[11px] text-stone-400 font-medium">Маржинальность:</span>
              <span className={`rounded-lg px-2 py-0.5 text-xs font-black ${marginStyle.badge}`}>
                {displayCalc.marginPct !== null ? formatMarginPercent(displayCalc.marginPct) : "—"}
              </span>
            </div>
          </div>

          {/* Детализация себестоимости */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-3.5 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-2">
              Структура затрат
            </span>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between py-1 border-b border-stone-200/50">
                <span className="text-stone-600">Материалы и работы:</span>
                <span className="font-bold text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.fixedCost)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-200/50">
                <span className="text-stone-600">Сборка и монтаж:</span>
                <span className="font-bold text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.assembly)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-200/50">
                <span className="text-stone-600">Услуги технолога:</span>
                <span className="font-bold text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.technolog)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-200/50">
                <span className="text-stone-600">Резерв на риски:</span>
                <span className="font-bold text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.riskReserve)} ₸
                </span>
              </div>

              <div className="flex justify-between pt-1">
                <span className="text-stone-600 font-medium">Мин. цена для целевой маржи:</span>
                <span className="font-black text-stone-900 tabular-nums">
                  {formatKzt(displayCalc.minPriceForTargetMargin)} ₸
                </span>
              </div>
            </div>
          </div>

          {/* Кнопка фиксации версии в истории */}
          {!locked ? (
            <button
              type="button"
              disabled={calcSaving || Boolean(networkError)}
              onClick={onSaveCalculation}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-950 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>💾</span>
              <span>{calcSaving ? "Сохранение…" : "Зафиксировать версию сметы"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenUnlockModal}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-amber-950 active:scale-98 transition-all cursor-pointer"
            >
              <span>🔒</span>
              <span>Открыть заказ для правок</span>
            </button>
          )}

          {/* Индикатор статуса синхронизации версии */}
          {syncStatus && (
            <div
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                syncStatus.badgeColor === "warning"
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {syncStatus.badgeColor === "warning" && (
                <span className="h-2 w-2 rounded-full bg-amber-600 inline-block animate-pulse" />
              )}
              <span>{syncStatus.label}</span>
            </div>
          )}

          {/* Переключатель живого превью */}
          {calculations.length > 0 && (
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
              <span className="font-medium">
                {displayCalc.source === "saved"
                  ? `Показана версия №${displayCalc.version}`
                  : "⚡ Актуальный расчёт"}
              </span>

              {displayCalc.source === "saved" ? (
                <button
                  type="button"
                  onClick={() => onSetShowLivePreview(true)}
                  className="font-bold text-emerald-900 hover:underline cursor-pointer"
                >
                  Показать актуальный →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetShowLivePreview(false)}
                  className="font-bold text-stone-600 hover:underline cursor-pointer"
                >
                  К версии №{getPlanCalculation(calculations)?.version ?? calculations[0]?.version}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
