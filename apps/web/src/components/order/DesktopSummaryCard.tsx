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
    <aside className="sticky top-20 hidden lg:flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#121215] p-5 shadow-2xl backdrop-blur-xl w-[360px] shrink-0 text-zinc-100">
      {/* Шапка пульта */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-medium text-white tracking-tight">
            Финансовый пульт
          </h3>
        </div>
        <span className="rounded-full bg-white/[0.05] border border-white/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
          {calcMode === "quote" ? "Смета • Quote" : "Договор • Contract"}
        </span>
      </div>

      {/* Ошибка расчёта */}
      {!displayCalc && calcOutcome && !calcOutcome.ok && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <strong>Ошибка расчёта:</strong> {formatCalculationOutcomeError(calcOutcome.error)}
        </div>
      )}

      {/* Предупреждения расчёта */}
      {displayCalc && displayCalc.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 font-medium">
          ⚠️ {displayCalc.warnings.join("; ")}
        </div>
      )}

      {displayCalc?.contractPriceMismatch && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200 font-semibold">
          ⚠️ Цена договора в заказе ({formatKzt(displayCalc.contractPriceMismatch.current)} ₸) отличается от сохранённой версии №{displayCalc.version} ({formatKzt(displayCalc.contractPriceMismatch.snapshot)} ₸).
        </div>
      )}

      {calcSaveSuccess && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-2.5 text-xs font-semibold text-emerald-300 animate-pulse">
          ✓ {calcSaveSuccess}
        </div>
      )}

      {displayCalc && (
        <>
          {/* Главная карточка с итоговой ценой и маржой */}
          <div className="rounded-2xl bg-zinc-950/80 p-4 text-white border border-white/[0.06] shadow-lg">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
              {calcMode === "quote" ? "Рекомендуемая стоимость" : "Согласованная цена"}
            </span>

            <div className="mt-1 text-3xl font-light tracking-tight text-white tabular-nums">
              {formatKzt(displayCalc.priceTotal)} ₸
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 block font-medium">Себестоимость</span>
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatKzt(displayCalc.costTotal)} ₸
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-medium">Чистая прибыль</span>
                <span className="font-semibold text-emerald-400 tabular-nums">
                  +{formatKzt(displayCalc.margin)} ₸
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2">
              <span className="text-[11px] text-zinc-400 font-medium">Маржинальность:</span>
              <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${marginStyle.badge}`}>
                {displayCalc.marginPct !== null ? formatMarginPercent(displayCalc.marginPct) : "—"}
              </span>
            </div>
          </div>

          {/* Детализация себестоимости */}
          <div className="rounded-2xl border border-white/[0.05] bg-zinc-900/40 p-3.5 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Структура затрат
            </span>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400">Материалы и работы:</span>
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatKzt(displayCalc.fixedCost)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400">Сборка и монтаж:</span>
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatKzt(displayCalc.assembly)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400">Услуги технолога:</span>
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatKzt(displayCalc.technolog)} ₸
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400">Резерв на риски:</span>
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatKzt(displayCalc.riskReserve)} ₸
                </span>
              </div>

              <div className="flex justify-between pt-1">
                <span className="text-zinc-400 font-medium">Мин. цена для целевой маржи:</span>
                <span className="font-semibold text-white tabular-nums">
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
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 transition-all disabled:opacity-40 cursor-pointer shadow-lg"
            >
              <span>💾</span>
              <span>{calcSaving ? "Сохранение…" : "Зафиксировать версию сметы"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenUnlockModal}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <span>🔒</span>
              <span>Открыть заказ для правок</span>
            </button>
          )}

          {/* Индикатор статуса синхронизации версии */}
          {syncStatus && (
            <div
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ${
                syncStatus.badgeColor === "warning"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-white/[0.05] text-zinc-400 border border-white/[0.05]"
              }`}
            >
              {syncStatus.badgeColor === "warning" && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
              )}
              <span>{syncStatus.label}</span>
            </div>
          )}

          {/* Переключатель живого превью */}
          {calculations.length > 0 && (
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/[0.06]">
              <span className="font-medium">
                {displayCalc.source === "saved"
                  ? `Показана версия №${displayCalc.version}`
                  : "⚡ Актуальный расчёт"}
              </span>

              {displayCalc.source === "saved" ? (
                <button
                  type="button"
                  onClick={() => onSetShowLivePreview(true)}
                  className="font-medium text-emerald-400 hover:underline cursor-pointer"
                >
                  Показать актуальный →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetShowLivePreview(false)}
                  className="font-medium text-zinc-400 hover:text-zinc-200 hover:underline cursor-pointer"
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
