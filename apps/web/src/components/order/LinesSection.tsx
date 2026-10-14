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

  const itemsMap = useMemo(() => {
    return new Map(items.map((i) => [i.id, i]));
  }, [items]);

  const quickSearchResults = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.trim().toLowerCase();
    return priceItems
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [priceItems, quickSearch]);

  const totalDirectCosts = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      const calc = lineCalculationsById.get(l.id) ?? getOrderLineCalculation(l);
      sum += calc.total;
    }
    return sum;
  }, [lines, lineCalculationsById]);

  return (
    <div className="mt-5 rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-lg sm:p-6 text-zinc-100">
      {/* Шапка блока позиций */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">
              Спецификация и материалы
            </h2>
            <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-semibold text-zinc-300 font-mono">
              {lines.length}
            </span>
            {lines.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium ml-2">
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Свернуть
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Развернуть
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Плитные материалы, фасады, фурнитура, кромка, цех и монтаж
          </p>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenPricePicker}
              className="flex items-center justify-center gap-1.5 rounded-full bg-white text-black font-semibold px-4 py-1.5 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
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
                className="flex items-center justify-center gap-1.5 rounded-full border border-white/[0.08] bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
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
              className="flex items-center justify-center gap-1.5 rounded-full border border-white/[0.08] bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              title="Добавить нестандартную позицию вручную"
            >
              <span>+</span>
              <span>Своя строка</span>
            </button>
          </div>
        )}
      </div>

      {/* Быстрый инлайн-поиск */}
      {!locked && onStepPriceItem && priceItems.length > 0 && (
        <div className="mt-4 rounded-2xl bg-zinc-950/60 p-3.5 border border-zinc-850">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Быстрый поиск материала (ЛДСП, Blum, профиль, кромка)…"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pr-9 pl-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20 transition-colors"
              />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white h-6 w-6 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {items.length > 1 && (
              <select
                value={selectedQuickTargetItem}
                onChange={(e) => setSelectedQuickTargetItem(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 focus:outline-hidden focus:border-white/20"
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
            <div className="mt-2.5 divide-y divide-zinc-850 rounded-xl border border-zinc-800 bg-[#121215] shadow-2xl max-h-60 overflow-y-auto">
              {quickSearchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
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
                      className="flex items-center justify-between p-2.5 hover:bg-zinc-850/50 transition-colors gap-2"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{CATEGORY_ICONS[p.category] ?? "📦"}</span>
                          <span className="text-xs font-semibold text-white truncate">
                            {p.name}
                          </span>
                          <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.2 text-[10px] text-zinc-400">
                            {CATEGORY_LABELS[p.category]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-bold text-emerald-400 font-mono">
                          {formatKzt(p.price)} ₸ / {p.unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {existingLine && (
                          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded-lg">
                            {existingLine.qty} {p.unit}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onStepPriceItem(p, 1, selectedQuickTargetItem || null);
                          }}
                          className="rounded-full bg-white text-black font-semibold px-3 py-1 text-xs hover:bg-zinc-200 active:scale-95 cursor-pointer shadow-xs"
                        >
                          + 1
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

      {/* Горизонтальная лента категорий */}
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
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-all cursor-pointer ${
                  isCollapsed
                    ? "border-white/[0.06] bg-zinc-950/60 text-zinc-500 hover:text-zinc-300"
                    : "border-white/[0.12] bg-zinc-900 text-white font-medium shadow-xs"
                }`}
              >
                <span>{icon}</span>
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className="rounded-full bg-white/[0.08] px-1.5 py-0.2 text-[10px] font-mono text-zinc-300">
                  {count}
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {formatKzt(total)} ₸
                </span>
                {percent > 0 && (
                  <span className="text-[10px] text-zinc-500 font-mono">
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
        <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center">
          <div className="text-3xl mb-1.5">🗂️</div>
          <p className="text-xs font-semibold text-white">
            В смете пока нет добавленных позиций
          </p>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            Используйте строку быстрого поиска выше или кнопку «+ Из каталога», чтобы сформировать смету.
          </p>
          {!locked && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onOpenPricePicker}
                className="rounded-full bg-white text-black font-semibold px-4 py-2 text-xs hover:bg-zinc-200 cursor-pointer shadow-md"
              >
                + Открыть справочник материалов
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col divide-y divide-white/[0.06]">
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
                  className="flex w-full items-center justify-between rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.03] cursor-pointer"
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs font-bold w-3 text-center">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="text-base">{icon}</span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                      {catLines.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs sm:text-sm font-bold text-white font-mono tabular-nums">
                      {formatKzt(catTotal)} ₸
                    </span>
                    {percent > 0 && (
                      <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                        ({percent}%)
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

                      const currentCatItem = line.price_item_id
                        ? priceItemsById.get(line.price_item_id)
                        : null;
                      const hasPriceChange =
                        currentCatItem && currentCatItem.price !== Number(line.unit_price);

                      const linkedItem = line.order_item_id ? itemsMap.get(line.order_item_id) : null;

                      return (
                        <div
                          key={line.id}
                          className="flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-3 text-xs shadow-xs hover:border-white/[0.15] transition-all sm:flex-row sm:items-center gap-2.5"
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-white text-xs">
                                {line.name}
                              </span>

                              {linkedItem && (
                                <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] text-zinc-400">
                                  {linkedItem.title}
                                </span>
                              )}

                              {line.is_manual && (
                                <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-300">
                                  ручная
                                </span>
                              )}

                              {line.counts_for_technolog && (
                                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/25 px-1.5 py-0.5 text-[10px] text-indigo-300">
                                  технолог
                                </span>
                              )}

                              {line.waste_pct > 0 && (
                                <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-300">
                                  +{(Number(line.waste_pct) * 100).toFixed(0)}% отход
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
                              {/* Интерактивный степпер */}
                              {!locked && onStepLineQty ? (
                                <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => onStepLineQty(line.id, -1)}
                                    className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer font-bold"
                                    title="Уменьшить"
                                  >
                                    −
                                  </button>
                                  <span className="min-w-8 text-center font-mono font-bold text-white px-1 text-[11px]">
                                    {line.qty} {line.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onStepLineQty(line.id, 1)}
                                    className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer font-bold"
                                    title="Увеличить"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span className="font-semibold text-white font-mono">
                                  {line.qty} {line.unit}
                                </span>
                              )}

                              <span className="text-zinc-500 font-mono">
                                × {formatKzt(line.unit_price)} ₸
                              </span>

                              {line.billable_qty_rounding === "ceil_to_unit" && (
                                <span className="text-zinc-500 text-[11px] font-mono">
                                  (окр: {billableQty} {line.unit})
                                </span>
                              )}

                              {line.comment && (
                                <span className="italic text-zinc-500 truncate max-w-[200px]">
                                  «{line.comment}»
                                </span>
                              )}
                            </div>

                            {hasPriceChange && (
                              <div className="mt-1 text-xs font-semibold text-amber-400">
                                ⚠️ В актуальном каталоге: {formatKzt(currentCatItem.price)} ₸
                              </div>
                            )}
                          </div>

                          {/* Итог строки и кнопки */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-zinc-900 pt-2 sm:border-0 sm:pt-0">
                            <span className="font-bold text-white text-sm font-mono tabular-nums">
                              {formatKzt(lineTotal)} ₸
                            </span>

                            {!locked && (
                              <div className="flex items-center gap-1">
                                {onDuplicateLine && (
                                  <button
                                    type="button"
                                    onClick={() => onDuplicateLine(line)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                    title="Дублировать"
                                  >
                                    <CopyIcon />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenEditLine(line)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                  title="Редактировать"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteLine(line.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
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
