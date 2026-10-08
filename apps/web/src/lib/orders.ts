import {
  calculate,
  calculateLine,
  createCalculationVersion,
  type CalculationAdjustment,
  type CalculationInput,
  type CalculationLine,
  type CalculationOrderItem,
  type CalculationOutcome,
  type CalculationParameters,
  type CalculationSnapshotAdjustment,
  type CalculationSnapshotLine,
  type CalculationSnapshotOrderItem,
  type CostCategory,
  type LineCalculation,
} from "@kuhni/calc";

import type {
  BillableQtyRounding,
  Order,
  OrderAdjustment,
  OrderCalculation,
  OrderCalculationSummary,
  OrderItem,
  OrderItemKind,
  OrderLine,
  OrderStatus,
  OrderWithCalculations,
  PriceCategory,
  PriceItem,
} from "../types/database";
import type { ParametersMap } from "./parameters";

/**
 * Возвращает последний расчёт заказа (с наибольшим номером версии).
 */
export function getLatestCalculation(
  order: OrderWithCalculations,
): OrderCalculationSummary | null {
  if (!order.calculations || order.calculations.length === 0) {
    return null;
  }
  return [...order.calculations].sort((a, b) => b.version - a.version)[0] ?? null;
}

/**
 * Выбирает базовую (опорную) версию расчёта для сравнения План/Факт (Step A5, Q3):
 * 1. Если есть версия с отметкой договора (is_contract_baseline = true), возвращает её.
 * 2. Если договорная версия не отмечена, возвращает последнюю сохранённую версию (по номеру версии).
 * 3. Если версий нет, возвращает null.
 */
export function getPlanCalculation<
  T extends { version: number; is_contract_baseline?: boolean }
>(calculations: T[] | null | undefined): T | null {
  if (!calculations || calculations.length === 0) {
    return null;
  }
  const baseline = calculations.find((c) => Boolean(c.is_contract_baseline));
  if (baseline) {
    return baseline;
  }
  return [...calculations].sort((a, b) => b.version - a.version)[0] ?? null;
}

export interface ResolveOrderDisplayOptions {
  order: Order;
  calculations: OrderCalculation[];
  liveOutcome: CalculationOutcome | null;
  mode?: "quote" | "check_contract";
  showLivePreview?: boolean;
}

export interface OrderDisplayCalculation {
  source: "saved" | "live";
  version: number | null;
  createdAt: string | null;
  isContractBaseline: boolean;
  priceTotal: number;
  costTotal: number;
  margin: number;
  marginPct: number | null;
  fixedCost: number;
  minPriceForTargetMargin: number;
  warnings: string[];
  categoryTotals: Record<string, number>;
  assembly: number;
  technolog: number;
  riskReserve: number;
  lineCalculations: LineCalculation[];
}

/**
 * В режиме "check_contract" ценовые скидки (kind = 'price') скрываются из интерфейса,
 * так как итоговая цена берётся строго из поля договора (Step A7, Q7).
 * Корректировки себестоимости (kind = 'cost') остаются доступными.
 */
export function getVisibleAdjustments(
  adjustments: OrderAdjustment[],
  mode: "quote" | "check_contract",
): OrderAdjustment[] {
  if (mode === "check_contract") {
    return adjustments.filter((a) => a.kind === "cost");
  }
  return adjustments;
}

export interface NormalizedCalculationParams {
  targetMarginPct: number;
  assemblyMode: "percent" | "per_meter";
  assemblyPct: number;
  assemblyPerMeterKitchen: number;
  assemblyPerMeterWardrobe: number;
  technologMode: "percent" | "per_sheet";
  technologPct: number;
  technologPerSheet: number;
  riskReservePct: number;
  priceRounding: number;
}

export interface NormalizedCalculationInputLine {
  id: string;
  name: string;
  category: CostCategory;
  unit: string;
  qty: number;
  unitPrice: number;
  wastePct: number;
  billableQtyRounding: BillableQtyRounding;
  countsForTechnolog: boolean;
  isManual: boolean;
  priceItemId: string | null;
  orderItemId?: string | null;
  comment?: string | null;
}

export interface NormalizedCalculationInputItem {
  id: string;
  title: string;
  kind: OrderItemKind;
  linearMeters: number | null;
  description?: string | null;
}

