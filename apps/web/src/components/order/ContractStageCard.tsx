import { useState } from "react";
import { getMarginColor } from "../../lib/margin-colors";
import { formatKzt } from "../../lib/money";
import { formatCurrencyInput } from "../../lib/number-inputs";
import type { OrderDisplayCalculation } from "../../lib/orders";
import { formatPercent } from "../../lib/parameters";
import type { Order } from "../../types/database";

export interface ContractStageCardProps {
  order: Order;
  displayCalc: OrderDisplayCalculation | null;
  targetMarginPct?: number;
  locked: boolean;
  calcSaving: boolean;
  onSaveCalculation: () => void;
  onSetBaseline: () => void;
  onUpdateContractPrice: (price: number | null) => Promise<void>;
}

export function ContractStageCard({
  order,
  displayCalc,
  targetMarginPct = 0.18,
  locked,
  calcSaving,
  onSaveCalculation,
  onSetBaseline,
  onUpdateContractPrice,
}: ContractStageCardProps) {
  const [editingPrice, setEditingPrice] = useState(
    order.contract_price !== null && order.contract_price !== undefined
      ? formatCurrencyInput(String(order.contract_price))
      : ""
  );
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  const contractPriceNum = order.contract_price ? Number(order.contract_price) : null;
  const marginPct = displayCalc?.marginPct ?? null;
  const marginStyle = getMarginColor(marginPct, targetMarginPct);

  // Мягкое предупреждение о нулях (U7), если введённая цена отличается от сметы более чем в 3 раза
  const estimatedPrice = displayCalc?.minPriceForTargetMargin ?? displayCalc?.costTotal ?? 0;
  const parsedInputPrice = Number(editingPrice.replace(/\s+/g, "").replace(",", "."));
  const hasZeroWarning =
    estimatedPrice > 0 &&
    parsedInputPrice > 0 &&
    (parsedInputPrice > estimatedPrice * 3 || parsedInputPrice < estimatedPrice / 3);

  async function handleSavePrice() {
    const raw = editingPrice.trim().replace(/\s+/g, "").replace(",", ".");
    const val = raw === "" ? null : Math.round(Number(raw));
    if (val !== null && (!Number.isFinite(val) || val < 0)) return;
    setIsSavingPrice(true);
    try {
      await onUpdateContractPrice(val);
    } finally {
      setIsSavingPrice(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-2xl backdrop-blur-xl md:p-6 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="text-base font-medium tracking-tight text-white">Этап «Договор»</h2>
          <p className="text-xs text-zinc-400">
            Сверка согласованной цены договора с расчётной себестоимостью и целевой маржой
          </p>
        </div>
        {displayCalc?.isContractBaseline && (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/30">
            ✓ Опорная версия договора утверждена
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Поле ввода цены договора */}
        <div className="flex flex-col gap-2.5 rounded-2xl bg-zinc-900/60 p-4 border border-white/[0.05]">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Цена по договору (KZT)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              disabled={locked || isSavingPrice}
              value={editingPrice}
              onChange={(e) => setEditingPrice(formatCurrencyInput(e.target.value))}
              placeholder="Например: 850 000"
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3.5 text-base font-semibold text-white shadow-inner focus:border-emerald-500/50 outline-none transition-colors"
            />
            {!locked && (
              <button
                type="button"
                disabled={isSavingPrice || locked}
                onClick={() => void handleSavePrice()}
                className="min-h-12 rounded-xl bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 disabled:opacity-40 transition-all cursor-pointer"
              >
                {isSavingPrice ? "…" : "Сохранить"}
              </button>
            )}
          </div>

          {hasZeroWarning && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 font-medium">
              ⚠️ Сумма сильно отличается от расчёта ({formatKzt(Math.round(estimatedPrice))} ₸). Проверьте количество нулей.
            </p>
          )}

          {contractPriceNum === null && (
            <p className="text-xs text-zinc-500">
              Укажите согласованную с заказчиком цену договора для оценки фактической маржи.
            </p>
          )}
        </div>

        {/* Карточка вывода маржи и сравнения */}
        <div className="flex flex-col justify-between rounded-2xl bg-zinc-900/60 p-4 border border-white/[0.05]">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Оценка прибыльности
            </span>
            {contractPriceNum !== null && displayCalc ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-zinc-400 text-xs">Договор:</span>
                  <span className="text-lg font-semibold tracking-tight text-white tabular-nums">
                    {formatKzt(contractPriceNum)} ₸
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-zinc-400 text-xs">Маржа:</span>
                  <span className={`text-base font-semibold tabular-nums ${marginStyle.text}`}>
                    {marginPct !== null ? formatPercent(marginPct) : "—"}{" "}
                    {marginPct !== null && (
                      <span className="text-xs font-normal text-zinc-400">
                        {marginPct >= targetMarginPct
                          ? `(выше цели ${formatPercent(targetMarginPct)})`
                          : `(ниже цели ${formatPercent(targetMarginPct)})`}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-2 text-xs text-zinc-400">
                  <span>Мин. цена при {formatPercent(targetMarginPct)}:</span>
                  <span className="font-semibold text-zinc-200 tabular-nums">
                    {formatKzt(displayCalc.minPriceForTargetMargin)} ₸
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 py-3">
                Введите цену договора слева, чтобы рассчитать процент маржи и сопоставить с минимальной ценой.
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
            {!locked && (
              <>
                <button
                  type="button"
                  disabled={calcSaving}
                  onClick={onSaveCalculation}
                  className="flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {calcSaving ? "Сохранение…" : "Зафиксировать версию"}
                </button>
                <button
                  type="button"
                  onClick={onSetBaseline}
                  disabled={!displayCalc}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 active:scale-98 disabled:opacity-40 transition-all cursor-pointer"
                >
                  ★ Сделать договорной
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
