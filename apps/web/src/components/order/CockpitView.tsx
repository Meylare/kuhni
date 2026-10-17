import { useMemo, useState, useEffect } from "react";
import { formatKzt } from "../../lib/money";
import { getMarginColor } from "../../lib/margin-colors";
import {
  CATEGORY_LABELS,
  type Order,
  type OrderItem,
  type OrderLine,
  type OrderAdjustment,
  type PriceCategory,
  type PriceItem,
} from "../../types/database";
import type { ParametersMap } from "../../lib/parameters";
import { getOrderLineCalculation, type OrderDisplayCalculation } from "../../lib/orders";
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
  onOpenApplyTemplate?: () => void;
  onOpenSaveAsTemplate?: () => void;
  onBack: () => void;
  onToggleTableMode?: () => void;
}

interface CatalogGroupDef {
  id: string;
  title: string;
  subtitle: string;
  categories: PriceCategory[];
  dotClass: string;
}

const CATALOG_GROUPS: CatalogGroupDef[] = [
  {
    id: "materials",
    title: "Плитные материалы",
    subtitle: "ЛДСП Egger, ХДФ, столешницы, кромка",
    categories: ["materials"],
    dotClass: "bg-zinc-100",
  },
  {
    id: "facades",
    title: "Фасады и панели",
    subtitle: "МДФ в эмали, AGT, шпон, витрины",
    categories: ["facades"],
    dotClass: "bg-emerald-400",
  },
  {
    id: "hardware",
    title: "Фурнитура и механизмы",
    subtitle: "Петли, ящики Blum / Boyard, подъёмники",
    categories: ["hardware"],
    dotClass: "bg-sky-400",
  },
  {
    id: "workshop",
    title: "Цех и производство",
    subtitle: "Распил, кромление, присадка, ЧПУ",
    categories: ["workshop", "technolog"],
    dotClass: "bg-amber-400",
  },
  {
    id: "assembly",
    title: "Сборка и монтаж",
    subtitle: "Цеховая сборка, выездной монтаж",
    categories: ["assembly", "labor"],
    dotClass: "bg-purple-400",
  },
  {
    id: "other",
    title: "Логистика и прочее",
    subtitle: "Доставка, подъём, упаковка, доп. позиции",
    categories: ["transport", "other"],
    dotClass: "bg-zinc-500",
  },
];