export interface NormalizedCalculationInputAdjustment {
  id: string;
  kind: "price" | "cost";
  category: "adjustments";
  label: string;
  amount: number;
  comment?: string | null;
}

export interface NormalizedCalculationInput {
  contractPrice: number | null;
  items: NormalizedCalculationInputItem[];
  lines: NormalizedCalculationInputLine[];
  adjustments: NormalizedCalculationInputAdjustment[];
}

export interface NormalizedCalculationResult {
  categoryTotals: Record<CostCategory | "adjustments", number>;
  lineCalculations: LineCalculation[];
  fixedAssembly: number;
  fixedTechnolog: number;
  fixedCost: number;
  assembly: number;
  technolog: number;
  riskReserve: number;
  costTotal: number;
  priceTotal: number;
  margin: number;
  marginPct: number | null;
  minPriceForTargetMargin: number;
  warnings: string[];
}

export interface NormalizedOrderCalculation {
  id: string;
  orderId: string;
  version: number;
  mode: "quote" | "check_contract";
  isContractBaseline: boolean;
  createdAt: string;
  costTotal: number;
  priceTotal: number;
  marginPct: number | null;
  parameters: NormalizedCalculationParams;
  input: NormalizedCalculationInput;
  result: NormalizedCalculationResult;
}

/**
 * Нормализует снимок параметров расчёта, поддерживая как новый camelCase (packages/calc),
 * так и исторический snake_case (Step B5).
 */
export function normalizeCalculationParams(
  raw: Record<string, unknown> | null | undefined,
): NormalizedCalculationParams {
  const p = raw || {};
  return {
    targetMarginPct: Number(p.targetMarginPct ?? p.target_margin_pct ?? 0.18),
    assemblyMode:
      p.assemblyMode === "per_meter" || p.assembly_mode === "per_meter"
        ? "per_meter"
        : "percent",
    assemblyPct: Number(p.assemblyPct ?? p.assembly_pct ?? 0.145),
    assemblyPerMeterKitchen: Number(
      p.assemblyPerMeterKitchen ?? p.assembly_per_meter_kitchen ?? 35000,
    ),
    assemblyPerMeterWardrobe: Number(
      p.assemblyPerMeterWardrobe ?? p.assembly_per_meter_wardrobe ?? 25000,
    ),
    technologMode:
      p.technologMode === "per_sheet" || p.technolog_mode === "per_sheet"
        ? "per_sheet"
        : "percent",
    technologPct: Number(p.technologPct ?? p.technolog_pct ?? 0.04),
    technologPerSheet: Number(
      p.technologPerSheet ?? p.technolog_per_sheet ?? 4000,
    ),
    riskReservePct: Number(p.riskReservePct ?? p.risk_reserve_pct ?? 0),
    priceRounding: Number(p.priceRounding ?? p.price_rounding ?? 1000),
  };
}

/**
 * Нормализует входной снимок расчёта, поддерживая как новый camelCase (packages/calc),
 * так и исторический snake_case (Step B5).
 */
