import { useState } from "react";
import { getMarginColor } from "../../lib/margin-colors";
import { formatKzt } from "../../lib/money";
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
      ? String(order.contract_price)
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
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-6 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Этап «Договор»</h2>
          <p className="text-xs text-stone-500">
            Сверка согласованной цены договора с расчётной себестоимостью и целевой маржой
          </p>
        </div>
        {displayCalc?.isContractBaseline && (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 border border-emerald-300">
            ✓ Опорная версия договора утверждена
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Поле ввода цены договора */}
        <div className="flex flex-col gap-2 rounded-xl bg-stone-50 p-4 border border-stone-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Цена по договору (KZT)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              disabled={locked || isSavingPrice}
              value={editingPrice}
              onChange={(e) => setEditingPrice(e.target.value)}
              placeholder="Например: 850 000"
              className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-3.5 text-base font-bold text-stone-900 shadow-2xs focus:border-emerald-800"
            />
            {!locked && (
              <button
                type="button"
                disabled={isSavingPrice || locked}
                onClick={() => void handleSavePrice()}
                className="min-h-12 rounded-xl bg-stone-800 px-4 text-xs font-bold text-white hover:bg-stone-900 active:scale-98 disabled:opacity-50"
              >
                {isSavingPrice ? "…" : "Сохранить"}
              </button>
            )}
          </div>

          {hasZeroWarning && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium">
              ⚠️ Сумма сильно отличается от расчёта ({formatKzt(Math.round(estimatedPrice))} ₸). Проверьте количество нулей.
            </p>
          )}

          {contractPriceNum === null && (
            <p className="text-xs text-stone-500">
              Укажите согласованную с заказчиком цену договора для оценки фактической маржи.
            </p>
          )}
        </div>

        {/* Карточка вывода маржи и сравнения */}
        <div className="flex flex-col justify-between rounded-xl bg-stone-50 p-4 border border-stone-200/80">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1">
              Оценка прибыльности
            </span>
            {contractPriceNum !== null && displayCalc ? (
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-stone-600">Договор:</span>
                  <span className="text-base font-black text-stone-900">
                    {formatKzt(contractPriceNum)} ₸
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-stone-600">Маржа:</span>
                  <span className={`text-base font-black ${marginStyle.text}`}>
                    {marginPct !== null ? formatPercent(marginPct) : "—"}{" "}
                    {marginPct !== null && (
                      <span className="text-xs font-semibold">
                        {marginPct >= targetMarginPct
                          ? `(выше цели ${formatPercent(targetMarginPct)})`
                          : `(ниже цели ${formatPercent(targetMarginPct)})`}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-stone-200/60 pt-1 text-xs text-stone-600">
                  <span>Минимальная цена при {formatPercent(targetMarginPct)}:</span>
                  <span className="font-bold text-stone-800">
                    {formatKzt(displayCalc.minPriceForTargetMargin)} ₸
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500 py-3">
                Введите цену договора слева, чтобы рассчитать процент маржи и сопоставить с минимальной ценой.
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-200/60 pt-3">
            {!locked && (
              <>
                <button
                  type="button"
                  disabled={calcSaving}
                  onClick={onSaveCalculation}
                  className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-950 active:scale-98 disabled:opacity-50"
                >
                  {calcSaving ? "Сохранение…" : "Зафиксировать версию"}
                </button>
                <button
                  type="button"
                  onClick={onSetBaseline}
                  disabled={!displayCalc}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-50 px-4 text-xs font-bold text-emerald-900 hover:bg-emerald-100 active:scale-98 disabled:opacity-50"
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
