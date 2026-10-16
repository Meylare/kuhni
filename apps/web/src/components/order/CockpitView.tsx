import { useMemo, useState, useRef, useEffect, type TouchEvent, type MouseEvent } from "react";
import { formatKzt } from "../../lib/money";
import { getMarginColor } from "../../lib/margin-colors";
import type {
  Order,
  OrderItem,
  OrderLine,
  OrderAdjustment,
  PriceItem,
} from "../../types/database";
import type { ParametersMap } from "../../lib/parameters";
import type { OrderDisplayCalculation } from "../../lib/orders";
import type { CalculationOutcome } from "@kuhni/calc";
import type { OrderStage } from "./OrderHeader";

export interface CockpitViewProps {
  order: Order;
  lines: OrderLine[];
  items: OrderItem[];
  adjustments: OrderAdjustment[];
  priceItems: PriceItem[];
  globalParams: ParametersMap;
  displayCalc: OrderDisplayCalculation | null;
  calcOutcome: CalculationOutcome | null;
  locked: boolean;
  currentStage: OrderStage;
  onSelectStage: (stage: OrderStage) => void;
  onUpdateContractPrice: (price: number | null) => Promise<void>;
  onStepLineQty: (lineId: string, delta: number) => void;
  onStepPriceItem: (item: PriceItem, delta: number, targetItemId?: string | null) => void;
  onDeleteLine: (lineId: string) => void;
  onOpenPricePicker: () => void;
  onSaveCalculation: () => void;
  onOpenVersionsModal: () => void;
  onBack: () => void;
  onToggleTableMode?: () => void;
}

function lineEffectiveCost(line: OrderLine): number {
  return Math.round(line.qty * line.unit_price * (1 + (line.waste_pct || 0) / 100));
}