export function normalizeCalculationInput(
  raw: Record<string, unknown> | null | undefined,
): NormalizedCalculationInput {
  const inp = raw || {};
  const rawItems = Array.isArray(inp.orderItems)
    ? inp.orderItems
    : Array.isArray(inp.items)
    ? inp.items
    : [];
  const rawLines = Array.isArray(inp.lines) ? inp.lines : [];
  const rawAdjs = Array.isArray(inp.adjustments) ? inp.adjustments : [];

  const items: NormalizedCalculationInputItem[] = rawItems.map(
    (it: Record<string, unknown>) => ({
      id: String(it.id ?? ""),
      title: String(it.title ?? ""),
      kind: (it.kind as OrderItemKind) ?? "kitchen",
      linearMeters:
        it.linearMeters !== undefined && it.linearMeters !== null
          ? Number(it.linearMeters)
          : it.linear_meters !== undefined && it.linear_meters !== null
          ? Number(it.linear_meters)
          : null,
      description:
        it.description !== undefined && it.description !== null
          ? String(it.description)
          : null,
    }),
  );

  const lines: NormalizedCalculationInputLine[] = rawLines.map(
    (l: Record<string, unknown>) => ({
      id: String(l.id ?? ""),
      name: String(l.name ?? ""),
      category: (l.category as CostCategory) ?? "other",
      unit: String(l.unit ?? "шт"),
      qty: Number(l.qty ?? 0),
      unitPrice: Number(l.unitPrice ?? l.unit_price ?? 0),
      wastePct: Number(l.wastePct ?? l.waste_pct ?? 0),
      billableQtyRounding: (l.billableQtyRounding ??
        l.billable_qty_rounding ??
        "none") as BillableQtyRounding,
      countsForTechnolog: Boolean(
        l.countsForTechnolog ?? l.counts_for_technolog,
      ),
      isManual: Boolean(l.isManual ?? l.is_manual),
      priceItemId:
        l.priceItemId !== undefined
          ? (l.priceItemId as string | null)
          : (l.price_item_id as string | null) ?? null,
      orderItemId:
        l.orderItemId !== undefined
          ? (l.orderItemId as string | null)
          : (l.order_item_id as string | null) ?? null,
      comment:
        l.comment !== undefined && l.comment !== null
          ? String(l.comment)
          : null,
    }),
  );

  const adjustments: NormalizedCalculationInputAdjustment[] = rawAdjs.map(
    (a: Record<string, unknown>) => ({
      id: String(a.id ?? ""),
      kind: (a.kind as "price" | "cost") ?? "price",
      category: "adjustments",
      label: String(a.label ?? ""),
      amount: Number(a.amount ?? 0),
      comment:
        a.comment !== undefined && a.comment !== null
          ? String(a.comment)
          : null,
    }),
  );

  const contractPrice =
    inp.contractPrice !== undefined && inp.contractPrice !== null
      ? Number(inp.contractPrice)
      : inp.contract_price !== undefined && inp.contract_price !== null
      ? Number(inp.contract_price)
      : null;

  return {
    contractPrice,
    items,
    lines,
    adjustments,
  };
}

/**
 * Нормализует результаты расчёта, поддерживая camelCase и snake_case (Step B5).
 */
export function normalizeCalculationResult(
  raw: Record<string, unknown> | null | undefined,
  defaults?: { priceTotal?: number; costTotal?: number; marginPct?: number | null },
): NormalizedCalculationResult {
  const r = raw || {};
  const catTotals = (r.categoryTotals ||
    r.category_totals ||
    {}) as Record<string, number>;
  const costTotal = Number(r.costTotal ?? r.cost_total ?? defaults?.costTotal ?? 0);
  const priceTotal = Number(r.priceTotal ?? r.price_total ?? defaults?.priceTotal ?? 0);
  const margin = Number(r.margin ?? priceTotal - costTotal);
  const marginPct =
    r.marginPct !== undefined && r.marginPct !== null
      ? Number(r.marginPct)
      : r.margin_pct !== undefined && r.margin_pct !== null
      ? Number(r.margin_pct)
      : defaults?.marginPct ?? null;
  const fixedCost = Number(r.fixedCost ?? r.fixed_cost ?? 0);
  const fixedAssembly = Number(r.fixedAssembly ?? r.fixed_assembly ?? 0);
  const fixedTechnolog = Number(r.fixedTechnolog ?? r.fixed_technolog ?? 0);
  const assembly = Number(r.assembly ?? fixedAssembly);
  const technolog = Number(r.technolog ?? fixedTechnolog);
  const riskReserve = Number(r.riskReserve ?? r.risk_reserve ?? 0);
  const minPriceForTargetMargin = Number(
    r.minPriceForTargetMargin ?? r.min_price_for_target_margin ?? 0,
  );
  const warnings = Array.isArray(r.warnings) ? (r.warnings as string[]) : [];
  const lineCalculations = Array.isArray(r.lineCalculations ?? r.line_calculations)
    ? (r.lineCalculations ?? r.line_calculations)
    : [];

  return {
    categoryTotals: {
      materials: Number(catTotals.materials ?? 0),
      workshop: Number(catTotals.workshop ?? 0),
      facades: Number(catTotals.facades ?? 0),
      hardware: Number(catTotals.hardware ?? 0),
      transport: Number(catTotals.transport ?? 0),
      labor: Number(catTotals.labor ?? 0),
      other: Number(catTotals.other ?? 0),
      adjustments: Number(catTotals.adjustments ?? 0),
    },
    lineCalculations: lineCalculations as LineCalculation[],
    fixedAssembly,
    fixedTechnolog,
    fixedCost,
    assembly,
    technolog,
    riskReserve,
    costTotal,
    priceTotal,
    margin,
    marginPct,
    minPriceForTargetMargin,
    warnings,
  };
}