function lineEffectiveCost(line: OrderLine): number {
  return getOrderLineCalculation(line).total;
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
  onOpenApplyTemplate,
  onOpenSaveAsTemplate,
  onBack,
}: CockpitViewProps) {
  const [viewMode, setViewMode] = useState<"deal" | "client">("deal");
  const [expandedSection, setExpandedSection] = useState<string | null>("materials");

  // Меню и шторки
  const [isOrderMenuOpen, setIsOrderMenuOpen] = useState(false);
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState("");
  const [inspectingLineId, setInspectingLineId] = useState<string | null>(null);

  // Каталог добавления с выбором категории сначала (Category-First)
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [selectedAddGroupId, setSelectedAddGroupId] = useState<string | null>(null);
  const [selectedAddSupplier, setSelectedAddSupplier] = useState<string>("all");
  const [quickQuery, setQuickQuery] = useState("");

  // Никаких фейковых дефолтных чисел: если заказ пустой, цена = 0 ₸
  const recommendedPrice = useMemo(() => {
    if (lines.length === 0) return 0;
    return displayCalc?.priceTotal ?? 0;
  }, [displayCalc, lines.length]);

  const costTotal = useMemo(() => {
    if (lines.length === 0) return 0;
    return displayCalc?.costTotal ?? 0;
  }, [displayCalc, lines.length]);

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

  const marginPctString =
    currentPrice > 0 ? `${(marginPct * 100).toFixed(1).replace(/\.0$/, "")}%` : "0%";
  const marginColor = getMarginColor(marginPct, 0.28);
  const accentColor =
    currentPrice === 0
      ? "#52525b"
      : marginColor.status === "success"
      ? "#10b981"
      : marginColor.status === "warning"
      ? "#f59e0b"
      : marginColor.status === "danger"
      ? "#ef4444"
      : "#a1a1aa";

  const totalLinearMeters = useMemo(() => {
    const sum = items.reduce((acc, it) => acc + (it.linear_meters || 0), 0);
    return sum > 0 ? sum.toFixed(2).replace(/\.00$/, "") : null;
  }, [items]);

  // Точная группировка всех строк и расчётных статей
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

    const assemblyCost = lines.length > 0 ? Math.round(displayCalc?.assembly || 0) : 0;
    const technologCost = lines.length > 0 ? Math.round(displayCalc?.technolog || 0) : 0;
    const riskReserveCost = lines.length > 0 ? Math.round(displayCalc?.riskReserve || 0) : 0;

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

  const inspectingLine = useMemo(
    () => lines.find((l) => l.id === inspectingLineId) || null,
    [lines, inspectingLineId]
  );

  const replacementCandidates = useMemo(() => {
    if (!inspectingLine) return [];
    return priceItems
      .filter(
        (p) =>
          p.active &&
          p.category === inspectingLine.category &&
          p.id !== inspectingLine.price_item_id
      )
      .slice(0, 6);
  }, [inspectingLine, priceItems]);

  const handleApplyPreset = async (
    type: "min_margin" | "reset" | "discount_5" | "swap_hardware"
  ) => {
    if (locked) return;
    if (type === "min_margin") {
      const minPrice = Math.round(costTotal / (1 - 0.12) / 10000) * 10000;
      setCurrentPrice(minPrice);
      setCustomPriceInput(String(minPrice));
      await onUpdateContractPrice(minPrice);
    } else if (type === "reset") {
      setCurrentPrice(recommendedPrice);
      setCustomPriceInput(String(recommendedPrice));
      await onUpdateContractPrice(null);
    } else if (type === "discount_5") {
      const p = Math.round((recommendedPrice * 0.95) / 10000) * 10000;
      setCurrentPrice(p);
      setCustomPriceInput(String(p));
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

  const handleReplaceLineItem = (line: OrderLine, newPriceItem: PriceItem) => {
    if (locked) return;
    onStepLineQty(line.id, -line.qty);
    onStepPriceItem(newPriceItem, line.qty, line.order_item_id);
    setInspectingLineId(null);
  };

  // Доли для тонкой полосы структуры цены
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

  // Активные позиции каталога для шторки выбора
  const activeCatalogItems = useMemo(
    () => priceItems.filter((p) => p.active),
    [priceItems]
  );

  const selectedAddGroup = useMemo(
    () => CATALOG_GROUPS.find((g) => g.id === selectedAddGroupId) || null,
    [selectedAddGroupId]
  );

  // Поставщики внутри выбранной категории
  const addGroupSuppliers = useMemo(() => {
    if (!selectedAddGroup) return [];
    const itemsInGroup = activeCatalogItems.filter((p) =>
      selectedAddGroup.categories.includes(p.category)
    );
    const set = new Set<string>();
    for (const it of itemsInGroup) {
      if (it.supplier && it.supplier.trim()) {
        set.add(it.supplier.trim());
      }
    }
    return Array.from(set);
  }, [activeCatalogItems, selectedAddGroup]);

  // Отфильтрованные позиции внутри шторки добавления
  const filteredAddCatalog = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    let list = activeCatalogItems;

    if (selectedAddGroup) {
      list = list.filter((p) => selectedAddGroup.categories.includes(p.category));
      if (selectedAddSupplier !== "all") {
        list = list.filter((p) => (p.supplier || "").trim() === selectedAddSupplier);
      }
    }

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.supplier || "").toLowerCase().includes(q) ||
          CATEGORY_LABELS[p.category].toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeCatalogItems, selectedAddGroup, selectedAddSupplier, quickQuery]);

  // Карта уже добавленных в заказ позиций по price_item_id
  const orderLineByPriceItemId = useMemo(() => {
    const map = new Map<string, OrderLine>();
    for (const l of lines) {
      if (l.price_item_id && !map.has(l.price_item_id)) {
        map.set(l.price_item_id, l);
      }
    }
    return map;
  }, [lines]);

  const openAddSheet = (initialGroupId: string | null = null) => {
    setQuickQuery("");
    setSelectedAddGroupId(initialGroupId);
    setSelectedAddSupplier("all");
    setIsAddSheetOpen(true);
  };

  const anySheetOpen =
    isOrderMenuOpen || isPriceSheetOpen || Boolean(inspectingLine) || isAddSheetOpen;

  // Ультра-чистая строка позиции
  const renderLineRow = (l: OrderLine, idx: number) => {
    const totalLine = lineEffectiveCost(l);
    return (
      <div
        key={l.id}
        style={{ animationDelay: `${idx * 40}ms` }}
        className="apple-unfold-row flex items-center justify-between gap-3 py-3 border-b border-white/[0.04] last:border-b-0"
      >
        <button
          type="button"
          onClick={() => setInspectingLineId(l.id)}
          className="flex-1 min-w-0 text-left group cursor-pointer"
        >
          <div className="text-[14px] font-normal text-zinc-100 group-hover:text-white truncate transition-colors">
            {l.name}
          </div>
          <div className="mt-0.5 text-[12px] text-zinc-500 tabular-nums whitespace-nowrap">
            {formatKzt(totalLine)} ₸
          </div>
        </button>

        {viewMode === "deal" && !locked ? (
          <div className="inline-flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onStepLineQty(l.id, -1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white active:scale-90 transition-all cursor-pointer"
              aria-label="Уменьшить"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <span className="min-w-[28px] text-center text-[13px] font-medium text-white tabular-nums whitespace-nowrap">
              {l.qty}
            </span>
            <button
              type="button"
              onClick={() => onStepLineQty(l.id, 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white active:scale-90 transition-all cursor-pointer"
              aria-label="Увеличить"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-[13px] font-medium text-zinc-300 tabular-nums whitespace-nowrap shrink-0">
            {l.qty} {l.unit}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className={`mx-auto w-full max-w-lg px-5 pt-4 pb-28 sm:py-8 flex flex-col min-h-svh text-zinc-100 select-none ${
          anySheetOpen ? "apple-stage-recessed" : "apple-stage-normal"
        }`}
      >
        {/* 1. Навигационная шапка */}
        <header className="flex items-center justify-between py-2 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 -ml-1.5 px-1.5 py-1 text-[15px] font-normal text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Сделки</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "deal" ? "client" : "deal"))}
              className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === "client"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-white/[0.05] text-zinc-300 hover:text-white hover:bg-white/[0.09]"
              }`}
              title={viewMode === "deal" ? "Скрыть маржу (режим клиента)" : "Вернуться в режим сделки"}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {viewMode === "deal" ? (
                  <>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </>
                )}
              </svg>
              <span>{viewMode === "client" ? "Клиент" : "Вид"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOrderMenuOpen(true)}
              className="h-8 w-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
              aria-label="Меню заказа"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="19" cy="12" r="1.75" />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. Заголовок заказа и Главная цена */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 whitespace-nowrap max-w-full">
            <span className="truncate max-w-[240px]">{order.name}</span>
            {order.client_label && (
              <>
                <span>·</span>
                <span className="truncate max-w-[140px]">{order.client_label}</span>
              </>
            )}
            {totalLinearMeters && (
              <>
                <span>·</span>
                <span>{totalLinearMeters} м</span>
              </>
            )}
            {discountPct !== 0 && (
              <>
                <span>·</span>
                <span className={discountPct < 0 ? "text-amber-400" : "text-emerald-400"}>
                  {discountPct > 0 ? `+${discountPct}%` : `${discountPct}%`}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!locked && viewMode === "deal") {
                setCustomPriceInput(currentPrice > 0 ? String(currentPrice) : "");
                setIsPriceSheetOpen(true);
              }
            }}
            className="mt-2 group inline-flex items-baseline justify-center cursor-pointer focus:outline-hidden"
            title="Нажмите для настройки цены договора"
          >
            <span className="text-[48px] sm:text-[56px] leading-[1.04] font-semibold tracking-[-0.035em] text-white tabular-nums group-active:scale-[0.98] transition-transform">
              {formatKzt(currentPrice)}
            </span>
            <span className="ml-2 text-[32px] font-light text-zinc-500">₸</span>
          </button>

          {/* Подстрочник статуса */}
          <div className="mt-2.5 flex items-center gap-2 text-[13px] text-zinc-400 tabular-nums whitespace-nowrap">
            {lines.length === 0 ? (
              <span className="text-zinc-500">Пустой проект · добавьте позиции или шаблон</span>
            ) : viewMode === "deal" ? (
              <>
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <span>
                  Маржа <strong className="font-medium text-white">{marginPctString}</strong>
                </span>
                <span className="text-zinc-600">·</span>
                <span>Себест. {formatKzt(costTotal)} ₸</span>
              </>
            ) : (
              <span>Индивидуальный проект · Гарантия 24 мес.</span>
            )}
          </div>
        </div>

        {/* ЕСЛИ ЗАКАЗ ПУСТОЙ — ЧИСТЫЙ ЭКРАН СТАРТА ПРОЕКТА */}
        {lines.length === 0 ? (
          <div className="border-t border-white/[0.08] pt-8 pb-6 flex flex-col items-center text-center">
            <div className="h-11 w-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 mb-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-[16px] font-medium text-white">
              Смета заказа пуста
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500 max-w-xs leading-relaxed">
              Выберите материалы по категориям из прайс-листа или загрузите готовый шаблон комплектации.
            </p>

            {!locked && (
              <div className="mt-6 w-full flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => openAddSheet(null)}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-[14px] hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span>Выбрать из каталога по категориям</span>
                </button>

                {onOpenApplyTemplate && (
                  <button
                    type="button"
                    onClick={onOpenApplyTemplate}
                    className="w-full h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-200 font-medium text-[13px] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                    <span>Заполнить из шаблона комплектации</span>
                  </button>
                )}
              </div>
            )}

            {/* Быстрый вход сразу в нужную категорию */}
            {!locked && (
              <div className="mt-8 w-full text-left">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">
                  Категории каталога
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {CATALOG_GROUPS.map((grp) => {
                    const count = activeCatalogItems.filter((p) =>
                      grp.categories.includes(p.category)
                    ).length;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => openAddSheet(grp.id)}
                        className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-left transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`h-2 w-2 rounded-full ${grp.dotClass}`} />
                          <span className="text-[11px] text-zinc-500 tabular-nums">{count}</span>
                        </div>
                        <div className="text-[13px] font-medium text-zinc-100 group-hover:text-white truncate">
                          {grp.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {grp.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 3. Единая мульти-сегментная полоса структуры цены */}
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
                  style={{ width: `${Math.max(8, materialsShare)}%` }}
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

            {/* 4. Четыре чистые строки категорий */}
            <div className="border-t border-white/[0.08] divide-y divide-white/[0.08]">
              {/* СЕКЦИЯ 1: ПРИБЫЛЬ */}
              {viewMode === "deal" && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSection((p) => (p === "profit" ? null : "profit"))
                    }
                    className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: accentColor }}
                      />
                      <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                        Прибыль
                      </span>
                      <span className="text-[13px] text-zinc-500 tabular-nums">
                        {marginPctString}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                      <span
                        className="text-[16px] font-medium tabular-nums"
                        style={{ color: netProfit >= 0 ? "#ffffff" : "#f87171" }}
                      >
                        {formatKzt(netProfit)} ₸
                      </span>
                      <svg
                        className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                          expandedSection === "profit" ? "rotate-90 text-zinc-200" : ""
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

                  <div
                    className="apple-accordion-grid"
                    data-open={expandedSection === "profit"}
                  >
                    <div className="apple-accordion-inner">
                      {expandedSection === "profit" && (
                        <div className="pb-4 pl-5 ml-1 relative space-y-2.5 text-[13px]">
                          <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-emerald-400/40 via-white/10 to-transparent" />
                          <div
                            style={{ animationDelay: "0ms" }}
                            className="apple-unfold-row flex items-center justify-between py-1"
                          >
                            <span className="text-zinc-400">Цена для клиента</span>
                            <span className="font-medium text-white tabular-nums whitespace-nowrap">
                              {formatKzt(currentPrice)} ₸
                            </span>
                          </div>
                          <div
                            style={{ animationDelay: "40ms" }}
                            className="apple-unfold-row flex items-center justify-between py-1"
                          >
                            <span className="text-zinc-400">Полная себестоимость</span>
                            <span className="font-medium text-zinc-300 tabular-nums whitespace-nowrap">
                              −{formatKzt(costTotal)} ₸
                            </span>
                          </div>
                          <div
                            style={{ animationDelay: "80ms" }}
                            className="apple-unfold-row flex items-center justify-between pt-2 border-t border-white/[0.05]"
                          >
                            <span className="text-zinc-300">Чистый остаток</span>
                            <span className="font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                              +{formatKzt(netProfit)} ₸
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* СЕКЦИЯ 2: МАТЕРИАЛЫ */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSection((p) => (p === "materials" ? null : "materials"))
                  }
                  className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-100 shrink-0" />
                    <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                      Материалы
                    </span>
                    <span className="text-[13px] text-zinc-500 tabular-nums">
                      {breakdown.materialLines.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                    <span className="text-[16px] font-medium text-white tabular-nums">
                      {formatKzt(breakdown.materialsSum)} ₸
                    </span>
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                        expandedSection === "materials" ? "rotate-90 text-zinc-200" : ""
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

                <div
                  className="apple-accordion-grid"
                  data-open={expandedSection === "materials"}
                >
                  <div className="apple-accordion-inner">
                    {expandedSection === "materials" && (
                      <div className="pb-4 pl-5 ml-1 relative">
                        <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
                        {breakdown.materialLines.length === 0 ? (
                          <div className="py-2 flex items-center justify-between text-[13px] text-zinc-500">
                            <span>Нет плитных материалов и фасадов</span>
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => openAddSheet("materials")}
                                className="text-zinc-300 hover:text-white underline underline-offset-4 cursor-pointer"
                              >
                                + Добавить
                              </button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {breakdown.materialLines.map((l, i) => renderLineRow(l, i))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* СЕКЦИЯ 3: ФУРНИТУРА */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSection((p) => (p === "hardware" ? null : "hardware"))
                  }
                  className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-400 shrink-0" />
                    <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                      Фурнитура
                    </span>
                    <span className="text-[13px] text-zinc-500">
                      {breakdown.hardwareLines.length > 0
                        ? hasBlum
                          ? "Blum"
                          : "Boyard"
                        : "0"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                    <span className="text-[16px] font-medium text-white tabular-nums">
                      {formatKzt(breakdown.hardwareSum)} ₸
                    </span>
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                        expandedSection === "hardware" ? "rotate-90 text-zinc-200" : ""
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

                <div
                  className="apple-accordion-grid"
                  data-open={expandedSection === "hardware"}
                >
                  <div className="apple-accordion-inner">
                    {expandedSection === "hardware" && (
                      <div className="pb-4 pl-5 ml-1 relative">
                        <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
                        {breakdown.hardwareLines.length === 0 ? (
                          <div className="py-2 flex items-center justify-between text-[13px] text-zinc-500">
                            <span>Позиции фурнитуры не добавлены</span>
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => openAddSheet("hardware")}
                                className="text-zinc-300 hover:text-white underline underline-offset-4 cursor-pointer"
                              >
                                + Добавить
                              </button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {breakdown.hardwareLines.map((l, i) => renderLineRow(l, i))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* СЕКЦИЯ 4: РАБОТА И ЦЕХ */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSection((p) => (p === "workshop" ? null : "workshop"))
                  }
                  className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-600 shrink-0" />
                    <span className="text-[16px] font-medium text-white tracking-[-0.01em]">
                      Работа и цех
                    </span>
                    <span className="text-[13px] text-zinc-500 tabular-nums">
                      {currentPrice > 0
                        ? `${Math.round((breakdown.operationsTotal / currentPrice) * 100)}%`
                        : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                    <span className="text-[16px] font-medium text-white tabular-nums">
                      {formatKzt(breakdown.operationsTotal)} ₸
                    </span>
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                        expandedSection === "workshop" ? "rotate-90 text-zinc-200" : ""
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

                <div
                  className="apple-accordion-grid"
                  data-open={expandedSection === "workshop"}
                >
                  <div className="apple-accordion-inner">
                    {expandedSection === "workshop" && (
                      <div className="pb-4 pl-5 ml-1 relative divide-y divide-white/[0.04]">
                        <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
                        <div
                          style={{ animationDelay: "0ms" }}
                          className="apple-unfold-row flex items-center justify-between py-2.5"
                        >
                          <span className="text-[14px] text-zinc-200 truncate pr-3">
                            Сборка и монтаж{totalLinearMeters ? ` (${totalLinearMeters} м)` : ""}
                          </span>
                          <span className="text-[14px] font-medium text-zinc-200 tabular-nums whitespace-nowrap">
                            {formatKzt(breakdown.assemblyCost)} ₸
                          </span>
                        </div>

                        <div
                          style={{ animationDelay: "40ms" }}
                          className="apple-unfold-row flex items-center justify-between py-2.5"
                        >
                          <span className="text-[14px] text-zinc-200 truncate pr-3">
                            Технолог и Базис
                          </span>
                          <span className="text-[14px] font-medium text-zinc-200 tabular-nums whitespace-nowrap">
                            {formatKzt(breakdown.technologCost)} ₸
                          </span>
                        </div>

                        {breakdown.riskReserveCost > 0 && (
                          <div
                            style={{ animationDelay: "80ms" }}
                            className="apple-unfold-row flex items-center justify-between py-2.5"
                          >
                            <span className="text-[14px] text-zinc-200 truncate pr-3">
                              Технологический резерв
                            </span>
                            <span className="text-[14px] font-medium text-zinc-200 tabular-nums whitespace-nowrap">
                              {formatKzt(breakdown.riskReserveCost)} ₸
                            </span>
                          </div>
                        )}

                        {breakdown.workshopLines.map((l, i) => renderLineRow(l, i + 3))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Кнопки добавления и План/Факт внизу списка */}
            {viewMode === "deal" && !locked && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openAddSheet(null)}
                  className="inline-flex items-center gap-2 text-[14px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer py-1"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-white">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>Добавить позицию</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectStage(currentStage === "fact" ? "quote" : "fact")}
                  className="text-[13px] font-normal text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  План / Факт →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* =====================================================================
          МЕНЮ 1: КОНТЕКСТНОЕ МЕНЮ ЗАКАЗА (Dynamic Island Popover •••)
          ===================================================================== */}
      {isOrderMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-14 bg-black/50 backdrop-blur-md"
          onClick={() => setIsOrderMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-island-popover apple-glass-glint w-72 rounded-[20px] bg-[#16161a]/95 border border-white/[0.12] shadow-2xl p-1.5 text-zinc-100"
          >
            <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Управление заказом
              </div>
              <div className="text-[13px] font-medium text-white truncate mt-0.5">
                {order.name}
              </div>
            </div>

            <div className="divide-y divide-white/[0.06]">
              <div className="py-1">
                <button
                  type="button"
                  style={{ animationDelay: "25ms" }}
                  onClick={() => {
                    setIsOrderMenuOpen(false);
                    onSelectStage("fact");
                  }}
                  className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-zinc-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <span>План / Факт и оплаты</span>
                  <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  style={{ animationDelay: "50ms" }}
                  onClick={() => {
                    setIsOrderMenuOpen(false);
                    setCustomPriceInput(currentPrice > 0 ? String(currentPrice) : "");
                    setIsPriceSheetOpen(true);
                  }}
                  className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-zinc-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <span>Изменить цену договора</span>
                  <span className="text-[12px] text-zinc-400 font-mono">₸</span>
                </button>

                {lines.length > 0 && (
                  <button
                    type="button"
                    style={{ animationDelay: "75ms" }}
                    onClick={() => {
                      setIsOrderMenuOpen(false);
                      void handleApplyPreset("swap_hardware");
                    }}
                    className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-zinc-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                  >
                    <span>Фурнитура: {hasBlum ? "на Boyard" : "на Blum"}</span>
                    <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Шаблоны комплектаций */}
              {(onOpenApplyTemplate || onOpenSaveAsTemplate) && (
                <div className="py-1">
                  {onOpenApplyTemplate && !locked && (
                    <button
                      type="button"
                      style={{ animationDelay: "100ms" }}
                      onClick={() => {
                        setIsOrderMenuOpen(false);
                        onOpenApplyTemplate();
                      }}
                      className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-zinc-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                    >
                      <span>Заполнить из шаблона</span>
                      <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    </button>
                  )}

                  {onOpenSaveAsTemplate && lines.length > 0 && (
                    <button
                      type="button"
                      style={{ animationDelay: "125ms" }}
                      onClick={() => {
                        setIsOrderMenuOpen(false);
                        onOpenSaveAsTemplate();
                      }}
                      className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-zinc-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                    >
                      <span>Сохранить смету как шаблон</span>
                      <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              <div className="py-1">
                <button
                  type="button"
                  style={{ animationDelay: "150ms" }}
                  onClick={() => {
                    setIsOrderMenuOpen(false);
                    onSaveCalculation();
                  }}
                  className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-emerald-400 hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <span>Зафиксировать версию</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  style={{ animationDelay: "175ms" }}
                  onClick={() => {
                    setIsOrderMenuOpen(false);
                    onOpenVersionsModal();
                  }}
                  className="apple-menu-item w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-[14px] text-zinc-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <span>История версий сметы</span>
                  <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          МЕНЮ 2: НАСТРОЙКА ЦЕНЫ ДОГОВОРА (VisionOS Spatial Sheet)
          ===================================================================== */}
      {isPriceSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setIsPriceSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-spatial-sheet apple-glass-glint w-full max-w-md rounded-t-[24px] sm:rounded-[24px] bg-[#141418] border-t sm:border border-white/[0.12] p-6 pb-8 text-zinc-100 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block">
                  Стоимость для клиента
                </span>
                <h3 className="text-[17px] font-semibold text-white mt-0.5">
                  Настройка цены договора
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPriceSheetOpen(false)}
                className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = Number(customPriceInput.replace(/\s+/g, ""));
                if (Number.isFinite(parsed) && parsed > 0) {
                  setCurrentPrice(parsed);
                  void onUpdateContractPrice(parsed);
                  setIsPriceSheetOpen(false);
                }
              }}
              className="mt-5 space-y-5"
            >
              <div style={{ animationDelay: "30ms" }} className="apple-menu-item">
                <label className="block text-[12px] text-zinc-400 mb-1.5">
                  Своя цена договора (₸)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                  placeholder="Например: 1 450 000"
                  className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.12] px-4 text-[22px] font-semibold text-white tabular-nums focus:outline-hidden focus:border-white/35"
                />
              </div>

              {recommendedPrice > 0 && (
                <div
                  style={{ animationDelay: "70ms" }}
                  className="apple-menu-item divide-y divide-white/[0.06] border-y border-white/[0.07]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      void handleApplyPreset("reset");
                      setIsPriceSheetOpen(false);
                    }}
                    className="w-full py-3 flex items-center justify-between text-[13px] text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <span>Расчётная цена по нормативам</span>
                    <span className="font-medium text-white tabular-nums">
                      {formatKzt(recommendedPrice)} ₸
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleApplyPreset("discount_5");
                      setIsPriceSheetOpen(false);
                    }}
                    className="w-full py-3 flex items-center justify-between text-[13px] text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <span>Скидка клиенту −5%</span>
                    <span className="font-medium text-emerald-400 tabular-nums">
                      {formatKzt(Math.round((recommendedPrice * 0.95) / 10000) * 10000)} ₸
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleApplyPreset("min_margin");
                      setIsPriceSheetOpen(false);
                    }}
                    className="w-full py-3 flex items-center justify-between text-[13px] text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <span>Минимальный порог (маржа 12%)</span>
                    <span className="font-medium text-amber-400 tabular-nums">
                      {formatKzt(Math.round(costTotal / (1 - 0.12) / 10000) * 10000)} ₸
                    </span>
                  </button>
                </div>
              )}

              <button
                type="submit"
                style={{ animationDelay: "110ms" }}
                className="apple-menu-item w-full h-11 rounded-xl bg-white text-black font-semibold text-[14px] hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer"
              >
                Применить цену
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          МЕНЮ 3: КАРТОЧКА ПОЗИЦИИ (Детали, замена аналогом, удаление)
          ===================================================================== */}
      {inspectingLine && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setInspectingLineId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-spatial-sheet apple-glass-glint w-full max-w-md rounded-t-[24px] sm:rounded-[24px] bg-[#141418] border-t sm:border border-white/[0.12] p-6 pb-8 text-zinc-100 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.07]">
              <div className="min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block">
                  Параметры позиции
                </span>
                <h3 className="text-[16px] font-semibold text-white mt-0.5 leading-snug">
                  {inspectingLine.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLineId(null)}
                className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-white/[0.06]">
              <div
                style={{ animationDelay: "30ms" }}
                className="apple-menu-item py-4 space-y-2 text-[13px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Цена за единицу ({inspectingLine.unit})</span>
                  <span className="text-zinc-200 tabular-nums">
                    {formatKzt(inspectingLine.unit_price)} ₸
                  </span>
                </div>
                {inspectingLine.waste_pct > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Плановый отход</span>
                    <span className="text-emerald-400 tabular-nums">
                      +{Math.round(inspectingLine.waste_pct <= 1 ? inspectingLine.waste_pct * 100 : inspectingLine.waste_pct)}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <span className="text-zinc-300 font-medium">Сумма по позиции</span>
                  <span className="text-[16px] font-semibold text-white tabular-nums">
                    {formatKzt(lineEffectiveCost(inspectingLine))} ₸
                  </span>
                </div>
              </div>

              {!locked && replacementCandidates.length > 0 && (
                <div style={{ animationDelay: "70ms" }} className="apple-menu-item py-4">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block mb-2.5">
                    Заменить на аналог ({inspectingLine.qty} {inspectingLine.unit})
                  </span>
                  <div className="divide-y divide-white/[0.05]">
                    {replacementCandidates.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => handleReplaceLineItem(inspectingLine, cand)}
                        className="w-full py-2.5 flex items-center justify-between text-left hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                      >
                        <span className="text-[13px] text-zinc-200 truncate pr-3">
                          {cand.name}
                        </span>
                        <span className="text-[12px] text-zinc-400 tabular-nums whitespace-nowrap shrink-0">
                          {formatKzt(cand.price)} ₸/{cand.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!locked && (
                <div style={{ animationDelay: "110ms" }} className="apple-menu-item pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteLine(inspectingLine.id);
                      setInspectingLineId(null);
                    }}
                    className="w-full h-10 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[13px] font-medium transition-colors cursor-pointer"
                  >
                    Удалить позицию из сметы
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          МЕНЮ 4: ДОБАВЛЕНИЕ ПОЗИЦИИ ИЗ КАТАЛОГА (СНАЧАЛА ВЫБОР КАТЕГОРИИ)
          ===================================================================== */}
      {isAddSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setIsAddSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-spatial-sheet apple-glass-glint w-full max-w-lg rounded-t-[24px] sm:rounded-[24px] bg-[#141418] border-t sm:border border-white/[0.12] p-6 pb-6 text-zinc-100 shadow-2xl max-h-[86vh] flex flex-col"
          >
            {/* Шапка каталога */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
              <div className="flex items-center gap-2 min-w-0">
                {selectedAddGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddGroupId(null);
                      setSelectedAddSupplier("all");
                    }}
                    className="h-7 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[12px] font-medium text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <span>←</span>
                    <span>Категории</span>
                  </button>
                )}
                <h3 className="text-[16px] font-semibold text-white truncate">
                  {selectedAddGroup ? selectedAddGroup.title : "Каталог материалов"}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddSheetOpen(false);
                    onOpenPricePicker();
                  }}
                  className="text-[12px] text-zinc-400 hover:text-white cursor-pointer px-1.5"
                >
                  Таблица
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSheetOpen(false)}
                  className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Поиск */}
            <div className="relative flex items-center py-2.5 border-b border-white/[0.08]">
              <svg className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder={
                  selectedAddGroup
                    ? `Поиск в разделе «${selectedAddGroup.title}»…`
                    : "Быстрый поиск по всему каталогу (Egger, Blum, МДФ)…"
                }
                className="w-full bg-transparent text-[14px] text-white placeholder-zinc-500 focus:outline-hidden"
              />
              {quickQuery && (
                <button
                  type="button"
                  onClick={() => setQuickQuery("")}
                  className="text-zinc-500 hover:text-white text-xs px-1.5 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* ШАГ 1: Сетка категорий (показывается, когда не выбрана категория и пустой поиск) */}
            {!selectedAddGroup && !quickQuery.trim() ? (
              <div className="mt-4 overflow-y-auto flex-1 pr-0.5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">
                  Выберите категорию
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CATALOG_GROUPS.map((grp, idx) => {
                    const count = activeCatalogItems.filter((p) =>
                      grp.categories.includes(p.category)
                    ).length;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        style={{ animationDelay: `${idx * 30}ms` }}
                        onClick={() => {
                          setSelectedAddGroupId(grp.id);
                          setSelectedAddSupplier("all");
                        }}
                        className="apple-menu-item p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-left transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${grp.dotClass}`} />
                          <span className="text-[12px] font-medium text-zinc-400 group-hover:text-white tabular-nums">
                            {count} поз. →
                          </span>
                        </div>
                        <div>
                          <div className="text-[15px] font-medium text-white">
                            {grp.title}
                          </div>
                          <div className="text-[12px] text-zinc-500 mt-0.5 line-clamp-1">
                            {grp.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ШАГ 2: Позиции выбранной категории или результаты поиска */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Фильтр по бренду / поставщику внутри категории */}
                {selectedAddGroup && addGroupSuppliers.length > 1 && (
                  <div className="flex items-center gap-1.5 py-2.5 border-b border-white/[0.06] overflow-x-auto no-scrollbar shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedAddSupplier("all")}
                      className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        selectedAddSupplier === "all"
                          ? "bg-white text-black"
                          : "bg-white/[0.05] text-zinc-400 hover:text-white"
                      }`}
                    >
                      Все бренды
                    </button>
                    {addGroupSuppliers.map((sup) => (
                      <button
                        key={sup}
                        type="button"
                        onClick={() => setSelectedAddSupplier(sup)}
                        className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          selectedAddSupplier === sup
                            ? "bg-white text-black"
                            : "bg-white/[0.05] text-zinc-400 hover:text-white"
                        }`}
                      >
                        {sup}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-1 overflow-y-auto divide-y divide-white/[0.05] flex-1 pr-1">
                  {filteredAddCatalog.length === 0 ? (
                    <div className="py-12 text-center text-[13px] text-zinc-500">
                      Позиции не найдены
                    </div>
                  ) : (
                    filteredAddCatalog.map((p, i) => {
                      const existingLine = orderLineByPriceItemId.get(p.id);
                      return (
                        <div
                          key={p.id}
                          style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
                          className="apple-menu-item py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="text-[14px] text-zinc-100 truncate">
                              {p.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-zinc-500 tabular-nums">
                              <span>
                                {formatKzt(p.price)} ₸ / {p.unit}
                              </span>
                              {p.supplier && (
                                <>
                                  <span>·</span>
                                  <span className="text-zinc-400 truncate">{p.supplier}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {existingLine ? (
                            <div className="inline-flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onStepLineQty(existingLine.id, -1)}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-zinc-200 hover:bg-white/[0.15] cursor-pointer"
                              >
                                −
                              </button>
                              <span className="min-w-[26px] text-center text-[13px] font-semibold text-emerald-400 tabular-nums">
                                {existingLine.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => onStepLineQty(existingLine.id, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onStepPriceItem(p, 1, null)}
                              className="h-8 px-3 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-[12px] font-medium text-white flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                            >
                              <span>+</span>
                              <span>Добавить</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Нижняя кнопка закрытия шторки */}
            <div className="pt-3 mt-2 border-t border-white/[0.07] flex items-center justify-between">
              <span className="text-[12px] text-zinc-400 tabular-nums">
                В смете: <strong className="text-white">{lines.length}</strong> поз. ·{" "}
                <strong className="text-white">{formatKzt(currentPrice)} ₸</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsAddSheetOpen(false)}
                className="h-9 px-5 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
