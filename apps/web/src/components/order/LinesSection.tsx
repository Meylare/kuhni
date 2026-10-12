import { useState } from "react";
import { CopyIcon, EditIcon, TrashIcon } from "../icons";
import { formatKzt } from "../../lib/money";
import { getOrderLineCalculation } from "../../lib/orders";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type OrderLine,
  type PriceCategory,
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<PriceCategory>>(
    new Set()
  );

  const toggleCategory = (cat: PriceCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedCategories(new Set(ALL_CATEGORIES));
  };

  const expandAll = () => {
    setCollapsedCategories(new Set());
  };

  const presentCategories = ALL_CATEGORIES.filter((cat) =>
    lines.some((l) => l.category === cat)
  );

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-stone-900">
              Позиции и затраты ({lines.length})
            </h2>
            {lines.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-md px-1.5 py-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Свернуть все
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-md px-1.5 py-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Развернуть все
                </button>
              </div>
            )}
          </div>
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

      {/* Горизонтальная лента чипсов-подытогов категорий */}
      {presentCategories.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {presentCategories.map((cat) => {
            const count = lines.filter((l) => l.category === cat).length;
            const total = categoryTotals
              ? ((categoryTotals as Record<string, number>)[cat] ?? 0)
              : 0;
            const isCollapsed = collapsedCategories.has(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  if (isCollapsed) {
                    setCollapsedCategories((prev) => {
                      const next = new Set(prev);
                      next.delete(cat);
                      return next;
                    });
                  }
                  const el = document.getElementById(`category-group-${cat}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                  isCollapsed
                    ? "border-stone-200 bg-stone-100/70 text-stone-600 hover:bg-stone-200/70"
                    : "border-stone-300 bg-white text-stone-900 shadow-2xs hover:border-emerald-700"
                }`}
              >
                <span className="font-semibold">{CATEGORY_LABELS[cat]}</span>
                <span className="rounded-md bg-stone-100 px-1 py-0.2 text-[10px] text-stone-600">
                  {count}
                </span>
                <span className="font-bold text-stone-900">
                  {formatKzt(total)} ₸
                </span>
              </button>
            );
          })}
        </div>
      )}

      {lines.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
          Позиций пока нет. Добавьте материалы и услуги из прайс-листа или создайте ручную позицию (например, доставку).
        </div>
      ) : (
        <div className="mt-4 flex flex-col divide-y divide-stone-100">
          {presentCategories.map((cat) => {
            const catLines = lines.filter((l) => l.category === cat);
            const catTotal = categoryTotals
              ? ((categoryTotals as Record<string, number>)[cat] ?? 0)
              : 0;
            const isCollapsed = collapsedCategories.has(cat);

            return (
              <div
                key={cat}
                id={`category-group-${cat}`}
                className="py-3 first:pt-1 last:pb-1 scroll-mt-20"
              >
                {/* Заголовок-аккордеон категории */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-stone-50 active:bg-stone-100 cursor-pointer"
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-xs font-bold w-3 text-center">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                      {catLines.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900">
                      {formatKzt(catTotal)} ₸
                    </span>
                    <span className="text-[11px] text-stone-400 hidden sm:inline">
                      {isCollapsed ? "Развернуть" : "Свернуть"}
                    </span>
                  </div>
                </button>

                {/* Список строк категории при развёрнутом состоянии */}
                {!isCollapsed && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
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
                          className="group flex flex-col justify-between rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs shadow-2xs transition-colors hover:border-stone-300 sm:flex-row sm:items-center gap-2"
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-stone-900 text-sm">
                                {line.name}
                              </span>
                              {line.is_manual && (
                                <span className="rounded-md bg-stone-200/80 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                                  ручная
                                </span>
                              )}
                              {line.counts_for_technolog && (
                                <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                                  технолог
                                </span>
                              )}
                              {line.waste_pct > 0 && (
                                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                                  +{(Number(line.waste_pct) * 100).toFixed(0)}% отход
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                              {!locked && onStepLineQty ? (
                                <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => onStepLineQty(line.id, -1)}
                                    className="flex min-h-8 min-w-8 items-center justify-center rounded-md bg-stone-100 text-sm font-bold text-stone-800 hover:bg-stone-200 active:scale-95 cursor-pointer"
                                    title="Уменьшить"
                                  >
                                    −
                                  </button>
                                  <span className="font-bold text-stone-900 px-1.5 text-xs">
                                    {line.qty} {line.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onStepLineQty(line.id, 1)}
                                    className="flex min-h-8 min-w-8 items-center justify-center rounded-md bg-emerald-900 text-sm font-bold text-white hover:bg-emerald-950 active:scale-95 cursor-pointer"
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
                                <span className="text-stone-500">(округление: {billableQty} {line.unit})</span>
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

                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-stone-100 pt-1.5 sm:border-0 sm:pt-0">
                            <span className="font-bold text-stone-900 text-sm sm:text-base">
                              {formatKzt(lineTotal)} ₸
                            </span>

                            {!locked && (
                              <div className="flex items-center gap-0.5">
                                {onDuplicateLine && (
                                  <button
                                    type="button"
                                    onClick={() => onDuplicateLine(line)}
                                    className="flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                                    title="Дублировать позицию"
                                  >
                                    <CopyIcon />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenEditLine(line)}
                                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                                  title="Редактировать"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteLine(line.id)}
                                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-rose-500 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