/**
 * Единый слой совместимости для версий расчёта (Step B5, п. 2.12).
 * Распознаёт как новый формат packages/calc, так и исторический snake_case.
 */
export function normalizeOrderCalculation(
  calc: OrderCalculation,
): NormalizedOrderCalculation {
  return {
    id: calc.id,
    orderId: calc.order_id,
    version: calc.version,
    mode: calc.mode,
    isContractBaseline: Boolean(calc.is_contract_baseline),
    createdAt: calc.created_at,
    costTotal: Number(calc.cost_total),
    priceTotal: Number(calc.price_total),
    marginPct:
      calc.margin_pct !== null && calc.margin_pct !== undefined
        ? Number(calc.margin_pct)
        : null,
    parameters: normalizeCalculationParams(calc.params_snapshot),
    input: normalizeCalculationInput(calc.input_snapshot),
    result: normalizeCalculationResult(calc.result, {
      costTotal: Number(calc.cost_total),
      priceTotal: Number(calc.price_total),
      marginPct:
        calc.margin_pct !== null && calc.margin_pct !== undefined
          ? Number(calc.margin_pct)
          : null,
    }),
  };
}

/**
 * Определяет расчёт для отображения в сводке заказа (Step A6, Q2):
 * - Если у заказа есть сохранённые версии и не включён предпросмотр (showLivePreview = false),
 *   возвращает данные опорной сохранённой версии (договорной или последней по номеру).
 *   Это защищает старые заказы от спонтанного изменения цен при правке глобальных параметров.
 * - Если пользователь явно нажал «Пересчитать по актуальным параметрам» (showLivePreview = true)
 *   или у заказа нет сохранённых версий, возвращает результат живого расчёта.
 */
export function resolveOrderDisplayCalculation(
  options: ResolveOrderDisplayOptions,
): OrderDisplayCalculation | null {
  const { calculations, liveOutcome, showLivePreview, mode } = options;
  const candidateCalcs = mode ? calculations.filter((c) => c.mode === mode) : calculations;
  const activeSaved = getPlanCalculation(candidateCalcs);

  if (activeSaved && !showLivePreview) {
    const normalized = normalizeOrderCalculation(activeSaved);
    const rawPriceTotal = normalized.priceTotal;
    const priceTotal =
      (mode === "check_contract" || normalized.mode === "check_contract") &&
      options.order.contract_price !== null
        ? Number(options.order.contract_price)
        : rawPriceTotal;
    const costTotal = normalized.costTotal;
    const margin =
      typeof normalized.result.margin === "number"
        ? normalized.result.margin
        : priceTotal - costTotal;
    const marginPct =
      normalized.marginPct !== null
        ? normalized.marginPct
        : priceTotal === 0
        ? null
        : margin / priceTotal;

    return {
      source: "saved",
      version: normalized.version,
      createdAt: normalized.createdAt,
      isContractBaseline: normalized.isContractBaseline,
      priceTotal,
      costTotal,
      margin,
      marginPct,
      fixedCost: normalized.result.fixedCost,
      minPriceForTargetMargin: normalized.result.minPriceForTargetMargin,
      warnings: normalized.result.warnings,
      categoryTotals: normalized.result.categoryTotals,
      assembly: normalized.result.assembly,
      technolog: normalized.result.technolog,
      riskReserve: normalized.result.riskReserve,
      lineCalculations: normalized.result.lineCalculations,
    };
  }

  if (liveOutcome && liveOutcome.ok) {
    const res = liveOutcome.result;
    const priceTotal =
      mode === "check_contract" && options.order.contract_price !== null
        ? Number(options.order.contract_price)
        : res.priceTotal;
    return {
      source: "live",
      version: null,
      createdAt: null,
      isContractBaseline: false,
      priceTotal,
      costTotal: res.costTotal,
      margin: res.margin,
      marginPct: res.marginPct,
      fixedCost: res.fixedCost,
      minPriceForTargetMargin: res.minPriceForTargetMargin,
      warnings: res.warnings,
      categoryTotals: {
        materials: res.categoryTotals.materials,
        workshop: res.categoryTotals.workshop,
        facades: res.categoryTotals.facades,
        hardware: res.categoryTotals.hardware,
        transport: res.categoryTotals.transport,
        labor: res.categoryTotals.labor,
        assembly: res.assembly,
        technolog: res.technolog,
        other: res.categoryTotals.other,
        adjustments: res.categoryTotals.adjustments,
      },
      assembly: res.assembly,
      technolog: res.technolog,
      riskReserve: res.riskReserve,
      lineCalculations: res.lineCalculations,
    };
  }

  return null;
}



