import { useMemo, useState, useRef, useEffect, type TouchEvent, type MouseEvent } from "react";
import { formatKzt } from "../../lib/money";
import { formatPercent } from "../../lib/parameters";
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
  // Режим экрана: "deal" (для владельца: маржа, прибыль, линейка) | "client" (для показа заказчику: только солидные группы)
  const [viewMode, setViewMode] = useState<"deal" | "client">("deal");

  // Раскрытые капсулы категорий
  const [expandedCapsule, setExpandedCapsule] = useState<string | null>(null);

  // Быстрый поиск внизу
  const [quickInput, setQuickInput] = useState("");
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);

  // Рекомендуемая цена без скидки и себестоимость
  const recommendedPrice = useMemo(() => {
    return displayCalc?.priceTotal || 1480000;
  }, [displayCalc]);

  const costTotal = useMemo(() => {
    return displayCalc?.costTotal || 980000;
  }, [displayCalc]);

  // Текущая цена договора (или рекомендация, если договор не задан)
  const [currentPrice, setCurrentPrice] = useState<number>(() => {
    return order.contract_price ?? recommendedPrice;
  });

  // Синхронизация при внешнем изменении
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
  const discountPct = recommendedPrice > 0 && currentPrice < recommendedPrice
    ? Math.round(((recommendedPrice - currentPrice) / recommendedPrice) * 100)
    : 0;

  // Цвет кругового индикатора маржи
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
  const workshopAndTechTotal = categoryGroups.workshop.total + categoryGroups.technolog.total + (displayCalc?.technolog || 0);
  const materialsAndWasteTotal = categoryGroups.materials.total + categoryGroups.facades.total + categoryGroups.hardware.total;
  const laborAndLogisticsTotal = categoryGroups.transport.total + categoryGroups.labor.total + (displayCalc?.assembly || 0);

  // Заметные материалы для Client Mode
  const mainCorpusName = useMemo(() => {
    const l = lines.find((x) => x.category === "materials" && !x.name.includes("Столешница"));
    return l ? l.name.replace("ЛДСП ", "").replace("18мм ", "") : "Egger 18мм";
  }, [lines]);

  const mainFacadeName = useMemo(() => {
    const l = lines.find((x) => x.category === "facades");
    return l ? l.name.replace("МДФ ", "") : "MDF Soft-Touch";
  }, [lines]);

  const mainHardwareName = useMemo(() => {
    const hasBlum = lines.some((x) => x.category === "hardware" && x.name.toLowerCase().includes("blum"));
    if (hasBlum) return "Blum Austria";
    const hasBoyard = lines.some((x) => x.category === "hardware" && x.name.toLowerCase().includes("boyard"));
    if (hasBoyard) return "Boyard Pro";
    return "Фурнитура с доводчиками";
  }, [lines]);

  const mainCountertopName = useMemo(() => {
    const l = lines.find((x) => x.name.toLowerCase().includes("столешница") || x.name.toLowerCase().includes("кварц"));
    return l ? l.name.replace("Столешница ", "") : "Влагостойкая HPL";
  }, [lines]);

  // Линейка цен: диапазон от minMargin (10%) до basePrice + 15%
  const rulerMin = Math.max(100000, Math.floor((costTotal * 1.08) / 50000) * 50000);
  const rulerMax = Math.max(rulerMin + 200000, Math.ceil((recommendedPrice * 1.15) / 50000) * 50000);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  // Обновление цены при сдвиге линейки
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
  }, [isDraggingRuler, currentPrice, rulerMin, rulerMax]);

  // Пресеты в 1 клик
  const handleApplyPreset = async (type: "min_margin" | "reset" | "discount_5" | "discount_10" | "swap_hardware") => {
    if (locked) return;
    if (type === "min_margin") {
      const minPrice = Math.round((costTotal / (1 - 0.14)) / 10000) * 10000;
      setCurrentPrice(minPrice);
      await onUpdateContractPrice(minPrice);
    } else if (type === "reset") {
      setCurrentPrice(recommendedPrice);
      await onUpdateContractPrice(null);
    } else if (type === "discount_5") {
      const p = Math.round((recommendedPrice * 0.95) / 10000) * 10000;
      setCurrentPrice(p);
      await onUpdateContractPrice(p);
    } else if (type === "discount_10") {
      const p = Math.round((recommendedPrice * 0.9) / 10000) * 10000;
      setCurrentPrice(p);
      await onUpdateContractPrice(p);
    } else if (type === "swap_hardware") {
      // Быстрая смена Blum ⇄ Boyard
      const hasBlum = lines.some((l) => l.category === "hardware" && l.name.includes("Blum"));
      for (const line of lines.filter((l) => l.category === "hardware")) {
        if (hasBlum && line.name.includes("Blum")) {
          // Ищем аналог Boyard
          const boyardItem = priceItems.find((p) => p.name.includes("Boyard"));
          if (boyardItem) {
            onStepLineQty(line.id, -line.qty); // убираем Blum
            onStepPriceItem(boyardItem, line.qty, line.order_item_id);
          }
        } else if (!hasBlum && line.name.includes("Boyard")) {
          const blumItem = priceItems.find((p) => p.name.includes("Blum Clip Top"));
          if (blumItem) {
            onStepLineQty(line.id, -line.qty);
            onStepPriceItem(blumItem, line.qty, line.order_item_id);
          }
        }
      }
    }
  };

  // Позиция стрелочки на линейке (0..100%)
  const rulerRatio = Math.max(0, Math.min(100, ((currentPrice - rulerMin) / (rulerMax - rulerMin)) * 100));

  // Кольцо маржи SVG
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (Math.min(1, Math.max(0, marginPct / 0.4))) * ringCircumference;

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col min-h-[90vh] bg-[#09090b] text-white px-5 py-6 pb-28 select-none transition-colors">
      {/* 1. Верхний переключатель режимов (Deal Mode ⇄ Client Mode) */}
      <header className="flex items-center justify-between pb-6 text-xs font-semibold text-zinc-400">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer mr-1"
            title="Назад к заказам"
          >
            ←
          </button>
          <span
            className="h-2 w-2 rounded-full transition-colors shadow-xs"
            style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
          />
          <span className="tracking-wide text-zinc-200">
            {viewMode === "deal" ? "Deal Mode" : "Client View"}
          </span>
          {viewMode === "deal" && (
            <span className="text-[11px] text-zinc-500 font-mono">
              • {formatPercent(marginPct)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleTableMode && (
            <button
              type="button"
              onClick={onToggleTableMode}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Переключить в режим подробной таблицы"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Таблица</span>
            </button>
          )}

          {/* Кнопка переключения режима */}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "deal" ? "client" : "deal"))}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === "client"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "bg-zinc-800/70 text-zinc-400 border border-zinc-700/60 hover:text-white"
            }`}
          >
            <span>🔒</span>
            <span>{viewMode === "deal" ? "Hide Margin" : "Client Mode"}</span>
          </button>
        </div>
      </header>

      {/* Переключатель этапов: Смета / Договор / Факт */}
      <div className="mb-4 flex items-center justify-center gap-1 rounded-full bg-zinc-900/90 p-1 border border-zinc-800/80">
        <button
          type="button"
          onClick={() => onSelectStage("quote")}
          className={`flex-1 rounded-full py-1 text-center text-[11px] font-bold transition-all cursor-pointer ${
            currentStage === "quote"
              ? "bg-zinc-800 text-white shadow-xs"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          1. Смета
        </button>
        <button
          type="button"
          onClick={() => onSelectStage("contract")}
          className={`flex-1 rounded-full py-1 text-center text-[11px] font-bold transition-all cursor-pointer ${
            currentStage === "contract"
              ? "bg-zinc-800 text-white shadow-xs"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          2. Договор
        </button>
        <button
          type="button"
          onClick={() => onSelectStage("fact")}
          className={`flex-1 rounded-full py-1 text-center text-[11px] font-bold transition-all cursor-pointer ${
            currentStage === "fact"
              ? "bg-zinc-800 text-white shadow-xs"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          3. Факт
        </button>
      </div>

      {/* 2. Подзаголовок и гигантская сумма */}
      <div className="flex flex-col items-center justify-center text-center pt-2 pb-4">
        <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">
          {viewMode === "deal" ? (
            discountPct > 0 ? (
              <>
                CONTRACT PRICE · DISCOUNT{" "}
                <span className="text-amber-400">-{discountPct}%</span>
              </>
            ) : (
              "RECOMMENDED CONTRACT PRICE"
            )
          ) : (
            `ORDER #${order.name.slice(0, 10)} · ${totalLinearMeters} M`
          )}
        </span>

        {/* Главная цифра цены */}
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-white tabular-nums drop-shadow-sm">
          {formatKzt(currentPrice)} <span className="font-light text-zinc-300">₸</span>
        </h1>
      </div>

      {/* 3. Тактильная интерактивная линейка (Ruler Slider) */}
      <div className="mt-2 mb-6 px-1">
        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500 px-1 mb-1">
          <span>{(rulerMin / 1000000).toFixed(1)}M</span>
          <span>{((rulerMin + rulerMax) / 2000000).toFixed(1)}M</span>
          <span>{(rulerMax / 1000000).toFixed(1)}M</span>
        </div>

        {/* Шкала с делениями */}
        <div
          ref={rulerRef}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          className="relative h-10 w-full flex items-center justify-between px-2 cursor-pointer bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden active:border-zinc-700"
        >
          {/* Деления линейки */}
          <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none opacity-40">
            {Array.from({ length: 33 }).map((_, idx) => {
              const isMajor = idx % 8 === 0;
              const isMedium = idx % 4 === 0;
              return (
                <div
                  key={idx}
                  className={`w-[1px] bg-zinc-400 transition-all ${
                    isMajor ? "h-6 bg-zinc-200" : isMedium ? "h-4" : "h-2"
                  }`}
                />
              );
            })}
          </div>

          {/* Стрелка-индикатор текущей цены */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none transition-all duration-75 flex flex-col items-center justify-between"
            style={{ left: `${rulerRatio}%`, transform: "translateX(-50%)" }}
          >
            <div className="w-0.5 h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[10px] text-emerald-400 font-bold -mb-1">▲</span>
          </div>
        </div>
      </div>

      {/* 4. Пропорциональные капсульные бары (Capsule Progress Pills) */}
      <div className="flex flex-col gap-3">
        {viewMode === "deal" ? (
          <>
            {/* Net Profit Capsule */}
            <div className="relative overflow-hidden rounded-full border border-zinc-800 bg-zinc-900/80 p-1 shadow-sm backdrop-blur-md">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/15 via-emerald-500/25 to-emerald-400/30 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, marginPct * 100 * 2.2)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">Net Profit</span>
                  <span className="text-zinc-500 font-mono">• {formatPercent(marginPct)}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* SVG кольцо маржи */}
                  <div className="relative h-7 w-7 flex items-center justify-center">
                    <svg className="h-7 w-7 -rotate-90 transform">
                      <circle
                        cx="14"
                        cy="14"
                        r={ringRadius}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="2.5"
                        fill="transparent"
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
                        fill="transparent"
                        className="transition-all duration-500"
                      />
                    </svg>
                  </div>
                  <span className="font-bold text-white tabular-nums text-sm">
                    {formatKzt(netProfit)} ₸
                  </span>
                </div>
              </div>
            </div>

            {/* Workshop & Tech Capsule */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "workshop" ? null : "workshop"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/60 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (workshopAndTechTotal / currentPrice) * 100 * 1.5)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-300">Workshop & Tech</span>
                  <span className="text-zinc-500 font-mono">
                    • {formatPercent(currentPrice > 0 ? workshopAndTechTotal / currentPrice : 0)}
                  </span>
                </div>
                <span className="font-bold text-zinc-200 tabular-nums">
                  {formatKzt(workshopAndTechTotal)} ₸
                </span>
              </div>
            </div>

            {/* Materials & Waste Capsule */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "materials" ? null : "materials"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/70 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (materialsAndWasteTotal / currentPrice) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="font-semibold text-zinc-300">Materials & Waste</span>
                <span className="font-bold text-zinc-200 tabular-nums">
                  {formatKzt(materialsAndWasteTotal)} ₸
                </span>
              </div>
            </div>

            {/* Labor & Logistics Capsule */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "labor" ? null : "labor"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/40 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (laborAndLogisticsTotal / currentPrice) * 100 * 2)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="font-semibold text-zinc-300">Assembly & Delivery</span>
                <span className="font-bold text-zinc-200 tabular-nums">
                  {formatKzt(laborAndLogisticsTotal)} ₸
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Client Mode Grouped Capsules */
          <>
            {/* Corpus */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "corpus" ? null : "corpus"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/60 rounded-full transition-all duration-500"
                style={{ width: "45%" }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">Corpus</span>
                  <span className="text-zinc-500">• {mainCorpusName}</span>
                </div>
                <span className="font-bold text-white tabular-nums">
                  {formatKzt(categoryGroups.materials.total)} ₸
                </span>
              </div>
            </div>

            {/* Facades */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "facades" ? null : "facades"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/60 rounded-full transition-all duration-500"
                style={{ width: "55%" }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">Facades</span>
                  <span className="text-zinc-500">• {mainFacadeName}</span>
                </div>
                <span className="font-bold text-white tabular-nums">
                  {formatKzt(categoryGroups.facades.total)} ₸
                </span>
              </div>
            </div>

            {/* Hardware */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "hardware" ? null : "hardware"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/60 rounded-full transition-all duration-500"
                style={{ width: "35%" }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">Hardware</span>
                  <span className="text-zinc-500">• {mainHardwareName}</span>
                </div>
                <span className="font-bold text-white tabular-nums">
                  {formatKzt(categoryGroups.hardware.total)} ₸
                </span>
              </div>
            </div>

            {/* Countertop */}
            <div
              onClick={() => setExpandedCapsule((prev) => (prev === "countertop" ? null : "countertop"))}
              className="relative overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-md cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/60 rounded-full transition-all duration-500"
                style={{ width: "30%" }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">Countertop</span>
                  <span className="text-zinc-500">• {mainCountertopName}</span>
                </div>
                <span className="font-bold text-white tabular-nums">
                  {formatKzt(lines.filter((l) => l.name.includes("Столешница")).reduce((a, b) => a + b.qty * b.unit_price, 0) || 185000)} ₸
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Выпадающий список позиций при клике на капсулу */}
      {expandedCapsule && (
        <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3.5 text-xs backdrop-blur-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-2">
            <span className="font-bold text-zinc-300 capitalize">
              Позиции: {expandedCapsule}
            </span>
            <button
              type="button"
              onClick={() => setExpandedCapsule(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
            >
              ✕ закрыть
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {lines
              .filter((l) => {
                if (expandedCapsule === "corpus") return l.category === "materials" && !l.name.includes("Столешница");
                if (expandedCapsule === "facades") return l.category === "facades";
                if (expandedCapsule === "hardware") return l.category === "hardware";
                if (expandedCapsule === "countertop") return l.name.includes("Столешница");
                if (expandedCapsule === "materials") return l.category === "materials" || l.category === "facades";
                if (expandedCapsule === "workshop") return l.category === "workshop" || l.category === "technolog";
                if (expandedCapsule === "labor") return l.category === "transport" || l.category === "labor" || l.category === "assembly";
                return true;
              })
              .map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-800/50 p-2 border border-zinc-700/40 gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-200 truncate">{line.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {formatKzt(line.unit_price)} ₸ / {line.unit}
                    </div>
                  </div>

                  {!locked && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStepLineQty(line.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 font-bold active:scale-95 cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-bold text-white text-xs">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onStepLineQty(line.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 font-bold active:scale-95 cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLine(line.id)}
                        className="text-zinc-500 hover:text-rose-400 px-1 cursor-pointer"
                        title="Удалить строку"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 5. Быстрые сценарии в 1 клик (Scenario Pills) */}
      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        {viewMode === "deal" ? (
          <>
            <button
              type="button"
              onClick={() => void handleApplyPreset("min_margin")}
              className="rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
            >
              Min Margin 14%
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset("reset")}
              className="rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
            >
              Reset to {(recommendedPrice / 1000000).toFixed(2)}M
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset("discount_5")}
              className="rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
            >
              Discount -5%
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleApplyPreset("swap_hardware")}
              className="rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer flex items-center gap-1"
            >
              <span>Blum ⇄ Boyard</span>
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset("discount_5")}
              className="rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
            >
              Discount -5%
            </button>
          </>
        )}
      </div>

      {/* Кнопка сохранения версии сметы */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onSaveCalculation}
          className="flex items-center gap-2 rounded-full bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-xs cursor-pointer border border-zinc-700"
        >
          <span>💾 Зафиксировать версию</span>
        </button>
        <button
          type="button"
          onClick={onOpenVersionsModal}
          className="rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="История версий"
        >
          История версий
        </button>
      </div>

      {/* 6. Нижний смарт-док / быстрый ввод (Voice/Command Bar) */}
      <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-md z-40">
        <div className="flex items-center justify-between rounded-full border border-zinc-800/90 bg-zinc-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition-all focus-within:border-emerald-500/60">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onFocus={() => setIsQuickInputOpen(true)}
            placeholder={
              viewMode === "deal"
                ? "Fit into 1.35M without losing margin..."
                : "Ask or type: 3.6m, Blum, Enamel..."
            }
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={onOpenPricePicker}
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Открыть каталог материалов"
          >
            <span className="text-xs">⚡</span>
          </button>
        </div>

        {/* Быстрое автодополнение при вводе в док */}
        {isQuickInputOpen && quickInput.trim().length > 0 && (
          <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-xl text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-[11px] text-zinc-500 font-bold uppercase">
              <span>Каталог материалов:</span>
              <button
                type="button"
                onClick={() => {
                  setQuickInput("");
                  setIsQuickInputOpen(false);
                }}
                className="hover:text-zinc-300 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5 mt-2 max-h-40 overflow-y-auto">
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
                    className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-zinc-800 text-zinc-200 cursor-pointer transition-colors"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-emerald-400 font-bold shrink-0 ml-2">
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
