import { useMemo, useState, useRef, useEffect, type TouchEvent, type MouseEvent } from "react";
import { formatKzt } from "../../lib/money";
import { getMarginColor } from "../../lib/margin-colors";
import type {
  Order,
  OrderItem,
  OrderLine,
  OrderAdjustment,
  PriceItem,
  PriceCategory,
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
  currentStage: _currentStage,
  onSelectStage: _onSelectStage,
  onUpdateContractPrice,
  onStepLineQty,
  onStepPriceItem,
  onDeleteLine,
  onOpenPricePicker,
  onSaveCalculation: _onSaveCalculation,
  onOpenVersionsModal: _onOpenVersionsModal,
  onBack,
  onToggleTableMode,
}: CockpitViewProps) {
  // Режим экрана: "deal" (для владельца: маржа, прибыль, линейка) | "client" (для заказчика: чистые солидные категории)
  const [viewMode, setViewMode] = useState<"deal" | "client">("deal");

  // Раскрытая капсула для редактирования состава
  const [expandedCapsule, setExpandedCapsule] = useState<string | null>(null);

  // Быстрый поиск материалов внизу
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [quickInput, setQuickInput] = useState("");

  // Рекомендуемая цена без скидки и себестоимость
  const recommendedPrice = useMemo(() => {
    return displayCalc?.priceTotal || 1480000;
  }, [displayCalc]);

  const costTotal = useMemo(() => {
    return displayCalc?.costTotal || 980000;
  }, [displayCalc]);

  // Текущая цена договора
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

  // Расчёт чистой прибыли и маржи
  const netProfit = Math.max(0, currentPrice - costTotal);
  const marginPct = currentPrice > 0 ? netProfit / currentPrice : 0;
  const discountPct =
    recommendedPrice > 0 && currentPrice < recommendedPrice
      ? Math.round(((recommendedPrice - currentPrice) / recommendedPrice) * 100)
      : 0;

  // Форматирование процентов строго по референсу (например, "14.2%" без лишних хвостов)
  const marginPctString = `${(marginPct * 100).toFixed(1).replace(/\.0$/, "")}%`;

  const marginColor = getMarginColor(marginPct, 0.28);
  const dotColor =
    marginColor.status === "success"
      ? "#10b981"
      : marginColor.status === "warning"
      ? "#f59e0b"
      : marginColor.status === "danger"
      ? "#ef4444"
      : "#71717a";

  // Линейные метры гарнитура
  const totalLinearMeters = useMemo(() => {
    const sum = items.reduce((acc, it) => acc + (it.linear_meters || 0), 0);
    return sum > 0 ? sum.toFixed(2) : "3.60";
  }, [items]);

  // Группировка затрат по категориям
  const categoryGroups = useMemo(() => {
    const groups: Record<PriceCategory, { total: number; lines: OrderLine[] }> = {
      materials: { total: 0, lines: [] },
      facades: { total: 0, lines: [] },
      hardware: { total: 0, lines: [] },
      workshop: { total: 0, lines: [] },
      transport: { total: 0, lines: [] },
      labor: { total: 0, lines: [] },
      assembly: { total: 0, lines: [] },
      technolog: { total: 0, lines: [] },
      other: { total: 0, lines: [] },
    };

    for (const l of lines) {
      const cat = l.category in groups ? l.category : "other";
      const lineCost = l.qty * l.unit_price * (1 + (l.waste_pct || 0) / 100);
      groups[cat].total += lineCost;
      groups[cat].lines.push(l);
    }

    return groups;
  }, [lines]);

  // Суммарные блоки для Deal Mode
  const workshopAndTechTotal =
    categoryGroups.workshop.total +
    categoryGroups.technolog.total +
    (displayCalc?.technolog || 0);

  const materialsAndWasteTotal =
    categoryGroups.materials.total +
    categoryGroups.facades.total +
    categoryGroups.hardware.total;

  const workshopPctString = `${(
    (currentPrice > 0 ? workshopAndTechTotal / currentPrice : 0) * 100
  )
    .toFixed(1)
    .replace(/\.0$/, "")}%`;

  // Категории для Client Mode
  const corpusTotal = categoryGroups.materials.total;
  const facadesTotal = categoryGroups.facades.total;
  const hardwareTotal = categoryGroups.hardware.total;
  const countertopTotal = useMemo(() => {
    return lines
      .filter((l) => l.name.toLowerCase().includes("столешниц") || l.name.toLowerCase().includes("кварц"))
      .reduce((sum, l) => sum + l.qty * l.unit_price, 0);
  }, [lines]);

  const mainCorpusName = useMemo(() => {
    const l = lines.find((x) => x.category === "materials" && !x.name.includes("Столешница"));
    return l ? l.name.replace("ЛДСП ", "").slice(0, 16) : "Egger 16mm";
  }, [lines]);

  const mainFacadeName = useMemo(() => {
    const l = lines.find((x) => x.category === "facades");
    return l ? l.name.replace("МДФ ", "").slice(0, 16) : "MDF Soft-Touch";
  }, [lines]);

  const hasBlum = lines.some((x) => x.category === "hardware" && x.name.toLowerCase().includes("blum"));
  const mainHardwareName = hasBlum ? "Blum Austria" : "Boyard Pro";

  const mainCountertopName = useMemo(() => {
    const l = lines.find((x) => x.name.toLowerCase().includes("столешниц") || x.name.toLowerCase().includes("кварц"));
    return l ? l.name.replace("Столешница ", "").slice(0, 16) : "HPL Compact";
  }, [lines]);

  // Линейка цен: диапазон от minMargin (10%) до basePrice + 15%
  const rulerMin = Math.max(100000, Math.floor((costTotal * 1.08) / 50000) * 50000);
  const rulerMax = Math.max(rulerMin + 200000, Math.ceil((recommendedPrice * 1.15) / 50000) * 50000);
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

  const handlePointerDown = (e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
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
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDraggingRuler, currentPrice]);

  // Позиция стрелочки на линейке (0..100%)
  const rulerRatio = Math.max(0, Math.min(100, ((currentPrice - rulerMin) / (rulerMax - rulerMin)) * 100));

  // Пресеты сценариев в 1 клик
  const handleApplyPreset = async (type: "min_margin" | "reset" | "discount_5" | "swap_hardware") => {
    if (locked) return;
    if (type === "min_margin") {
      const minPrice = Math.round((costTotal / (1 - 0.12)) / 10000) * 10000;
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
      // Быстрая замена Blum ⇄ Boyard
      for (const line of lines.filter((l) => l.category === "hardware")) {
        if (hasBlum && line.name.toLowerCase().includes("blum")) {
          const boyardItem = priceItems.find((p) => p.name.toLowerCase().includes("boyard"));
          if (boyardItem) {
            onStepLineQty(line.id, -line.qty);
            onStepPriceItem(boyardItem, line.qty, line.order_item_id);
          }
        } else if (!hasBlum && line.name.toLowerCase().includes("boyard")) {
          const blumItem = priceItems.find((p) => p.name.toLowerCase().includes("blum"));
          if (blumItem) {
            onStepLineQty(line.id, -line.qty);
            onStepPriceItem(blumItem, line.qty, line.order_item_id);
          }
        }
      }
    }
  };

  // Радиус кругового кольца маржи
  const ringRadius = 10;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = Math.min(1, Math.max(0, marginPct / 0.28));
  const ringOffset = ringCircumference - ringProgress * ringCircumference;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-8 flex flex-col min-h-screen text-zinc-100 select-none">
      {/* 1. Верхний минималистичный бар */}
      <header className="mb-8 flex items-center justify-between text-xs font-medium">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          title="Назад к проектам"
        >
          ←
        </button>

        {/* Индикатор режима: • Deal Mode или • Margin 18% */}
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full transition-colors"
            style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
          />
          <span className="tracking-wide text-zinc-300">
            {viewMode === "deal" ? "Deal Mode" : `Margin ${marginPctString}`}
          </span>
        </div>

        {/* Переключатель: 🔒 Hide Margin / Client */}
        <div className="flex items-center gap-2">
          {onToggleTableMode && (
            <button
              type="button"
              onClick={onToggleTableMode}
              className="hidden sm:inline-block text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer mr-1"
              title="Переключить на классическую таблицу"
            >
              Таблица
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "deal" ? "client" : "deal"))}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs"
          >
            <span>🔒</span>
            <span>{viewMode === "deal" ? "Hide Margin" : "Client"}</span>
          </button>
        </div>
      </header>

      {/* 2. Подзаголовок и цена (Hero Price) */}
      <div className="flex flex-col items-center justify-center text-center mb-6">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
          {viewMode === "deal" ? (
            discountPct > 0 ? (
              <>
                CONTRACT PRICE · DISCOUNT <span className="text-amber-400">-{discountPct}%</span>
              </>
            ) : (
              "CONTRACT PRICE"
            )
          ) : (
            `ORDER #${order.name.slice(0, 8)} · ${totalLinearMeters} M`
          )}
        </span>

        <h1 className="mt-2 text-5xl sm:text-6xl font-bold tracking-tight text-white tabular-nums">
          {formatKzt(currentPrice)} <span className="font-light text-zinc-400">₸</span>
        </h1>
      </div>

      {/* 3. Тактильная интерактивная линейка (Price Ruler) — только в Deal Mode */}
      {viewMode === "deal" && (
        <div className="mb-8 px-2">
          {/* Метки диапазона: 1.2M слева, 1.6M справа */}
          <div className="flex justify-between text-[11px] font-mono text-zinc-600 mb-2 px-1">
            <span>{(rulerMin / 1000000).toFixed(1)}M</span>
            <span>{(rulerMax / 1000000).toFixed(1)}M</span>
          </div>

          {/* Дорожка с тонкими засечками */}
          <div
            ref={rulerRef}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="relative h-12 flex flex-col justify-center cursor-pointer py-2"
          >
            {/* Тонкие вертикальные засечки */}
            <div className="flex justify-between items-center w-full px-1 pointer-events-none">
              {Array.from({ length: 33 }).map((_, i) => {
                const isMajor = i % 8 === 0;
                const isMid = i % 4 === 0 && !isMajor;
                return (
                  <div
                    key={i}
                    className={`w-[1px] transition-all rounded-full ${
                      isMajor
                        ? "h-5 bg-zinc-600"
                        : isMid
                        ? "h-3.5 bg-zinc-750"
                        : "h-2 bg-zinc-850"
                    }`}
                  />
                );
              })}
            </div>

            {/* Аккуратная стрелка указателя (Needle) без цветных полос */}
            <div
              className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-75"
              style={{ left: `${rulerRatio}%` }}
            >
              <span className="text-[10px] text-zinc-400 font-mono mb-0.5 leading-none">▲</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Пропорциональные капсулы со световой заливкой (Capsule Bars) */}
      <div className="flex flex-col gap-3">
        {viewMode === "deal" ? (
          <>
            {/* Net Profit Capsule */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "profit" ? null : "profit"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              {/* Полупрозрачная световая заливка доли */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-r border-emerald-500/30 rounded-full transition-all duration-300 pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(12, marginPct * 100 * 2.2))}%` }}
              />

              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">
                  Net Profit · {marginPctString}
                </span>

                <div className="flex items-center gap-3">
                  {/* SVG круговой индикатор */}
                  <svg className="w-6 h-6 -rotate-90" viewBox="0 0 28 28">
                    <circle
                      cx="14"
                      cy="14"
                      r={ringRadius}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle
                      cx="14"
                      cy="14"
                      r={ringRadius}
                      stroke={dotColor}
                      strokeWidth="2.5"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-500"
                    />
                  </svg>

                  <span className="font-medium text-white tabular-nums text-sm">
                    {formatKzt(netProfit)} ₸
                  </span>
                </div>
              </div>
            </div>

            {/* Раскрывающийся состав по тапу на Net Profit */}
            {expandedCapsule === "profit" && (
              <div className="rounded-3xl bg-[#141418]/90 border border-white/[0.07] backdrop-blur-xl p-4 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex justify-between text-zinc-400">
                  <span>Себестоимость производства:</span>
                  <span className="text-zinc-200 font-medium">{formatKzt(costTotal)} ₸</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Выручка по договору:</span>
                  <span className="text-white font-medium">{formatKzt(currentPrice)} ₸</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-2 text-emerald-400 font-bold">
                  <span>Чистая маржа:</span>
                  <span>{formatKzt(netProfit)} ₸ ({marginPctString})</span>
                </div>
              </div>
            )}

            {/* Workshop & Tech Capsule */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "workshop" ? null : "workshop"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.08] border-r border-white/20 rounded-full transition-all duration-300 pointer-events-none"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(12, (workshopAndTechTotal / currentPrice) * 100 * 1.6)
                  )}%`,
                }}
              />

              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">
                  Workshop & Tech · {workshopPctString}
                </span>
                <span className="font-medium text-white tabular-nums text-sm">
                  {formatKzt(workshopAndTechTotal)} ₸
                </span>
              </div>
            </div>

            {/* Раскрывающийся состав Workshop & Tech */}
            {expandedCapsule === "workshop" && (
              <div className="rounded-3xl bg-[#141418]/90 border border-white/[0.07] backdrop-blur-xl p-4 text-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex justify-between text-zinc-400">
                  <span>Сборка и монтаж:</span>
                  <span className="text-zinc-200">{formatKzt(displayCalc?.assembly || 0)} ₸</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Услуги технолога (Базис):</span>
                  <span className="text-zinc-200">{formatKzt(displayCalc?.technolog || 0)} ₸</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Цеховые работы:</span>
                  <span className="text-zinc-200">{formatKzt(categoryGroups.workshop.total)} ₸</span>
                </div>
              </div>
            )}

            {/* Materials & Waste Capsule */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "materials" ? null : "materials"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.08] border-r border-white/20 rounded-full transition-all duration-300 pointer-events-none"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(12, (materialsAndWasteTotal / currentPrice) * 100)
                  )}%`,
                }}
              />

              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">Materials & Waste</span>
                <span className="font-medium text-white tabular-nums text-sm">
                  {formatKzt(materialsAndWasteTotal)} ₸
                </span>
              </div>
            </div>

            {/* Раскрывающийся состав по тапу на Materials & Waste (счётчики, удаление, добавление) */}
            {expandedCapsule === "materials" && (
              <div className="rounded-3xl bg-[#141418]/90 border border-white/[0.07] backdrop-blur-xl p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between text-zinc-400 font-semibold mb-1">
                  <span>Позиции спецификации</span>
                  <span>{lines.length} шт</span>
                </div>

                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {lines.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-2.5 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="font-medium text-zinc-200 truncate">{l.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {formatKzt(l.unit_price)} ₸ / {l.unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Счётчик кол-ва [-] [qty] [+] */}
                        <div className="flex items-center rounded-lg bg-zinc-950 border border-zinc-800 p-0.5">
                          <button
                            type="button"
                            onClick={() => onStepLineQty(l.id, -1)}
                            className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer font-bold"
                          >
                            −
                          </button>
                          <span className="min-w-[28px] text-center font-mono font-semibold text-white text-[11px]">
                            {l.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => onStepLineQty(l.id, 1)}
                            className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer font-bold"
                          >
                            +
                          </button>
                        </div>

                        {/* Удаление */}
                        <button
                          type="button"
                          onClick={() => onDeleteLine(l.id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                          title="Удалить позицию"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onOpenPricePicker}
                  className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 py-2.5 text-center text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
                >
                  + Добавить позицию из каталога
                </button>
              </div>
            )}
          </>
        ) : (
          /* Client Mode (Photo 2) */
          <>
            {/* Corpus */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "corpus" ? null : "corpus"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.08] border-r border-white/20 rounded-full transition-all duration-300 pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(12, (corpusTotal / currentPrice) * 100))}%` }}
              />
              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">
                  Corpus · {mainCorpusName}
                </span>
                <span className="font-medium text-white tabular-nums text-sm">
                  {formatKzt(corpusTotal)} ₸
                </span>
              </div>
            </div>

            {/* Facades */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "facades" ? null : "facades"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.08] border-r border-white/20 rounded-full transition-all duration-300 pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(12, (facadesTotal / currentPrice) * 100))}%` }}
              />
              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">
                  Facades · {mainFacadeName}
                </span>
                <span className="font-medium text-white tabular-nums text-sm">
                  {formatKzt(facadesTotal)} ₸
                </span>
              </div>
            </div>

            {/* Hardware */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "hardware" ? null : "hardware"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.08] border-r border-white/20 rounded-full transition-all duration-300 pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(12, (hardwareTotal / currentPrice) * 100))}%` }}
              />
              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">
                  Hardware · {mainHardwareName}
                </span>
                <span className="font-medium text-white tabular-nums text-sm">
                  {formatKzt(hardwareTotal)} ₸
                </span>
              </div>
            </div>

            {/* Раскрывающийся состав Hardware с переключением Blum ⇄ Boyard */}
            {expandedCapsule === "hardware" && (
              <div className="rounded-3xl bg-[#141418]/90 border border-white/[0.07] backdrop-blur-xl p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Фурнитурная комплектация</span>
                  <button
                    type="button"
                    onClick={() => void handleApplyPreset("swap_hardware")}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline"
                  >
                    {hasBlum ? "⇄ Сменить на Boyard" : "⇄ Сменить на Blum"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {lines
                    .filter((l) => l.category === "hardware")
                    .map((l) => (
                      <div key={l.id} className="flex justify-between text-zinc-300">
                        <span className="truncate mr-2">{l.name} ({l.qty} шт)</span>
                        <span className="font-mono tabular-nums">{formatKzt(l.qty * l.unit_price)} ₸</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Countertop */}
            <div
              onClick={() => setExpandedCapsule((p) => (p === "countertop" ? null : "countertop"))}
              className="relative overflow-hidden rounded-full min-h-[58px] px-6 py-3.5 bg-[#121215] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer flex items-center justify-between shadow-lg"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.08] border-r border-white/20 rounded-full transition-all duration-300 pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(12, (countertopTotal / currentPrice) * 100))}%` }}
              />
              <div className="relative z-10 flex items-center justify-between w-full text-xs">
                <span className="font-medium text-zinc-200">
                  Countertop · {mainCountertopName}
                </span>
                <span className="font-medium text-white tabular-nums text-sm">
                  {formatKzt(countertopTotal || 238000)} ₸
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. Чипы быстрых сценариев (Scenario Chips) */}
      <div className="mt-8 flex items-center justify-center gap-3">
        {viewMode === "deal" ? (
          <>
            <button
              type="button"
              onClick={() => void handleApplyPreset("min_margin")}
              className="rounded-full bg-[#16161a] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white px-4 py-2 text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              Min Margin 12%
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset("reset")}
              className="rounded-full bg-[#16161a] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white px-4 py-2 text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              Reset to {(recommendedPrice / 1000000).toFixed(2)}M
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleApplyPreset("swap_hardware")}
              className="rounded-full bg-[#16161a] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white px-4 py-2 text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              Blum ⇄ Boyard
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset("discount_5")}
              className="rounded-full bg-[#16161a] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white px-4 py-2 text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              Discount -5%
            </button>
          </>
        )}
      </div>

      {/* 6. Нижний командный бар (Command Bar) */}
      <div className="mt-auto pt-8">
        <div
          onClick={() => setIsQuickInputOpen(true)}
          className="rounded-full bg-[#16161a]/95 border border-white/[0.08] backdrop-blur-2xl px-5 py-3.5 text-xs text-zinc-400 flex items-center justify-between shadow-2xl hover:border-white/20 transition-all cursor-pointer"
        >
          <span className="truncate mr-3">
            {viewMode === "deal"
              ? "Fit into 1.35M without losing margin..."
              : "Ask or type: 3.6m, Blum, Enamel..."}
          </span>
          <span className="text-zinc-500 hover:text-zinc-300">🎙️</span>
        </div>

        {/* Выдвижная шторка быстрого добавления материала */}
        {isQuickInputOpen && (
          <div className="mt-3 rounded-3xl bg-[#18181c] border border-white/[0.1] p-4 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-semibold text-zinc-200">Быстрый поиск материала</span>
              <button
                type="button"
                onClick={() => {
                  setIsQuickInputOpen(false);
                  setQuickInput("");
                }}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Начните вводить: Egger, петли, профиль Gola..."
              className="mt-3 w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
            />

            <div className="flex flex-col gap-1.5 mt-2 max-h-48 overflow-y-auto">
              {priceItems
                .filter((p) => p.name.toLowerCase().includes(quickInput.toLowerCase()))
                .slice(0, 5)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onStepPriceItem(p, 1, null);
                      setQuickInput("");
                      setIsQuickInputOpen(false);
                    }}
                    className="flex items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-zinc-800/80 text-zinc-200 cursor-pointer transition-colors"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-emerald-400 font-bold shrink-0 ml-2 font-mono">
                      +{formatKzt(p.price)} ₸
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