/**
 * Фильтрация списка заказов по поисковой строке и статусу.
 */
export function filterOrders(
  orders: OrderWithCalculations[],
  query: string,
  status: OrderStatus | "all",
): OrderWithCalculations[] {
  const normalizedQuery = query.trim().toLowerCase();

  return orders.filter((order) => {
    // Фильтр по статусу
    if (status !== "all" && order.status !== status) {
      return false;
    }

    // Фильтр по поисковой строке (название или клиент)
    if (normalizedQuery.length > 0) {
      const matchName = order.name.toLowerCase().includes(normalizedQuery);
      const matchClient =
        order.client_label?.toLowerCase().includes(normalizedQuery) ?? false;
      if (!matchName && !matchClient) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Сортировка списка заказов по дате создания.
 */
export function sortOrders(
  orders: OrderWithCalculations[],
  direction: "newest" | "oldest" = "newest",
): OrderWithCalculations[] {
  return [...orders].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return direction === "newest" ? timeB - timeA : timeA - timeB;
  });
}

/**
 * Заказ заблокирован от редактирования, если он перешёл в статус approved или выше.
 * (Spec 5.3: после approved позиции и параметры блокируются).
 */
export function isOrderLocked(status: OrderStatus): boolean {
  return (
    status === "approved" ||
    status === "in_production" ||
    status === "done" ||
    status === "cancelled"
  );
}

/**
 * Объединяет глобальные параметры с локальными переопределениями заказа (orders.settings).
 */
export function mergeOrderParameters(
  globalParams: ParametersMap,
  orderSettings?: Record<string, unknown> | null,
): CalculationParameters {
  const s = orderSettings ?? {};

  const targetMarginPct =
    typeof s.target_margin_pct === "number"
      ? s.target_margin_pct
      : globalParams.target_margin_pct;

  const assemblyMode =
    s.assembly_mode === "percent" || s.assembly_mode === "per_meter"
      ? s.assembly_mode
      : globalParams.assembly_mode;

  const assemblyPct =
    typeof s.assembly_pct === "number"
      ? s.assembly_pct
      : globalParams.assembly_pct;

  const assemblyPerMeterKitchen =
    typeof s.assembly_per_meter_kitchen === "number"
      ? s.assembly_per_meter_kitchen
      : globalParams.assembly_per_meter_kitchen;

  const assemblyPerMeterWardrobe =
    typeof s.assembly_per_meter_wardrobe === "number"
      ? s.assembly_per_meter_wardrobe
      : globalParams.assembly_per_meter_wardrobe;

  const technologMode =
    s.technolog_mode === "percent" || s.technolog_mode === "per_sheet"
      ? s.technolog_mode
      : globalParams.technolog_mode;

  const technologPct =
    typeof s.technolog_pct === "number"
      ? s.technolog_pct
      : globalParams.technolog_pct;

  const technologPerSheet =
    typeof s.technolog_per_sheet === "number"
      ? s.technolog_per_sheet
      : globalParams.technolog_per_sheet;

  const riskReservePct =
    typeof s.risk_reserve_pct === "number"
      ? s.risk_reserve_pct
      : globalParams.risk_reserve_pct;

  const priceRounding =
    typeof s.price_rounding === "number"
      ? s.price_rounding
      : globalParams.price_rounding;

  return {
    targetMarginPct,
    assemblyMode,
    assemblyPct,
    assemblyPerMeterKitchen,
    assemblyPerMeterWardrobe,
    technologMode,
    technologPct,
    technologPerSheet,
    riskReservePct,
    priceRounding,
  };
}

/**
 * Подготавливает входные данные для чистой функции расчёта packages/calc.
 */
export function buildCalculationInput(params: {
  order: Order;
  items: OrderItem[];
  lines: OrderLine[];
  adjustments: OrderAdjustment[];
  globalParams: ParametersMap;
  mode: "quote" | "check_contract";
}): CalculationInput {
  const { order, items, lines, adjustments, globalParams, mode } = params;

  const calcParams = mergeOrderParameters(globalParams, order.settings);

  const calcLines: CalculationLine[] = lines.map((line) => ({
    id: line.id,
    category: line.category as CostCategory,
    qty: Number(line.qty),
    unitPrice: Number(line.unit_price),
    wastePct: Number(line.waste_pct),
    billableQtyRounding: line.billable_qty_rounding,
    countsForTechnolog: line.counts_for_technolog,
  }));

  const calcItems: CalculationOrderItem[] = items.map((item) => ({
    kind: item.kind,
    linearMeters:
      item.linear_meters !== null && item.linear_meters !== undefined
        ? Number(item.linear_meters)
        : undefined,
  }));

  const calcAdjustments: CalculationAdjustment[] = adjustments.map((adj) => ({
    kind: adj.kind,
    amount: Number(adj.amount),
  }));

  return {
    mode,
    parameters: calcParams,
    lines: calcLines,
    orderItems: calcItems,
    adjustments: calcAdjustments,
    contractPrice:
      order.contract_price !== null && order.contract_price !== undefined
        ? Number(order.contract_price)
        : undefined,
  };
}

/**
 * Запускает живой расчёт заказа через чистый модуль packages/calc.
 */
export function calculateOrderLive(params: {
  order: Order;
  items: OrderItem[];
  lines: OrderLine[];
  adjustments: OrderAdjustment[];
  globalParams: ParametersMap;
  mode: "quote" | "check_contract";
}): CalculationOutcome {
  const input = buildCalculationInput(params);
  return calculate(input);
}

/**
 * Преобразует массив расчётов строк в карту по id позиции.
 */
export function getLineCalculationsMap(
  lineCalculations: readonly LineCalculation[],
): Map<string, LineCalculation> {
  const map = new Map<string, LineCalculation>();
  for (const calc of lineCalculations) {
    if (calc.id) {
      map.set(calc.id, calc);
    }
  }
  return map;
}

/**
 * Вычисляет отдельную позицию заказа через чистую функцию calculateLine из packages/calc.
 */
export function getOrderLineCalculation(line: OrderLine): LineCalculation {
  return calculateLine({
    id: line.id,
    category: line.category as CostCategory,
    qty: Number(line.qty),
    unitPrice: Number(line.unit_price),
    wastePct: Number(line.waste_pct),
    billableQtyRounding: line.billable_qty_rounding,
    countsForTechnolog: line.counts_for_technolog,
  });
}

export type { LineCalculation };

/**
 * Валидация создания / редактирования заказа.
 */
export function validateOrderInput(input: {
  name: string;
  contract_price?: number | null;
}): { valid: boolean; error?: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { valid: false, error: "Название заказа обязательно для заполнения." };
  }
  if (
    input.contract_price !== null &&
    input.contract_price !== undefined &&
    input.contract_price < 0
  ) {
    return { valid: false, error: "Цена по договору не может быть отрицательной." };
  }
  return { valid: true };
}

/**
 * Валидация добавления / редактирования изделия.
 */
export function validateOrderItemInput(input: {
  title: string;
  kind: OrderItemKind;
  linear_meters?: number | null;
}): { valid: boolean; error?: string } {
  if (!input.title || input.title.trim().length === 0) {
    return { valid: false, error: "Название изделия обязательно для заполнения." };
  }
  if (
    input.linear_meters !== null &&
    input.linear_meters !== undefined &&
    input.linear_meters < 0
  ) {
    return { valid: false, error: "Погонные метры не могут быть отрицательными." };
  }
  return { valid: true };
}

/**
 * Валидация ручной позиции заказа.
 */
export function validateManualLineInput(input: {
  name: string;
  category: PriceCategory;
  qty: number;
  unit_price: number;
  waste_pct?: number;
}): { valid: boolean; error?: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { valid: false, error: "Название позиции обязательно." };
  }
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { valid: false, error: "Количество должно быть больше 0." };
  }
  if (!Number.isFinite(input.unit_price) || input.unit_price < 0) {
    return { valid: false, error: "Цена за единицу не может быть отрицательной." };
  }
  if (
    input.waste_pct !== undefined &&
    (!Number.isFinite(input.waste_pct) || input.waste_pct < 0)
  ) {
    return { valid: false, error: "Отход не может быть отрицательным." };
  }
  return { valid: true };
}

