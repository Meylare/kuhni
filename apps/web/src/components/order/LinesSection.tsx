import { CopyIcon, EditIcon, TrashIcon } from "../icons";
import { formatKzt } from "../../lib/money";
import { getOrderLineCalculation } from "../../lib/orders";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type OrderLine,
  type PriceItem,
} from "../../types/database";

export interface LinesSectionProps {
  lines: OrderLine[];
  categoryTotals?: Record<string, number> | null;
  lineCalculationsById: Map<string, { billableQty: number; total: number }>;
  priceItemsById: Map<string, PriceItem>;
  locked: boolean;
  networkError: string | null;
  onOpenPricePicker: () => void;
  onOpenAddManualLine: () => void;
  onOpenEditLine: (line: OrderLine) => void;
  onDuplicateLine?: (line: OrderLine) => void;
  onDeleteLine: (id: string) => void;
  onStepLineQty?: (lineId: string, delta: number) => void;
  onOpenApplyTemplate?: () => void;
}

export function LinesSection({
  lines,
  categoryTotals,
  lineCalculationsById,
  priceItemsById,
  locked,
  networkError,
  onOpenPricePicker,
  onOpenAddManualLine,
  onOpenEditLine,
  onDuplicateLine,
  onDeleteLine,
  onStepLineQty,
  onOpenApplyTemplate,
}: LinesSectionProps) {
  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            Позиции и затраты ({lines.length})
          </h2>
          <p className="text-xs text-stone-500">
            Материалы, фасады, цех, фурнитура, транспорт и монтаж
          </p>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenPricePicker}
              className="flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
            >
              <span>+</span>
              <span>Из справочника</span>
            </button>
            {onOpenApplyTemplate && (
              <button
                type="button"
                disabled={Boolean(networkError)}
                onClick={onOpenApplyTemplate}
                className="flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Добавить типовой набор позиций из шаблона"
              >
                <span>➕</span>
                <span>Из шаблона</span>
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenAddManualLine}
              className="flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
            >
              <span>+</span>
              <span>Ручная позиция</span>
            </button>
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
          Позиций пока нет. Добавьте материалы и услуги из прайс-листа или создайте ручную позицию (например, доставку).
        </div>
      ) : (
        <div className="mt-4 flex flex-col divide-y divide-stone-100">
          {ALL_CATEGORIES.map((cat) => {
            const catLines = lines.filter((l) => l.category === cat);
            if (catLines.length === 0) return null;

            const catTotal = categoryTotals ? ((categoryTotals as Record<string, number>)[cat] ?? 0) : 0;

            return (
              <div key={cat} className="py-3 first:pt-0 last:pb-0">
                {/* Заголовок категории */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {CATEGORY_LABELS[cat]} ({catLines.length})
                  </span>
                  <span className="text-xs font-bold text-stone-900">
                    {formatKzt(catTotal)} ₸
                  </span>
                </div>

                {/* Список строк категории */}
                <div className="mt-1 flex flex-col gap-1.5">
                  {catLines.map((line) => {
                    const lineCalc =
                      lineCalculationsById.get(line.id) ?? getOrderLineCalculation(line);
                    const billableQty = lineCalc.billableQty;
                    const lineTotal = lineCalc.total;

                    // Проверка изменения цены в каталоге
                    const currentCatItem = line.price_item_id
                      ? priceItemsById.get(line.price_item_id)
                      : null;
                    const hasPriceChange =
                      currentCatItem && currentCatItem.price !== Number(line.unit_price);

                    return (
                      <div
                        key={line.id}
                        className="group flex flex-col justify-between rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 text-xs transition-colors hover:bg-stone-100/60 sm:flex-row sm:items-center"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-stone-900 text-sm">
                              {line.name}
                            </span>
                            {line.is_manual && (
                              <span className="rounded-md bg-stone-200/80 px-2 py-0.5 text-xs font-medium text-stone-600">
                                ручная
                              </span>
                            )}
                            {line.counts_for_technolog && (
                              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                технолог
                              </span>
                            )}
                            {line.waste_pct > 0 && (
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                +{(Number(line.waste_pct) * 100).toFixed(0)}% отход
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                            {!locked && onStepLineQty ? (
                              <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => onStepLineQty(line.id, -1)}
                                  className="flex min-h-8 min-w-8 items-center justify-center rounded-md bg-stone-100 text-sm font-bold text-stone-800 hover:bg-stone-200 active:scale-95"
                                  title="Уменьшить"
                                >
                                  −
                                </button>
                                <span className="font-bold text-stone-900 px-1.5 text-sm">
                                  {line.qty} {line.unit}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onStepLineQty(line.id, 1)}
                                  className="flex min-h-8 min-w-8 items-center justify-center rounded-md bg-emerald-900 text-sm font-bold text-white hover:bg-emerald-950 active:scale-95"
                                  title="Увеличить"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="font-semibold">
                                {line.qty} {line.unit}
                              </span>
                            )}
                            <span>× {formatKzt(line.unit_price)} ₸</span>
                            {line.billable_qty_rounding === "ceil_to_unit" && (
                              <span>(округление: {billableQty} {line.unit})</span>
                            )}
                            {line.comment && (
                              <span className="italic text-stone-400 truncate max-w-[200px]">
                                «{line.comment}»
                              </span>
                            )}
                          </div>

                          {hasPriceChange && (
                            <div className="mt-1 text-xs font-semibold text-amber-700">
                              ⚠️ В прайсе сейчас {formatKzt(currentCatItem.price)} ₸
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-200/40 pt-1.5 sm:mt-0 sm:border-0 sm:pt-0">
                          <span className="font-bold text-stone-900 text-sm sm:text-base">
                            {formatKzt(lineTotal)} ₸
                          </span>

                          {!locked && (
                            <div className="flex items-center gap-1">
                              {onDuplicateLine && (
                                <button
                                  type="button"
                                  onClick={() => onDuplicateLine(line)}
                                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                                  title="Дублировать позицию"
                                >
                                  <CopyIcon />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenEditLine(line)}
                                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                                title="Редактировать"
                              >
                                <EditIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteLine(line.id)}
                                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-rose-500 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                                title="Удалить"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
