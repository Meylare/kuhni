import { useMemo, useState } from "react";
import { CopyIcon, EditIcon, TrashIcon } from "../icons";
import { formatKzt } from "../../lib/money";
import { getOrderLineCalculation } from "../../lib/orders";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type OrderItem,
  type OrderLine,
  type PriceCategory,
  type PriceItem,
} from "../../types/database";

export const CATEGORY_ICONS: Record<PriceCategory, string> = {
  materials: "🪵",
  facades: "🎨",
  hardware: "🔩",
  workshop: "🛠️",
  transport: "🚚",
  labor: "👷",
  assembly: "🔧",
  technolog: "📐",
  other: "📦",
};

export interface LinesSectionProps {
  lines: OrderLine[];
  items?: OrderItem[];
  priceItems?: PriceItem[];
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
  onStepPriceItem?: (item: PriceItem, delta: number, targetItemId?: string | null) => void;
  onOpenApplyTemplate?: () => void;
}

export function LinesSection({
  lines,
  items = [],
  priceItems = [],
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
  onStepPriceItem,
  onOpenApplyTemplate,
}: LinesSectionProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<PriceCategory>>(
    new Set()
  );

  // Инлайн-поиск по каталогу
  const [quickSearch, setQuickSearch] = useState("");
  const [selectedQuickTargetItem, setSelectedQuickTargetItem] = useState<string>("");

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

  // Сопоставление id изделия с его названием
  const itemsMap = useMemo(() => {
    return new Map(items.map((i) => [i.id, i]));
  }, [items]);

  // Фильтрация быстрого поиска
  const quickSearchResults = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.trim().toLowerCase();
    return priceItems
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [priceItems, quickSearch]);

  // Общая сумма прямых затрат по строкам для подсчета %
  const totalDirectCosts = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      const calc = lineCalculationsById.get(l.id) ?? getOrderLineCalculation(l);
      sum += calc.total;
    }
    return sum;
  }, [lines, lineCalculationsById]);

  return (
    <div className="mt-5 rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
      {/* Шапка блока позиций */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-stone-900">
              Спецификация и материалы
            </h2>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700">
              {lines.length}
            </span>
            {lines.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-stone-400 font-medium ml-2">
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-stone-800 transition-colors cursor-pointer"
                >
                  Свернуть все
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-stone-800 transition-colors cursor-pointer"
                >
                  Развернуть все
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-stone-500 font-medium">
            Плитные материалы, фасады, фурнитура, кромка, услуги цеха и монтаж
          </p>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenPricePicker}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-3.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-950 active:scale-98 disabled:opacity-50 transition-all cursor-pointer"
              title="Открыть полный каталог цен"
            >
              <span>+</span>
              <span>Из каталога</span>
            </button>

            {onOpenApplyTemplate && (
              <button
                type="button"
                disabled={Boolean(networkError)}
                onClick={onOpenApplyTemplate}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Добавить готовый типовой набор позиций"
              >
                <span>⚡</span>
                <span>Шаблоны</span>
              </button>
            )}

            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenAddManualLine}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              title="Добавить нестандартную позицию вручную"
            >
              <span>+</span>
              <span>Своя строка</span>
            </button>
          </div>
        )}
      </div>

      {/* Быстрый инлайн-поиск и мгновенное добавление позиций */}
      {!locked && onStepPriceItem && priceItems.length > 0 && (
        <div className="mt-4 rounded-2xl bg-stone-50/80 p-3.5 border border-stone-200/70">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                ⚡
              </span>
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Быстрый поиск материала (например: ЛДСП, Blum, эмаль, столешница)…"
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-9 pl-9 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:border-emerald-800 focus:outline-hidden transition-colors shadow-2xs"
              />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 h-6 w-6 flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {items.length > 1 && (
              <select
                value={selectedQuickTargetItem}
                onChange={(e) => setSelectedQuickTargetItem(e.target.value)}
                className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-xs font-medium text-stone-800 focus:border-emerald-800"
                title="Куда добавлять позиции из быстрого поиска"
              >
                <option value="">Общий заказ</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    В: {it.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Результаты быстрого поиска */}
          {quickSearch.trim() && (
            <div className="mt-2.5 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-md max-h-60 overflow-y-auto">
              {quickSearchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-500">
                  Ничего не найдено по запросу «{quickSearch}». Нажмите «+ Из каталога» для полного списка.
                </div>
              ) : (
                quickSearchResults.map((p) => {
                  const existingLine = lines.find(
                    (l) => l.price_item_id === p.id && (l.order_item_id || "") === (selectedQuickTargetItem || "")
                  );

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 hover:bg-stone-50/80 transition-colors gap-2"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{CATEGORY_ICONS[p.category] ?? "📦"}</span>
                          <span className="text-xs font-bold text-stone-900 truncate">
                            {p.name}
                          </span>
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[10px] font-semibold text-stone-600">
                            {CATEGORY_LABELS[p.category]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-bold text-emerald-900">
                          {formatKzt(p.price)} ₸ / {p.unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {existingLine && (
                          <span className="text-[11px] font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded-lg">
                            В смете: {existingLine.qty} {p.unit}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onStepPriceItem(p, 1, selectedQuickTargetItem || null);
                          }}
                          className="flex min-h-9 items-center justify-center gap-1 rounded-xl bg-emerald-900 px-3 text-xs font-bold text-white shadow-2xs hover:bg-emerald-950 active:scale-95 cursor-pointer"
                        >
                          <span>+ 1 {p.unit}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Горизонтальная лента категорий с подытогами и иконками */}
      {presentCategories.length > 0 && (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {presentCategories.map((cat) => {
            const count = lines.filter((l) => l.category === cat).length;
            const total = categoryTotals
              ? ((categoryTotals as Record<string, number>)[cat] ?? 0)
              : 0;
            const isCollapsed = collapsedCategories.has(cat);
            const icon = CATEGORY_ICONS[cat] ?? "📦";
            const percent = totalDirectCosts > 0 ? Math.round((total / totalDirectCosts) * 100) : 0;

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
                className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs transition-all cursor-pointer ${
                  isCollapsed
                    ? "border-stone-200 bg-stone-100/70 text-stone-600 hover:bg-stone-200/70"
                    : "border-stone-300/90 bg-white text-stone-900 shadow-xs hover:border-emerald-800"
                }`}
              >
                <span>{icon}</span>
                <span className="font-bold">{CATEGORY_LABELS[cat]}</span>
                <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[10px] font-bold text-stone-600">
                  {count}
                </span>
                <span className="font-black text-stone-900 tabular-nums">
                  {formatKzt(total)} ₸
                </span>
                {percent > 0 && (
                  <span className="text-[10px] text-stone-400 font-medium">
                    ({percent}%)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Список строк заказа */}
      {lines.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center">
          <div className="text-3xl mb-1.5">🗂️</div>
          <p className="text-sm font-bold text-stone-800">
            В смете пока нет добавленных позиций
          </p>
          <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
            Используйте строку быстрого поиска выше или кнопку «+ Из каталога», чтобы сформировать расчет сметы.
          </p>
          {!locked && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onOpenPricePicker}
                className="rounded-xl bg-emerald-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-950 cursor-pointer"
              >
                + Открыть справочник материалов
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col divide-y divide-stone-100">
          {presentCategories.map((cat) => {
            const catLines = lines.filter((l) => l.category === cat);
            const catTotal = categoryTotals
              ? ((categoryTotals as Record<string, number>)[cat] ?? 0)
              : 0;
            const isCollapsed = collapsedCategories.has(cat);
            const icon = CATEGORY_ICONS[cat] ?? "📦";
            const percent = totalDirectCosts > 0 ? Math.round((catTotal / totalDirectCosts) * 100) : 0;

            return (
              <div
                key={cat}
                id={`category-group-${cat}`}
                className="py-3.5 first:pt-1 last:pb-1 scroll-mt-20"
              >
                {/* Аккордеон категории */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="flex w-full items-center justify-between rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-stone-50 active:bg-stone-100 cursor-pointer"
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-xs font-bold w-3 text-center">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="text-base">{icon}</span>
                    <span className="text-xs font-black text-stone-900 uppercase tracking-wider">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600">
                      {catLines.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs sm:text-sm font-black text-stone-900 tabular-nums">
                      {formatKzt(catTotal)} ₸
                    </span>
                    {percent > 0 && (
                      <span className="text-[11px] text-stone-400 font-semibold hidden sm:inline">
                        ({percent}% от затрат)
                      </span>
                    )}
                  </div>
                </button>

                {/* Строки категории */}
                {!isCollapsed && (
                  <div className="mt-2 flex flex-col gap-2">
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

                      // Название связанного модуля
                      const linkedItem = line.order_item_id ? itemsMap.get(line.order_item_id) : null;

                      return (
                        <div
                          key={line.id}
                          className="group flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-3 text-xs shadow-xs hover:border-emerald-800/30 transition-all sm:flex-row sm:items-center gap-2.5"
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-stone-900 text-sm">
                                {line.name}
                              </span>

                              {linkedItem && (
                                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700 border border-stone-200/60">
                                  {linkedItem.title}
                                </span>
                              )}

                              {line.is_manual && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                  ручная
                                </span>
                              )}

                              {line.counts_for_technolog && (
                                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                  технолог
                                </span>
                              )}

                              {line.waste_pct > 0 && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                  +{(Number(line.waste_pct) * 100).toFixed(0)}% отход
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-stone-600">
                              {/* Интерактивный степпер прямо на строке */}
                              {!locked && onStepLineQty ? (
                                <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-0.5 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => onStepLineQty(line.id, -1)}
                                    className="flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-white text-sm font-black text-stone-800 hover:bg-stone-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
                                    title="Уменьшить на 1"
                                  >
                                    −
                                  </button>
                                  <span className="font-black text-stone-900 px-2 text-xs tabular-nums">
                                    {line.qty} {line.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onStepLineQty(line.id, 1)}
                                    className="flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-emerald-900 text-sm font-black text-white hover:bg-emerald-950 active:scale-95 transition-all cursor-pointer shadow-2xs"
                                    title="Увеличить на 1"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span className="font-bold text-stone-900">
                                  {line.qty} {line.unit}
                                </span>
                              )}

                              <span className="text-stone-500 font-medium">
                                × {formatKzt(line.unit_price)} ₸
                              </span>

                              {line.billable_qty_rounding === "ceil_to_unit" && (
                                <span className="text-stone-400 text-[11px]">
                                  (с округлением: {billableQty} {line.unit})
                                </span>
                              )}

                              {line.comment && (
                                <span className="italic text-stone-500 truncate max-w-[200px]">
                                  «{line.comment}»
                                </span>
                              )}
                            </div>

                            {hasPriceChange && (
                              <div className="mt-1 text-xs font-semibold text-amber-700">
                                ⚠️ В актуальном прайсе: {formatKzt(currentCatItem.price)} ₸
                              </div>
                            )}
                          </div>

                          {/* Итог строки и кнопки действий */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-stone-100 pt-2 sm:border-0 sm:pt-0">
                            <span className="font-black text-stone-900 text-sm sm:text-base tabular-nums">
                              {formatKzt(lineTotal)} ₸
                            </span>

                            {!locked && (
                              <div className="flex items-center gap-1">
                                {onDuplicateLine && (
                                  <button
                                    type="button"
                                    onClick={() => onDuplicateLine(line)}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                                    title="Дублировать позицию"
                                  >
                                    <CopyIcon />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenEditLine(line)}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                                  title="Редактировать параметры"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteLine(line.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Удалить позицию"
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