/**
 * Валидация корректировки заказа.
 */
export function validateAdjustmentInput(input: {
  label: string;
  amount: number;
}): { valid: boolean; error?: string } {
  if (!input.label || input.label.trim().length === 0) {
    return { valid: false, error: "Название корректировки обязательно." };
  }
  if (!Number.isFinite(input.amount)) {
    return { valid: false, error: "Сумма корректировки должна быть числом." };
  }
  return { valid: true };
}

/**
 * Структура данных для сохранения версии расчёта в таблицу calculations.
 */
export interface SaveCalculationPayload {
  order_id: string;
  version: number;
  mode: "quote" | "check_contract";
  params_snapshot: Record<string, unknown>;
  input_snapshot: Record<string, unknown>;
  result: Record<string, unknown>;
  cost_total: number;
  price_total: number;
  margin_pct: number | null;
  is_contract_baseline?: boolean;
}

/**
 * Формирует неизменяемый снимок расчёта для сохранения в базу данных,
 * используя чистую функцию createCalculationVersion из packages/calc (Step B5, п. 2.12).
 */
export function prepareCalculationSnapshot(params: {
  order: Order;
  items: OrderItem[];
  lines: OrderLine[];
  adjustments: OrderAdjustment[];
  globalParams: ParametersMap;
  mode: "quote" | "check_contract";
  outcome?: CalculationOutcome;
  isContractBaseline?: boolean;
}): SaveCalculationPayload {
  const calcParams = mergeOrderParameters(params.globalParams, params.order.settings);

  const snapshotLines: CalculationSnapshotLine[] = params.lines.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category as CostCategory,
    unit: l.unit,
    qty: Number(l.qty),
    unitPrice: Number(l.unit_price),
    wastePct: Number(l.waste_pct),
    billableQtyRounding: l.billable_qty_rounding,
    priceItemId: l.price_item_id || null,
    isManual: Boolean(l.is_manual),
    countsForTechnolog: Boolean(l.counts_for_technolog),
    comment: l.comment || null,
  }));

  const snapshotItems: CalculationSnapshotOrderItem[] = params.items.map((it) => ({
    id: it.id,
    title: it.title,
    kind: it.kind,
    linearMeters: it.linear_meters !== null ? Number(it.linear_meters) : undefined,
    description: it.description || null,
    dims: it.dims || {},
  }));

  const snapshotAdjustments: CalculationSnapshotAdjustment[] = params.adjustments.map((a) => ({
    id: a.id,
    kind: a.kind,
    category: "adjustments",
    label: a.label,
    amount: Number(a.amount),
    comment: a.comment || null,
  }));

  const versionOutcome = createCalculationVersion({
    mode: params.mode,
    parameters: {
      targetMarginPct: calcParams.targetMarginPct,
      assemblyMode: calcParams.assemblyMode,
      assemblyPct: calcParams.assemblyPct,
      assemblyPerMeterKitchen: calcParams.assemblyPerMeterKitchen,
      assemblyPerMeterWardrobe: calcParams.assemblyPerMeterWardrobe,
      technologMode: calcParams.technologMode,
      technologPct: calcParams.technologPct,
      technologPerSheet: calcParams.technologPerSheet,
      riskReservePct: calcParams.riskReservePct,
      priceRounding: calcParams.priceRounding,
    },
    lines: snapshotLines,
    orderItems: snapshotItems,
    adjustments: snapshotAdjustments,
    contractPrice:
      params.mode === "check_contract"
        ? (params.order.contract_price !== null ? Number(params.order.contract_price) : undefined)
        : undefined,
  });

  if (!versionOutcome.ok) {
    throw new Error(`Невозможно сохранить расчёт с ошибкой: ${versionOutcome.error}`);
  }

  const { version } = versionOutcome;

  return {
    order_id: params.order.id,
    version: 0, // Базовый триггер БД назначит atomic следующий номер версии
    mode: version.mode,
    params_snapshot: version.paramsSnapshot as unknown as Record<string, unknown>,
    input_snapshot: version.inputSnapshot as unknown as Record<string, unknown>,
    result: version.result as unknown as Record<string, unknown>,
    cost_total: version.costTotal,
    price_total: version.priceTotal,
    margin_pct: version.marginPct,
    is_contract_baseline: params.isContractBaseline ?? false,
  };
}