export function CockpitView({
  order,
  lines,
  items,
  adjustments: _adjustments,
  priceItems,
  globalParams: _globalParams,
  displayCalc,
  calcOutcome: _calcOutcome,
  locked,
  currentStage,
  onSelectStage,
  onUpdateContractPrice,
  onStepLineQty,
  onStepPriceItem,
  onDeleteLine,
  onOpenPricePicker,
  onSaveCalculation,
  onOpenVersionsModal,
  onBack,
  onToggleTableMode,
}: CockpitViewProps) {
  const [viewMode, setViewMode] = useState<"deal" | "client">("deal");
  const [expandedSection, setExpandedSection] = useState<string | null>("materials");
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");

  const recommendedPrice = useMemo(() => {
    return displayCalc?.priceTotal || 1480000;
  }, [displayCalc]);

  const costTotal = useMemo(() => {
    return displayCalc?.costTotal || 980000;
  }, [displayCalc]);

  const [currentPrice, setCurrentPrice] = useState<number>(() => {
    return order.contract_price ?? recommendedPrice;
  });

  useEffect(() => {
    if (order.contract_price !== null) {
      setCurrentPrice(order.contract_price);
    } else {
      setCurrentPrice(recommendedPrice);
    }
  }, [order.contract_price, recommendedPrice]);

  const netProfit = currentPrice - costTotal;
  const marginPct = currentPrice > 0 ? netProfit / currentPrice : 0;
  const discountDiff = currentPrice - recommendedPrice;
  const discountPct =
    recommendedPrice > 0 && Math.abs(discountDiff) >= 1000
      ? Math.round((discountDiff / recommendedPrice) * 100)
      : 0;

  const marginPctString = `${(marginPct * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const marginColor = getMarginColor(marginPct, 0.28);
  const accentColor =
    marginColor.status === "success"
      ? "#10b981"
      : marginColor.status === "warning"
      ? "#f59e0b"
      : marginColor.status === "danger"
      ? "#ef4444"
      : "#a1a1aa";

  const totalLinearMeters = useMemo(() => {
    const sum = items.reduce((acc, it) => acc + (it.linear_meters || 0), 0);
    return sum > 0 ? sum.toFixed(2).replace(/\.00$/, "") : "3.6";
  }, [items]);

  // Точная группировка всех строк и расчётных статей без расхождений
  const breakdown = useMemo(() => {
    const materialLines = lines.filter(
      (l) => l.category === "materials" || l.category === "facades"
    );
    const hardwareLines = lines.filter(
      (l) => l.category === "hardware" || l.category === "other"
    );
    const workshopLines = lines.filter(
      (l) =>
        l.category === "workshop" ||
        l.category === "transport" ||
        l.category === "labor" ||
        l.category === "assembly" ||
        l.category === "technolog"
    );

    const materialsSum = materialLines.reduce((acc, l) => acc + lineEffectiveCost(l), 0);
    const hardwareSum = hardwareLines.reduce((acc, l) => acc + lineEffectiveCost(l), 0);
    const workshopLinesSum = workshopLines.reduce((acc, l) => acc + lineEffectiveCost(l), 0);

    const assemblyCost = Math.round(displayCalc?.assembly || 0);
    const technologCost = Math.round(displayCalc?.technolog || 0);
    const riskReserveCost = Math.round(displayCalc?.riskReserve || 0);

    const operationsTotal =
      assemblyCost + technologCost + riskReserveCost + workshopLinesSum;

    return {
      materialLines,
      hardwareLines,
      workshopLines,
      materialsSum,
      hardwareSum,
      workshopLinesSum,
      assemblyCost,
      technologCost,
      riskReserveCost,
      operationsTotal,
    };
  }, [lines, displayCalc]);

  const hasBlum = useMemo(
    () =>
      lines.some(
        (x) => x.category === "hardware" && x.name.toLowerCase().includes("blum")
      ),
    [lines]
  );

  // Диапазон тактильной шкалы цены
  const rulerMin = Math.max(
    100000,
    Math.floor((costTotal * 1.05) / 50000) * 50000
  );
  const rulerMax = Math.max(
    rulerMin + 300000,
    Math.ceil((recommendedPrice * 1.2) / 50000) * 50000
  );
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  const applyRulerPosition = (clientX: number) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = rulerMin + ratio * (rulerMax - rulerMin);
    const steppedVal = Math.round(rawVal / 10000) * 10000;
    setCurrentPrice(steppedVal);
  };

  const handlePointerDown = (
    e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>
  ) => {
    if (locked) return;
    setIsDraggingRuler(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    applyRulerPosition(clientX);
  };

  useEffect(() => {
    if (!isDraggingRuler) return;
    const handleMove = (e: globalThis.MouseEvent | globalThis.TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      applyRulerPosition(clientX);
    };
    const handleUp = () => {
      setIsDraggingRuler(false);
      void onUpdateContractPrice(currentPrice);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDraggingRuler, currentPrice, rulerMin, rulerMax]);

  const rulerRatio = Math.max(
    0,
    Math.min(100, ((currentPrice - rulerMin) / (rulerMax - rulerMin)) * 100)
  );

  const handleApplyPreset = async (
    type: "min_margin" | "reset" | "discount_5" | "swap_hardware"
  ) => {
    if (locked) return;
    if (type === "min_margin") {
      const minPrice = Math.round(costTotal / (1 - 0.12) / 10000) * 10000;
      setCurrentPrice(minPrice);
      await onUpdateContractPrice(minPrice);
    } else if (type === "reset") {
      setCurrentPrice(recommendedPrice);
      await onUpdateContractPrice(null);
    } else if (type === "discount_5") {
      const p = Math.round((recommendedPrice * 0.95) / 10000) * 10000;
      setCurrentPrice(p);
      await onUpdateContractPrice(p);
    } else if (type === "swap_hardware") {
      for (const line of lines.filter((l) => l.category === "hardware")) {
        if (hasBlum && line.name.toLowerCase().includes("blum")) {
          const boyardItem = priceItems.find((p) =>
            p.name.toLowerCase().includes("boyard")
          );
          if (boyardItem) {
            onStepLineQty(line.id, -line.qty);
            onStepPriceItem(boyardItem, line.qty, line.order_item_id);
          }
        } else if (!hasBlum && line.name.toLowerCase().includes("boyard")) {
          const blumItem = priceItems.find((p) =>
            p.name.toLowerCase().includes("blum")
          );
          if (blumItem) {
            onStepLineQty(line.id, -line.qty);
            onStepPriceItem(blumItem, line.qty, line.order_item_id);
          }
        }
      }
    }
  };

  // Доли для единой полосы структуры цены (в стиле iOS Storage)
  const totalBase = Math.max(
    1,
    Math.max(0, netProfit) +
      breakdown.materialsSum +
      breakdown.hardwareSum +
      breakdown.operationsTotal
  );
  const profitShare = Math.max(0, (Math.max(0, netProfit) / totalBase) * 100);
  const materialsShare = (breakdown.materialsSum / totalBase) * 100;
  const hardwareShare = (breakdown.hardwareSum / totalBase) * 100;
  const opsShare = (breakdown.operationsTotal / totalBase) * 100;

  const filteredCatalog = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return priceItems.filter((p) => p.active).slice(0, 6);
    return priceItems
      .filter((p) => p.active && p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [priceItems, quickQuery]);

  const renderLineRow = (l: OrderLine) => {
    const totalLine = lineEffectiveCost(l);
    return (
      <div
        key={l.id}
        className="group flex items-center justify-between py-3 border-b border-white/[0.04] last:border-b-0"
      >
        <div className="flex-1 min-w-0 pr-3">
          <div className="text-[14px] font-normal text-zinc-100 leading-snug truncate">
            {l.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-zinc-500 tabular-nums">
            <span>
              {formatKzt(l.unit_price)} ₸ / {l.unit}
            </span>
            {l.waste_pct > 0 && <span>· отходы +{l.waste_pct}%</span>}
            <span className="text-zinc-400">· {formatKzt(totalLine)} ₸</span>
          </div>
        </div>

        {viewMode === "deal" && !locked ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onStepLineQty(l.id, -1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white active:scale-95 transition-all cursor-pointer"
                aria-label="Уменьшить"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
              <span className="min-w-[32px] text-center text-[13px] font-medium text-white tabular-nums">
                {l.qty}
              </span>
              <button
                type="button"
                onClick={() => onStepLineQty(l.id, 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white active:scale-95 transition-all cursor-pointer"
                aria-label="Увеличить"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDeleteLine(l.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Удалить позицию"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-right shrink-0">
            <div className="text-[14px] font-medium text-zinc-200 tabular-nums">
              {l.qty} {l.unit}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-lg px-5 pt-4 pb-28 sm:py-8 flex flex-col min-h-svh text-zinc-100 select-none">
      {/* 1. Навигационная шапка в стиле iOS */}
      <header className="flex items-center justify-between py-2 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 -ml-1.5 px-1.5 py-1 text-[15px] font-normal text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Сделки</span>
        </button>

        {/* Переключатель режимов и дополнительных экранов */}
        <div className="flex items-center gap-4">
          {viewMode === "deal" && (
            <>
              <button
                type="button"
                onClick={() => onSelectStage(currentStage === "fact" ? "quote" : "fact")}
                className="text-[13px] font-normal text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                План/Факт
              </button>
              <button
                type="button"
                onClick={onOpenVersionsModal}
                className="text-[13px] font-normal text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Версии
              </button>
              {onToggleTableMode && (
                <button
                  type="button"
                  onClick={onToggleTableMode}
                  className="hidden sm:inline text-[13px] font-normal text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Таблица
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "deal" ? "client" : "deal"))}
            className={`inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
              viewMode === "client" ? "text-emerald-400" : "text-zinc-300 hover:text-white"
            }`}
          >
            {viewMode === "deal" ? (
              <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
            <span>{viewMode === "deal" ? "Скрыть маржу" : "Режим клиента"}</span>
          </button>
        </div>
      </header>

      {/* 2. Заголовок заказа и Главная цена (Hero Price) */}
      <div className="flex flex-col items-center text-center mb-7">
        <div className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-zinc-500">
          <span className="truncate max-w-[220px]">{order.name}</span>
          <span>·</span>
          <span>{totalLinearMeters} п.м.</span>
          {discountPct !== 0 && (
            <>
              <span>·</span>
              <span className={discountPct < 0 ? "text-amber-400" : "text-emerald-400"}>
                {discountPct > 0 ? `+${discountPct}%` : `${discountPct}%`}
              </span>
            </>
          )}
        </div>

        <h1 className="mt-2 text-[50px] sm:text-[56px] leading-[1.04] font-semibold tracking-[-0.035em] text-white tabular-nums">
          {formatKzt(currentPrice)}
          <span className="ml-2 text-[34px] font-light text-zinc-500">₸</span>
        </h1>

        {/* Подстрочник статуса */}
        <div className="mt-2.5 flex items-center gap-2 text-[13px] text-zinc-400 tabular-nums">
          {viewMode === "deal" ? (
            <>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              <span>
                Маржа <strong className="font-medium text-white">{marginPctString}</strong>
              </span>
              <span className="text-zinc-600">·</span>
              <span>Себестоимость {formatKzt(costTotal)} ₸</span>
            </>
          ) : (
            <span>Индивидуальная комплектация · Гарантия 24 мес.</span>
          )}
        </div>
      </div>

      {/* 3. Тактильная шкала цены (Apple Watch / Camera Dial style) — только в режиме сделки */}
      {viewMode === "deal" && (
        <div className="mb-8">
          <div className="flex items-center justify-between text-[11px] font-normal text-zinc-500 tabular-nums mb-1.5 px-0.5">
            <span>{(rulerMin / 1000000).toFixed(2)} млн ₸</span>
            <span className="text-zinc-600 text-[10px] tracking-widest uppercase">
              Сдвиньте для подбора цены
            </span>
            <span>{(rulerMax / 1000000).toFixed(2)} млн ₸</span>
          </div>

          <div
            ref={rulerRef}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            style={{ touchAction: "none" }}
            className="relative h-12 flex items-center cursor-ew-resize select-none"
          >
            {/* 41 точная засечка с подсветкой вокруг активного положения */}
            <div className="flex justify-between items-center w-full pointer-events-none">
              {Array.from({ length: 41 }).map((_, i) => {
                const tickPos = (i / 40) * 100;
                const dist = Math.abs(tickPos - rulerRatio);
                const isMajor = i % 10 === 0;
                const isMid = i % 5 === 0 && !isMajor;
                const isNear = dist < 4.5;

                return (
                  <div
                    key={i}
                    className={`w-[1.5px] rounded-full transition-all duration-75 ${
                      isNear
                        ? "h-6 bg-white"
                        : isMajor
                        ? "h-5 bg-white/35"
                        : isMid
                        ? "h-3.5 bg-white/20"
                        : "h-2 bg-white/[0.09]"
                    }`}
                  />
                );
              })}
            </div>

            {/* Активный курсор-игла */}
            <div
              className="absolute inset-y-1 -translate-x-1/2 flex flex-col items-center justify-between pointer-events-none transition-all duration-75"
              style={{ left: `${rulerRatio}%` }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
              />
              <div
                className="w-[2px] flex-1 my-0.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-white" />
            </div>
          </div>

          {/* Быстрые пресеты цены — минималистичные текстовые действия без тяжелых рамок */}
          <div className="mt-2 flex items-center justify-between text-[12px] px-0.5">
            <button
              type="button"
              onClick={() => void handleApplyPreset("min_margin")}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Мин. порог (маржа 12%)</span>
            </button>

            <div className="flex items-center gap-4">
              {currentPrice !== recommendedPrice && (
                <button
                  type="button"
                  onClick={() => void handleApplyPreset("reset")}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-medium"
                >
                  Вернуть {formatKzt(recommendedPrice)} ₸
                </button>
              )}
              <button
                type="button"
                onClick={onSaveCalculation}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer font-medium"
              >
                Зафиксировать версию
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Единая мульти-сегментная полоса структуры цены (как в iOS Хранилище / Apple Wallet) */}
      <div className="mb-5">
        <div className="h-1.5 w-full flex gap-[3px] rounded-full overflow-hidden">
          {viewMode === "deal" && profitShare > 0 && (
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${profitShare}%`, backgroundColor: accentColor }}
            />
          )}
          <div
            className="h-full bg-zinc-100 rounded-full transition-all duration-300"
            style={{ width: `${ Math.max(8, materialsShare)}%` }}
          />
          <div
            className="h-full bg-zinc-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(6, hardwareShare)}%` }}
          />
          <div
            className="h-full bg-zinc-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(6, opsShare)}%` }}
          />
        </div>
      </div>

      {/* 5. Чистый типографический список категорий с разделителями-волосками (без прямоугольных капсул) */}
      <div className="border-t border-white/[0.08] divide-y divide-white/[0.08]">
        {/* СЕКЦИЯ 1: ЧИСТАЯ ПРИБЫЛЬ (Только в режиме сделки) */}
        {viewMode === "deal" && (
          <div>
            <button
              type="button"
              onClick={() =>
                setExpandedSection((p) => (p === "profit" ? null : "profit"))
              }
              className="w-full py-4 flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                      Чистая прибыль
                    </span>
                    <span className="text-[13px] text-zinc-500 tabular-nums">
                      {marginPctString}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className="text-[16px] font-medium tabular-nums"
                  style={{ color: netProfit >= 0 ? "#ffffff" : "#f87171" }}
                >
                  {formatKzt(netProfit)} ₸
                </span>
                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                    expandedSection === "profit" ? "rotate-90 text-zinc-300" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {expandedSection === "profit" && (
              <div className="pb-4 pl-5 border-l border-white/[0.08] ml-1 space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-zinc-200">Выручка по заказу</div>
                    <div className="text-[11px] text-zinc-500">Текущая цена для клиента</div>
                  </div>
                  <span className="font-medium text-white tabular-nums">
                    {formatKzt(currentPrice)} ₸
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-zinc-200">Полная себестоимость</div>
                    <div className="text-[11px] text-zinc-500">Материалы, фурнитура, цех и монтаж</div>
                  </div>
                  <span className="font-medium text-zinc-300 tabular-nums">
                    −{formatKzt(costTotal)} ₸
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <span className="text-zinc-400">Чистый остаток ({marginPctString})</span>
                  <span className="font-semibold text-emerald-400 tabular-nums">
                    +{formatKzt(netProfit)} ₸
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* СЕКЦИЯ 2: ПЛИТНЫЕ МАТЕРИАЛЫ И ФАСАДЫ */}
        <div>
          <button
            type="button"
            onClick={() =>
              setExpandedSection((p) => (p === "materials" ? null : "materials"))
            }
            className="w-full py-4 flex items-center justify-between text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-100 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                    Корпус, фасады и столешница
                  </span>
                  <span className="text-[13px] text-zinc-500 tabular-nums">
                    {breakdown.materialLines.length} поз.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[16px] font-medium text-white tabular-nums">
                {formatKzt(breakdown.materialsSum)} ₸
              </span>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                  expandedSection === "materials" ? "rotate-90 text-zinc-300" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {expandedSection === "materials" && (
            <div className="pb-4 pl-5 border-l border-white/[0.08] ml-1">
              {breakdown.materialLines.length === 0 ? (
                <div className="py-3 text-[13px] text-zinc-500">
                  Плитные материалы ещё не добавлены
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {breakdown.materialLines.map(renderLineRow)}
                </div>
              )}

              {viewMode === "deal" && !locked && (
                <button
                  type="button"
                  onClick={onOpenPricePicker}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span>Добавить из каталога</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* СЕКЦИЯ 3: ФУРНИТУРА И МЕХАНИЗМЫ */}
        <div>
          <button
            type="button"
            onClick={() =>
              setExpandedSection((p) => (p === "hardware" ? null : "hardware"))
            }
            className="w-full py-4 flex items-center justify-between text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                    Фурнитура и механизмы
                  </span>
                  <span className="text-[13px] text-zinc-500">
                    {hasBlum ? "Blum" : "Boyard"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[16px] font-medium text-white tabular-nums">
                {formatKzt(breakdown.hardwareSum)} ₸
              </span>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                  expandedSection === "hardware" ? "rotate-90 text-zinc-300" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {expandedSection === "hardware" && (
            <div className="pb-4 pl-5 border-l border-white/[0.08] ml-1">
              {!locked && (
                <div className="flex items-center justify-between py-2 mb-1 border-b border-white/[0.05]">
                  <span className="text-[12px] text-zinc-400">
                    Комплектация: <strong className="text-white font-medium">{hasBlum ? "Blum (Австрия)" : "Boyard"}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleApplyPreset("swap_hardware")}
                    className="text-[12px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {hasBlum ? "Пересчитать на Boyard →" : "Пересчитать на Blum →"}
                  </button>
                </div>
              )}

              {breakdown.hardwareLines.length === 0 ? (
                <div className="py-3 text-[13px] text-zinc-500">
                  Позиции фурнитуры не добавлены
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {breakdown.hardwareLines.map(renderLineRow)}
                </div>
              )}

              {viewMode === "deal" && !locked && (
                <button
                  type="button"
                  onClick={onOpenPricePicker}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span>Добавить фурнитуру</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* СЕКЦИЯ 4: ЦЕХ, СБОРКА И ТЕХНОЛОГ */}
        <div>
          <button
            type="button"
            onClick={() =>
              setExpandedSection((p) => (p === "workshop" ? null : "workshop"))
            }
            className="w-full py-4 flex items-center justify-between text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-600 shrink-0" />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                    Производство, сборка и монтаж
                  </span>
                  <span className="text-[13px] text-zinc-500 tabular-nums">
                    {currentPrice > 0
                      ? `${Math.round((breakdown.operationsTotal / currentPrice) * 100)}%`
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[16px] font-medium text-white tabular-nums">
                {formatKzt(breakdown.operationsTotal)} ₸
              </span>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                  expandedSection === "workshop" ? "rotate-90 text-zinc-300" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {expandedSection === "workshop" && (
            <div className="pb-4 pl-5 border-l border-white/[0.08] ml-1 divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-[14px] text-zinc-100">Сборка и установка на объекте</div>
                  <div className="text-[12px] text-zinc-500">
                    Норматив монтажа · {totalLinearMeters} п.м.
                  </div>
                </div>
                <span className="text-[14px] font-medium text-zinc-200 tabular-nums">
                  {formatKzt(breakdown.assemblyCost)} ₸
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-[14px] text-zinc-100">Проектирование и технолог (Базис)</div>
                  <div className="text-[12px] text-zinc-500">
                    Деталировка, карты раскроя и присадки
                  </div>
                </div>
                <span className="text-[14px] font-medium text-zinc-200 tabular-nums">
                  {formatKzt(breakdown.technologCost)} ₸
                </span>
              </div>

              {breakdown.riskReserveCost > 0 && (
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-[14px] text-zinc-100">Технологический резерв</div>
                    <div className="text-[12px] text-zinc-500">Запас на непредвиденный расход</div>
                  </div>
                  <span className="text-[14px] font-medium text-zinc-200 tabular-nums">
                    {formatKzt(breakdown.riskReserveCost)} ₸
                  </span>
                </div>
              )}

              {breakdown.workshopLines.map(renderLineRow)}
            </div>
          )}
        </div>
      </div>

      {/* 6. Быстрые действия в режиме клиента */}
      {viewMode === "client" && !locked && (
        <div className="mt-6 flex items-center justify-between text-[13px] py-2">
          <button
            type="button"
            onClick={() => void handleApplyPreset("swap_hardware")}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Фурнитура: <strong className="text-white font-medium">{hasBlum ? "Blum ⇄ Boyard" : "Boyard ⇄ Blum"}</strong>
          </button>

          <button
            type="button"
            onClick={() => void handleApplyPreset("discount_5")}
            className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-medium"
          >
            Скидка −5%
          </button>
        </div>
      )}

      {/* 7. Минималистичный поиск и быстрое добавление позиций (в потоке страницы, без перекрытия браузером) */}
      {viewMode === "deal" && !locked && (
        <div className="mt-8 pt-4">
          {!isQuickSearchOpen ? (
            <div className="flex items-center justify-between border-b border-white/[0.12] pb-2.5">
              <button
                type="button"
                onClick={() => setIsQuickSearchOpen(true)}
                className="flex-1 flex items-center gap-2.5 text-left text-[14px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                <span>Быстро добавить материал или фурнитуру…</span>
              </button>

              <button
                type="button"
                onClick={onOpenPricePicker}
                className="text-[13px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer ml-3"
              >
                Каталог
              </button>
            </div>
          ) : (
            <div className="pt-1">
              <div className="flex items-center gap-2 border-b border-white/30 pb-2">
                <svg className="w-4 h-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  autoFocus
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Название: Egger, петля Blum, Gola…"
                  className="w-full bg-transparent text-[15px] text-white placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickSearchOpen(false);
                    setQuickQuery("");
                  }}
                  className="text-[13px] text-zinc-400 hover:text-white cursor-pointer shrink-0"
                >
                  Готово
                </button>
              </div>

              <div className="mt-2 divide-y divide-white/[0.05] max-h-60 overflow-y-auto">
                {filteredCatalog.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onStepPriceItem(p, 1, null);
                    }}
                    className="w-full py-2.5 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-[14px] text-zinc-200 truncate">{p.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {formatKzt(p.price)} ₸ / {p.unit}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-400 shrink-0 tabular-nums">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      <span>Добавить</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
