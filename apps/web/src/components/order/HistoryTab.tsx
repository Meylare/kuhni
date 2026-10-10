import { type CalculationOutcome } from "@kuhni/calc";
import { formatKzt } from "../../lib/money";
import {
  normalizeOrderCalculation,
  SnapshotCorruptedError,
  type NormalizedCalculationInputLine,
} from "../../lib/orders";
import { formatPercent } from "../../lib/parameters";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type OrderCalculation,
} from "../../types/database";

interface HistoryTabProps {
  calculations: OrderCalculation[];
  locked: boolean;
  calcSaving: boolean;
  networkError: string | null;
  calcSaveSuccess: string | null;
  calcOutcome: CalculationOutcome | null;
  expandedVersionId: string | null;
  setExpandedVersionId: (id: string | null | ((prev: string | null) => string | null)) => void;
  onSaveCalculation: () => void;
  onSetBaseline: (calcId: string) => void;
}

export function HistoryTab({
  calculations,
  locked,
  calcSaving,
  networkError,
  calcSaveSuccess,
  calcOutcome,
  expandedVersionId,
  setExpandedVersionId,
  onSaveCalculation,
  onSetBaseline,
}: HistoryTabProps) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900">История расчётов</h2>
          <p className="text-xs text-stone-500">
            Зафиксированные неизменяемые версии расчёта с исходными параметрами и снимками
          </p>
        </div>
        {!locked && calcOutcome && calcOutcome.ok && (
          <button
            type="button"
            disabled={calcSaving || Boolean(networkError)}
            onClick={onSaveCalculation}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            title={networkError ? "Сохранение заблокировано из-за сетевой ошибки" : undefined}
          >
            <span>💾</span>
            <span>{calcSaving ? "Сохранение…" : "Сохранить текущий расчёт"}</span>
          </button>
        )}
      </div>

      {calcSaveSuccess && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
          ✓ {calcSaveSuccess}
        </div>
      )}

      {calculations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-10 text-center text-sm text-stone-600">
          <span className="text-3xl">📜</span>
          <h3 className="mt-2 font-bold text-stone-800">Нет сохранённых расчётов</h3>
          <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
            В этом заказе пока нет зафиксированных версий. Нажмите «Сохранить расчёт», чтобы зафиксировать версию 1.
          </p>
          {!locked && calcOutcome && calcOutcome.ok && (
            <button
              type="button"
              disabled={calcSaving || Boolean(networkError)}
              onClick={onSaveCalculation}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed"
              title={networkError ? "Сохранение заблокировано из-за сетевой ошибки" : undefined}
            >
              <span>💾 Сохранить версию 1</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {calculations.map((calc) => {
            const isExpanded = expandedVersionId === calc.id;
            const formattedDate = new Date(calc.created_at).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            let normalized: ReturnType<typeof normalizeOrderCalculation> | null = null;
            let corruptionField: string | null = null;
            try {
              normalized = normalizeOrderCalculation(calc);
            } catch (err: unknown) {
              if (err instanceof SnapshotCorruptedError) {
                corruptionField = err.missingField;
              } else {
                corruptionField = "данные";
              }
            }

            if (corruptionField || !normalized) {
              return (
                <div
                  key={calc.id}
                  className="overflow-hidden rounded-2xl border border-rose-300 bg-rose-50/60 p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-rose-900">
                        Версия #{calc.version}: данные повреждены (поле {corruptionField})
                      </span>
                      <span className="text-xs text-rose-600">{formattedDate}</span>
                    </div>
                    <span className="rounded-md bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                      Недоступна для отображения
                    </span>
                  </div>
                </div>
              );
            }

            const paramsSnap = normalized.parameters;
            const resSnap = normalized.result;
            const inputLines = normalized.input.lines;
            const catTotals = resSnap.categoryTotals;
            const warnings = resSnap.warnings;

            return (
              <div
                key={calc.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Заголовок версии */}
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 bg-stone-50/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-stone-900">
                      Версия #{calc.version}
                    </span>
                    <span className="text-xs text-stone-500">{formattedDate}</span>
                    <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                      {calc.mode === "quote" ? "Рассчитать цену" : "Проверить договор"}
                    </span>
                    {calc.is_contract_baseline && (
                      <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        ⭐ Подписанный договор
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {!calc.is_contract_baseline && (
                      <button
                        type="button"
                        onClick={() => void onSetBaseline(calc.id)}
                        className="min-h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                        title="Сделать этот расчёт базовым для договора"
                      >
                        Сделать договорным
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedVersionId(isExpanded ? null : calc.id)}
                      className="min-h-8 rounded-lg bg-stone-100 px-3 text-[11px] font-semibold text-stone-700 hover:bg-stone-200"
                    >
                      {isExpanded ? "Свернуть ▲" : "Подробнее ▼"}
                    </button>
                  </div>
                </div>

                {/* Ключевые показатели */}
                <div className="grid grid-cols-3 divide-x divide-stone-100 p-4 text-center">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-stone-400">
                      Итоговая цена
                    </span>
                    <span className="mt-0.5 block text-base font-extrabold text-stone-900 sm:text-lg">
                      {formatKzt(calc.price_total)} ₸
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-stone-400">
                      Себестоимость
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-stone-700 sm:text-base">
                      {formatKzt(calc.cost_total)} ₸
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-stone-400">
                      Маржа
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-baseline justify-center gap-1">
                      <span className="text-sm font-bold text-emerald-900 sm:text-base">
                        {formatKzt(calc.price_total - calc.cost_total)} ₸
                      </span>
                      {calc.margin_pct !== null && (
                        <span className="text-xs font-semibold text-emerald-700">
                          ({formatPercent(calc.margin_pct)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Раскрывающийся подробный снимок */}
                {isExpanded && (
                  <div className="border-t border-stone-100 bg-stone-50/40 p-4 text-xs flex flex-col gap-4">
                    {warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                        ⚠️ {warnings.join("; ")}
                      </div>
                    )}

                    {/* Параметры */}
                    <div>
                      <h4 className="font-bold text-stone-800 mb-1.5">
                        ⚙️ Параметры на момент фиксации:
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] text-stone-700">
                        <div>
                          <span className="text-stone-400 block">Целевая маржа:</span>
                          <span className="font-semibold">
                            {typeof paramsSnap.targetMarginPct === "number"
                              ? formatPercent(paramsSnap.targetMarginPct)
                              : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Сборка:</span>
                          <span className="font-semibold">
                            {paramsSnap.assemblyMode === "per_meter"
                              ? "за пог. метр"
                              : typeof paramsSnap.assemblyPct === "number"
                              ? formatPercent(paramsSnap.assemblyPct)
                              : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Технолог:</span>
                          <span className="font-semibold">
                            {paramsSnap.technologMode === "per_sheet"
                              ? "за лист"
                              : typeof paramsSnap.technologPct === "number"
                              ? formatPercent(paramsSnap.technologPct)
                              : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Резерв на риск:</span>
                          <span className="font-semibold">
                            {typeof paramsSnap.riskReservePct === "number"
                              ? formatPercent(paramsSnap.riskReservePct)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Разделение затрат по статьям */}
                    <div>
                      <h4 className="font-bold text-stone-800 mb-1.5">
                        📊 Затраты по категориям:
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-stone-200 bg-white p-3 text-[11px]">
                        {ALL_CATEGORIES.map((cat) => (
                          <div key={cat}>
                            <span className="text-stone-400 block">{CATEGORY_LABELS[cat]}:</span>
                            <span className="font-semibold text-stone-800">
                              {formatKzt((catTotals as Record<string, number>)[cat] || 0)} ₸
                            </span>
                          </div>
                        ))}
                        <div>
                          <span className="text-stone-400 block">Сборка:</span>
                          <span className="font-semibold text-stone-800">
                            {formatKzt(resSnap.assembly)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Технолог:</span>
                          <span className="font-semibold text-stone-800">
                            {formatKzt(resSnap.technolog)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Резерв на риск:</span>
                          <span className="font-semibold text-stone-800">
                            {formatKzt(resSnap.riskReserve)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Мин. цена для маржи:</span>
                          <span className="font-semibold text-stone-800">
                            {formatKzt(resSnap.minPriceForTargetMargin)} ₸
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Зафиксированные позиции */}
                    {inputLines.length > 0 && (
                      <div>
                        <h4 className="font-bold text-stone-800 mb-1.5">
                          📋 Позиции расчёта ({inputLines.length}):
                        </h4>
                        <div className="max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
                          {inputLines.map((l: NormalizedCalculationInputLine, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 text-[11px]">
                              <div>
                                <div className="font-semibold text-stone-900">
                                  {l.name}
                                </div>
                                <div className="text-stone-500">
                                  {l.qty} {l.unit} × {formatKzt(l.unitPrice)} ₸
                                  {l.wastePct > 0 && ` (+${(l.wastePct * 100).toFixed(0)}% отход)`}
                                </div>
                              </div>
                              <div className="font-bold text-stone-900">
                                {formatKzt(l.qty * l.unitPrice * (1 + (l.wastePct || 0)))} ₸
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