export interface PriceDiffLine {
  lineId: string;
  name: string;
  category: PriceCategory;
  oldUnitPrice: number;
  newUnitPrice: number;
  qty: number;
  oldLineTotal: number;
  newLineTotal: number;
  diff: number;
}

export interface PriceUpdatesDiff {
  lines: PriceDiffLine[];
  totalOldLinesCost: number;
  totalNewLinesCost: number;
  totalDiff: number;
}

/**
 * Сравнивает цены позиций заказа с актуальными ценами в справочнике
 * и подсчитывает разницу итоговой стоимости позиций.
 */
export function computePriceUpdatesDiff(
  lines: OrderLine[],
  catalogMap: Map<string, PriceItem>,
): PriceUpdatesDiff {
  const diffLines: PriceDiffLine[] = [];
  let totalOld = 0;
  let totalNew = 0;

  for (const line of lines) {
    if (!line.price_item_id) continue;
    const catItem = catalogMap.get(line.price_item_id);
    if (!catItem) continue;

    const oldUnitPrice = Number(line.unit_price);
    const newUnitPrice = Number(catItem.price);

    if (oldUnitPrice !== newUnitPrice) {
      const oldCalc = getOrderLineCalculation(line);
      const newCalc = getOrderLineCalculation({
        ...line,
        unit_price: newUnitPrice,
      });

      const oldTotal = oldCalc.total;
      const newTotal = newCalc.total;
      const diff = newTotal - oldTotal;

      diffLines.push({
        lineId: line.id,
        name: line.name,
        category: line.category,
        oldUnitPrice,
        newUnitPrice,
        qty: Number(line.qty),
        oldLineTotal: oldTotal,
        newLineTotal: newTotal,
        diff,
      });

      totalOld += oldTotal;
      totalNew += newTotal;
    }
  }

  return {
    lines: diffLines,
    totalOldLinesCost: totalOld,
    totalNewLinesCost: totalNew,
    totalDiff: totalNew - totalOld,
  };
}

