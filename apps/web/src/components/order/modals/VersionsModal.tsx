import { useState } from "react";
import { formatKzt } from "../../../lib/money";
import {
  normalizeOrderCalculation,
  SnapshotCorruptedError,
  type NormalizedCalculationInputLine,
} from "../../../lib/orders";
import { formatPercent } from "../../../lib/parameters";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type OrderCalculation,
} from "../../../types/database";

export interface VersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculations: OrderCalculation[];
  locked: boolean;
  onSetBaseline: (calcId: string) => void;
  onSaveCalculation: () => void;
  calcSaving: boolean;
}

export function VersionsModal({
  isOpen,
  onClose,
  calculations,
  locked,
  onSetBaseline,
  onSaveCalculation,
  calcSaving,
}: VersionsModalProps) {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 bg-stone-50/80">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span>🕘 Версии расчёта</span>
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">
                {calculations.length}
              </span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Неизменяемые снимки расчёта с исходными ценами и составом
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 text-lg transition-colors"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Содержимое со скроллом */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
          {calculations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-sm text-stone-600">
              <span className="text-3xl block mb-2">📜</span>
              <h4 className="font-bold text-stone-800">Нет зафиксированных версий</h4>
              <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                В этом заказе пока нет версий. Нажмите кнопку «Зафиксировать версию», чтобы сохранить текущий расчёт.
              </p>
              {!locked && (
                <button
                  type="button"
                  disabled={calcSaving}
                  onClick={() => {
                    onSaveCalculation();
                    onClose();
                  }}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
                >
                  Зафиксировать версию 1
                </button>
              )}
            </div>
          ) : (
            calculations.map((calc) => {
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
              } catch (err) {
                if (err instanceof SnapshotCorruptedError) {
                  corruptionField = err.missingField;
                }
              }

              return (
                <div
                  key={calc.id}
                  className={`rounded-2xl border transition-all ${
                    calc.is_contract_baseline
                      ? "border-emerald-500 bg-emerald-50/20 shadow-xs"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-stone-900">
                          Версия №{calc.version}
                        </span>
                        {calc.is_contract_baseline && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 border border-emerald-300">
                            ★ Договорная
                          </span>
                        )}
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                          {calc.mode === "check_contract" ? "Договор" : "Смета"}
                        </span>
                        <span className="text-xs text-stone-400">{formattedDate}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!calc.is_contract_baseline && !locked && (
                          <button
                            type="button"
                            onClick={() => onSetBaseline(calc.id)}
                            className="min-h-10 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                          >
                            Сделать договорной
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedVersionId(isExpanded ? null : calc.id)}
                          className="min-h-10 min-w-10 rounded-xl border border-stone-200 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          {isExpanded ? "Свернуть" : "Состав"}
                        </button>
                      </div>
                    </div>

                    {corruptionField ? (
                      <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
                        ⚠️ <strong>Снимок повреждён:</strong> отсутствует обязательное поле «{corruptionField}».
                      </div>
                    ) : normalized ? (
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-xs">
                        <div>
                          <span className="text-[11px] text-stone-500 block">Цена</span>
                          <span className="font-bold text-stone-900">
                            {formatKzt(normalized.priceTotal)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-stone-500 block">Себестоимость</span>
                          <span className="font-semibold text-stone-700">
                            {formatKzt(normalized.costTotal)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-stone-500 block">Маржа</span>
                          <span className="font-bold text-stone-900">
                            {normalized.marginPct !== null
                              ? formatPercent(normalized.marginPct)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Раскрытый состав версии */}
                  {isExpanded && normalized && (
                    <div className="border-t border-stone-200 bg-stone-50/50 p-4 text-xs">
                      <div className="mb-3">
                        <span className="font-bold text-stone-800 uppercase tracking-wide text-[10px] block mb-1">
                          Параметры на момент фиксации:
                        </span>
                        <div className="flex flex-wrap gap-2 text-[11px] text-stone-600">
                          <span className="rounded bg-white px-2 py-0.5 border border-stone-200">
                            Целевая маржа: {formatPercent(normalized.parameters.targetMarginPct)}
                          </span>
                          <span className="rounded bg-white px-2 py-0.5 border border-stone-200">
                            Сборка: {normalized.parameters.assemblyMode === "percent" ? formatPercent(normalized.parameters.assemblyPct) : "за пог. м"}
                          </span>
                          <span className="rounded bg-white px-2 py-0.5 border border-stone-200">
                            Технолог: {normalized.parameters.technologMode === "percent" ? formatPercent(normalized.parameters.technologPct) : `${formatKzt(normalized.parameters.technologPerSheet)} ₸/лист`}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <span className="font-bold text-stone-800 uppercase tracking-wide text-[10px] block mb-1">
                          Затраты по категориям:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                          {ALL_CATEGORIES.map((cat) => {
                            const total =
                              (normalized?.result.categoryTotals as Record<string, number> | undefined)?.[cat] ?? 0;
                            if (total === 0) return null;
                            return (
                              <div key={cat} className="flex justify-between rounded bg-white p-1.5 border border-stone-200">
                                <span className="text-stone-500">{CATEGORY_LABELS[cat]}:</span>
                                <span className="font-semibold text-stone-800">{formatKzt(total)} ₸</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-stone-800 uppercase tracking-wide text-[10px] block mb-1">
                          Позиции ({normalized.input.lines.length}):
                        </span>
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                              <tr>
                                <th className="p-2">Наименование</th>
                                <th className="p-2 text-right">Кол-во</th>
                                <th className="p-2 text-right">Цена</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {normalized.input.lines.map((l: NormalizedCalculationInputLine, idx: number) => (
                                <tr key={l.id || idx}>
                                  <td className="p-2 font-medium text-stone-800">{l.name}</td>
                                  <td className="p-2 text-right text-stone-600">
                                    {l.qty} {l.unit}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-stone-900">
                                    {formatKzt(l.unitPrice)} ₸
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Подвал */}
        <div className="border-t border-stone-200 px-5 py-3 bg-stone-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-stone-300 bg-white px-5 text-xs font-semibold text-stone-700 hover:bg-stone-50 active:scale-98"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
