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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#141418] shadow-2xl overflow-hidden text-zinc-100 animate-in zoom-in-95 duration-150">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
              VERSION CONTROL
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
              <span>🕘 Версии расчёта</span>
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-zinc-300">
                {calculations.length}
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Неизменяемые снимки расчёта с исходными ценами и составом
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Содержимое со скроллом */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3">
          {calculations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-[#121215]/50 p-8 text-center text-xs text-zinc-500">
              <span className="text-3xl block mb-2">📜</span>
              <h4 className="font-semibold text-white">Нет зафиксированных версий</h4>
              <p className="mt-1 text-zinc-500 max-w-sm mx-auto">
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
                  className="mt-4 rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
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
                  className={`rounded-3xl border p-4 transition-all shadow-lg ${
                    calc.is_contract_baseline
                      ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                      : "border-white/[0.07] bg-[#121215]"
                  }`}
                >
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-white">
                          Версия №{calc.version}
                        </span>
                        {calc.is_contract_baseline && (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                            ★ Договорная
                          </span>
                        )}
                        <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                          {calc.mode === "check_contract" ? "Договор" : "Смета"}
                        </span>
                        <span className="text-xs text-zinc-500">{formattedDate}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!calc.is_contract_baseline && !locked && (
                          <button
                            type="button"
                            onClick={() => onSetBaseline(calc.id)}
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer transition-colors"
                          >
                            Сделать договорной
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedVersionId(isExpanded ? null : calc.id)}
                          className="rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer transition-colors"
                        >
                          {isExpanded ? "Свернуть" : "Состав"}
                        </button>
                      </div>
                    </div>

                    {corruptionField ? (
                      <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                        ⚠️ <strong>Снимок повреждён:</strong> отсутствует обязательное поле «{corruptionField}».
                      </div>
                    ) : normalized ? (
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-950/60 p-3 text-xs border border-zinc-850">
                        <div>
                          <span className="text-[11px] text-zinc-500 block">Цена</span>
                          <span className="font-semibold text-white font-mono">
                            {formatKzt(normalized.priceTotal)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-zinc-500 block">Себестоимость</span>
                          <span className="font-medium text-zinc-400 font-mono">
                            {formatKzt(normalized.costTotal)} ₸
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-zinc-500 block">Маржа</span>
                          <span className="font-semibold text-emerald-400 font-mono">
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
                    <div className="mt-3 border-t border-white/[0.06] pt-3 text-xs animate-in fade-in duration-200">
                      <div className="mb-3">
                        <span className="font-bold text-zinc-400 uppercase tracking-wide text-[10px] block mb-1">
                          Параметры на момент фиксации:
                        </span>
                        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-300">
                          <span className="rounded-full bg-zinc-950 px-2.5 py-1 border border-zinc-800">
                            Целевая маржа: {formatPercent(normalized.parameters.targetMarginPct)}
                          </span>
                          <span className="rounded-full bg-zinc-950 px-2.5 py-1 border border-zinc-800">
                            Сборка: {normalized.parameters.assemblyMode === "percent" ? formatPercent(normalized.parameters.assemblyPct) : "за пог. м"}
                          </span>
                          <span className="rounded-full bg-zinc-950 px-2.5 py-1 border border-zinc-800">
                            Технолог: {normalized.parameters.technologMode === "percent" ? formatPercent(normalized.parameters.technologPct) : `${formatKzt(normalized.parameters.technologPerSheet)} ₸/лист`}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <span className="font-bold text-zinc-400 uppercase tracking-wide text-[10px] block mb-1">
                          Затраты по категориям:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                          {ALL_CATEGORIES.map((cat) => {
                            const total =
                              (normalized?.result.categoryTotals as Record<string, number> | undefined)?.[cat] ?? 0;
                            if (total === 0) return null;
                            return (
                              <div key={cat} className="flex justify-between rounded-xl bg-zinc-950 p-2 border border-zinc-800">
                                <span className="text-zinc-500">{CATEGORY_LABELS[cat]}:</span>
                                <span className="font-mono text-white">{formatKzt(total)} ₸</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-zinc-400 uppercase tracking-wide text-[10px] block mb-1">
                          Позиции ({normalized.input.lines.length}):
                        </span>
                        <div className="max-h-48 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-[#121215] border-b border-zinc-800 text-zinc-500">
                              <tr>
                                <th className="p-2.5">Наименование</th>
                                <th className="p-2.5 text-right">Кол-во</th>
                                <th className="p-2.5 text-right">Цена</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900">
                              {normalized.input.lines.map((l: NormalizedCalculationInputLine, idx: number) => (
                                <tr key={l.id || idx}>
                                  <td className="p-2.5 font-medium text-zinc-200">{l.name}</td>
                                  <td className="p-2.5 text-right text-zinc-400 font-mono">
                                    {l.qty} {l.unit}
                                  </td>
                                  <td className="p-2.5 text-right font-semibold text-white font-mono">
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
        <div className="border-t border-white/[0.06] px-6 py-3 bg-[#121215] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