export interface OrderLoadQueryResults {
  itemsError?: unknown;
  linesError?: unknown;
  adjustmentsError?: unknown;
  pricesError?: unknown;
  parametersError?: unknown;
  calculationsError?: unknown;
  expensesError?: unknown;
  paymentsError?: unknown;
}

export const ORDER_LOAD_NETWORK_ERROR_MESSAGE =
  "Данные заказа загружены не полностью из-за сетевой ошибки. Редактирование заблокировано.";

/**
 * Проверяет наличие сетевых и серверных ошибок при параллельной загрузке связанных таблиц заказа (Step B4).
 */
export function checkOrderLoadCriticalErrors(results: OrderLoadQueryResults): {
  hasError: boolean;
  errorMessage: string | null;
} {
  const criticalErrors = [
    results.itemsError,
    results.linesError,
    results.adjustmentsError,
    results.pricesError,
    results.parametersError,
    results.calculationsError,
    results.expensesError,
    results.paymentsError,
  ].filter(Boolean);

  if (criticalErrors.length > 0) {
    return {
      hasError: true,
      errorMessage: ORDER_LOAD_NETWORK_ERROR_MESSAGE,
    };
  }

  return {
    hasError: false,
    errorMessage: null,
  };
}

/**
 * Защита от сохранения пустого расчёта: требует явного подтверждения,
 * если в заказе 0 позиций или итоговая цена равна 0 (Step B4).
 */
export function shouldConfirmCalculationSave(options: {
  linesCount: number;
  priceTotal: number;
}): {
  needsConfirmation: boolean;
  reason: string | null;
} {
  const hasZeroLines = options.linesCount === 0;
  const hasZeroPrice = options.priceTotal === 0;

  if (hasZeroLines || hasZeroPrice) {
    const reason =
      hasZeroLines && hasZeroPrice
        ? "В заказе нет позиций и итоговая цена равна 0."
        : hasZeroLines
        ? "В заказе нет позиций."
        : "Итоговая цена заказа равна 0.";
    return {
      needsConfirmation: true,
      reason,
    };
  }

  return {
    needsConfirmation: false,
    reason: null,
  };
}

