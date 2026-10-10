import {
  calculate,
  calculateLine,
  createCalculationVersion,
  MAX_PRICE_SHARES_SUM,
  type CalculationAdjustment,
  type CalculationInput,
  type CalculationLine,
  type CalculationOrderItem,
  type CalculationOutcome,
  type CalculationParameters,
  type CalculationResult,
  type CalculationSnapshotAdjustment,
  type CalculationSnapshotLine,
  type CalculationSnapshotOrderItem,
  type CostCategory,
  type LineCalculation,
} from "@kuhni/calc";

export class SnapshotCorruptedError extends Error {
  readonly missingField: string;

  constructor(missingField: string) {
    super(`Снимок расчёта повреждён: отсутствует обязательное поле '${missingField}'`);
    this.name = "SnapshotCorruptedError";
    this.missingField = missingField;
  }
}

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
 * 1. Исключает повреждённые версии (не прошедшие строгую валидацию снимков).
 * 2. Если есть версия с отметкой договора (is_contract_baseline = true), возвращает её.
 * 3. Если договорная версия не отмечена, возвращает последнюю сохранённую версию (по номеру версии).
 * 4. Если версий нет, возвращает null.
 */
export function getPlanCalculation<
  T extends { version: number; is_contract_baseline?: boolean }
>(calculations: T[] | null | undefined): T | null {
  if (!calculations || calculations.length === 0) {
    return null;
  }
  const validCalcs = calculations.filter((c) => {
    if ("params_snapshot" in c && "input_snapshot" in c && "result" in c) {
      return isCalculationValid(c as unknown as OrderCalculation);
    }
    return true;
  });
  if (validCalcs.length === 0) return null;
  const baseline = validCalcs.find((c) => Boolean(c.is_contract_baseline));
  if (baseline) {
    return baseline;
  }
  return [...validCalcs].sort((a, b) => b.version - a.version)[0] ?? null;
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
  contractPriceMismatch: { snapshot: number; current: number } | null;
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

export type NormalizedCalculationParams = CalculationParameters;

export const DEFAULT_SNAPSHOT_PARAMS: CalculationParameters = {
  targetMarginPct: 0.18,
  assemblyMode: "percent",
  assemblyPct: 0.145,
  assemblyPerMeterKitchen: 35000,
  assemblyPerMeterWardrobe: 25000,
  technologMode: "percent",
  technologPct: 0.04,
  technologPerSheet: 4000,
  riskReservePct: 0.02,
  priceRounding: 1000,
};

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

export type NormalizedCalculationResult = CalculationResult;

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
 * Нормализует снимок параметров расчёта (Step A7).
 * Строго требует формат camelCase из packages/calc. При отсутствии обязательного поля выбрасывает SnapshotCorruptedError.
 */
export function normalizeCalculationParams(
  raw: Record<string, unknown> | null | undefined,
): NormalizedCalculationParams {
  if (!raw || typeof raw !== "object") {
    throw new SnapshotCorruptedError("targetMarginPct");
  }

  if (typeof raw.targetMarginPct !== "number" || !Number.isFinite(raw.targetMarginPct)) {
    throw new SnapshotCorruptedError("targetMarginPct");
  }
  if (raw.assemblyMode !== "percent" && raw.assemblyMode !== "per_meter") {
    throw new SnapshotCorruptedError("assemblyMode");
  }
  if (typeof raw.assemblyPct !== "number" || !Number.isFinite(raw.assemblyPct)) {
    throw new SnapshotCorruptedError("assemblyPct");
  }
  if (typeof raw.assemblyPerMeterKitchen !== "number" || !Number.isFinite(raw.assemblyPerMeterKitchen)) {
    throw new SnapshotCorruptedError("assemblyPerMeterKitchen");
  }
  if (typeof raw.assemblyPerMeterWardrobe !== "number" || !Number.isFinite(raw.assemblyPerMeterWardrobe)) {
    throw new SnapshotCorruptedError("assemblyPerMeterWardrobe");
  }
  if (raw.technologMode !== "percent" && raw.technologMode !== "per_sheet") {
    throw new SnapshotCorruptedError("technologMode");
  }
  if (typeof raw.technologPct !== "number" || !Number.isFinite(raw.technologPct)) {
    throw new SnapshotCorruptedError("technologPct");
  }
  if (typeof raw.technologPerSheet !== "number" || !Number.isFinite(raw.technologPerSheet)) {
    throw new SnapshotCorruptedError("technologPerSheet");
  }
  if (typeof raw.riskReservePct !== "number" || !Number.isFinite(raw.riskReservePct)) {
    throw new SnapshotCorruptedError("riskReservePct");
  }
  if (typeof raw.priceRounding !== "number" || !Number.isFinite(raw.priceRounding)) {
    throw new SnapshotCorruptedError("priceRounding");
  }

  return {
    targetMarginPct: raw.targetMarginPct,
    assemblyMode: raw.assemblyMode,
    assemblyPct: raw.assemblyPct,
    assemblyPerMeterKitchen: raw.assemblyPerMeterKitchen,
    assemblyPerMeterWardrobe: raw.assemblyPerMeterWardrobe,
    technologMode: raw.technologMode,
    technologPct: raw.technologPct,
    technologPerSheet: raw.technologPerSheet,
    riskReservePct: raw.riskReservePct,
    priceRounding: raw.priceRounding,
  };
}

/**
 * Нормализует входной снимок расчёта (Step A7).
 * Строго требует формат camelCase из packages/calc. При отсутствии обязательного поля выбрасывает SnapshotCorruptedError.
 */
export function normalizeCalculationInput(
  raw: Record<string, unknown> | null | undefined,
): NormalizedCalculationInput {
  if (!raw || typeof raw !== "object") {
    throw new SnapshotCorruptedError("lines");
  }
  const rawLines = raw.lines;
  if (!Array.isArray(rawLines)) {
    throw new SnapshotCorruptedError("lines");
  }
  const rawItems = raw.items ?? raw.orderItems ?? [];
  if (!Array.isArray(rawItems)) {
    throw new SnapshotCorruptedError("items");
  }
  const rawAdjs = raw.adjustments ?? [];
  if (!Array.isArray(rawAdjs)) {
    throw new SnapshotCorruptedError("adjustments");
  }

  const items: NormalizedCalculationInputItem[] = rawItems.map(
    (it: Record<string, unknown>, idx: number) => {
      if (!it || typeof it !== "object") {
        throw new SnapshotCorruptedError(`items[${idx}]`);
      }
      return {
        id: String(it.id ?? ""),
        title: String(it.title ?? ""),
        kind: (it.kind as OrderItemKind) ?? "kitchen",
        linearMeters:
          it.linearMeters !== undefined && it.linearMeters !== null
            ? Number(it.linearMeters)
            : null,
        description:
          it.description !== undefined && it.description !== null
            ? String(it.description)
            : null,
      };
    },
  );

  const lines: NormalizedCalculationInputLine[] = rawLines.map(
    (l: Record<string, unknown>, idx: number) => {
      if (!l || typeof l !== "object") {
        throw new SnapshotCorruptedError(`lines[${idx}]`);
      }
      if (!l.category) throw new SnapshotCorruptedError(`lines[${idx}].category`);
      if (typeof l.qty !== "number" || !Number.isFinite(l.qty)) {
        throw new SnapshotCorruptedError(`lines[${idx}].qty`);
      }
      if (typeof l.unitPrice !== "number" || !Number.isFinite(l.unitPrice)) {
        throw new SnapshotCorruptedError(`lines[${idx}].unitPrice`);
      }
      if (typeof l.wastePct !== "number" || !Number.isFinite(l.wastePct)) {
        throw new SnapshotCorruptedError(`lines[${idx}].wastePct`);
      }

      return {
        id: String(l.id ?? ""),
        name: String(l.name ?? ""),
        category: l.category as CostCategory,
        unit: String(l.unit ?? "шт"),
        qty: l.qty,
        unitPrice: l.unitPrice,
        wastePct: l.wastePct,
        billableQtyRounding: (l.billableQtyRounding ?? "none") as BillableQtyRounding,
        countsForTechnolog: Boolean(l.countsForTechnolog),
        isManual: Boolean(l.isManual),
        priceItemId: l.priceItemId !== undefined ? (l.priceItemId as string | null) : null,
        orderItemId: l.orderItemId !== undefined ? (l.orderItemId as string | null) : null,
        comment: l.comment !== undefined && l.comment !== null ? String(l.comment) : null,
      };
    },
  );

  const adjustments: NormalizedCalculationInputAdjustment[] = rawAdjs.map(
    (a: Record<string, unknown>, idx: number) => {
      if (!a || typeof a !== "object") {
        throw new SnapshotCorruptedError(`adjustments[${idx}]`);
      }
      if (typeof a.amount !== "number" || !Number.isFinite(a.amount)) {
        throw new SnapshotCorruptedError(`adjustments[${idx}].amount`);
      }
      return {
        id: String(a.id ?? ""),
        kind: (a.kind as "price" | "cost") ?? "price",
        category: "adjustments",
        label: String(a.label ?? ""),
        amount: a.amount,
        comment: a.comment !== undefined && a.comment !== null ? String(a.comment) : null,
      };
    },
  );

  const contractPrice =
    raw.contractPrice !== undefined && raw.contractPrice !== null
      ? Number(raw.contractPrice)
      : null;

  return {
    contractPrice,
    items,
    lines,
    adjustments,
  };
}

/**
 * Нормализует результаты расчёта (Step A7).
 * Строго требует формат camelCase из packages/calc. При отсутствии обязательного поля выбрасывает SnapshotCorruptedError.
 */
export function normalizeCalculationResult(
  raw: Record<string, unknown> | null | undefined,
): NormalizedCalculationResult {
  if (!raw || typeof raw !== "object") {
    throw new SnapshotCorruptedError("result");
  }
  if (!raw.categoryTotals || typeof raw.categoryTotals !== "object") {
    throw new SnapshotCorruptedError("categoryTotals");
  }
  const catTotals = raw.categoryTotals as Record<string, unknown>;
  const categoryTotals: Record<CostCategory | "adjustments", number> = {
    materials: typeof catTotals.materials === "number" ? catTotals.materials : 0,
    workshop: typeof catTotals.workshop === "number" ? catTotals.workshop : 0,
    facades: typeof catTotals.facades === "number" ? catTotals.facades : 0,
    hardware: typeof catTotals.hardware === "number" ? catTotals.hardware : 0,
    transport: typeof catTotals.transport === "number" ? catTotals.transport : 0,
    labor: typeof catTotals.labor === "number" ? catTotals.labor : 0,
    other: typeof catTotals.other === "number" ? catTotals.other : 0,
    adjustments: typeof catTotals.adjustments === "number" ? catTotals.adjustments : 0,
  };

  if (typeof raw.costTotal !== "number" || !Number.isFinite(raw.costTotal)) {
    throw new SnapshotCorruptedError("costTotal");
  }
  if (typeof raw.priceTotal !== "number" || !Number.isFinite(raw.priceTotal)) {
    throw new SnapshotCorruptedError("priceTotal");
  }
  if (typeof raw.margin !== "number" || !Number.isFinite(raw.margin)) {
    throw new SnapshotCorruptedError("margin");
  }
  const marginPct =
    raw.marginPct === null || raw.marginPct === undefined
      ? null
      : typeof raw.marginPct === "number" && Number.isFinite(raw.marginPct)
      ? raw.marginPct
      : (() => {
          throw new SnapshotCorruptedError("marginPct");
        })();

  if (typeof raw.fixedCost !== "number" || !Number.isFinite(raw.fixedCost)) {
    throw new SnapshotCorruptedError("fixedCost");
  }
  const fixedAssembly = Number(raw.fixedAssembly ?? 0);
  const fixedTechnolog = Number(raw.fixedTechnolog ?? 0);
  if (typeof raw.assembly !== "number" || !Number.isFinite(raw.assembly)) {
    throw new SnapshotCorruptedError("assembly");
  }
  if (typeof raw.technolog !== "number" || !Number.isFinite(raw.technolog)) {
    throw new SnapshotCorruptedError("technolog");
  }
  if (typeof raw.riskReserve !== "number" || !Number.isFinite(raw.riskReserve)) {
    throw new SnapshotCorruptedError("riskReserve");
  }
  if (typeof raw.minPriceForTargetMargin !== "number" || !Number.isFinite(raw.minPriceForTargetMargin)) {
    throw new SnapshotCorruptedError("minPriceForTargetMargin");
  }
  if (!Array.isArray(raw.warnings)) {
    throw new SnapshotCorruptedError("warnings");
  }
  if (!Array.isArray(raw.lineCalculations)) {
    throw new SnapshotCorruptedError("lineCalculations");
  }

  return {
    categoryTotals,
    lineCalculations: raw.lineCalculations as LineCalculation[],
    fixedAssembly,
    fixedTechnolog,
    fixedCost: raw.fixedCost,
    assembly: raw.assembly,
    technolog: raw.technolog,
    riskReserve: raw.riskReserve,
    costTotal: raw.costTotal,
    priceTotal: raw.priceTotal,
    margin: raw.margin,
    marginPct,
    minPriceForTargetMargin: raw.minPriceForTargetMargin,
    warnings: raw.warnings as string[],
  };
}

/**
 * Единый слой нормализации версии расчёта (Step A7).
 * Строго валидирует снимок и выбрасывает SnapshotCorruptedError при повреждении данных.
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
    result: normalizeCalculationResult(calc.result),
  };
}

/**
 * Проверяет, является ли снимок расчёта валидным и не повреждённым (Step A7).
 */
export function isCalculationValid(calc: OrderCalculation): boolean {
  try {
    normalizeOrderCalculation(calc);
    return true;
  } catch {
    return false;
  }
}

/**
 * Определяет расчёт для отображения в сводке заказа (Step A6, Q2, Step A7):
 * - Если у заказа есть сохранённые версии и не включён предпросмотр (showLivePreview = false),
 *   возвращает данные опорной сохранённой версии (договорной или последней по номеру).
 * - Если сохранённая версия повреждена (SnapshotCorruptedError), функция не падает, а переходит к живому расчёту.
 */
export function resolveOrderDisplayCalculation(
  options: ResolveOrderDisplayOptions,
): OrderDisplayCalculation | null {
  const { calculations, liveOutcome, showLivePreview, mode } = options;
  const candidateCalcs = mode ? calculations.filter((c) => c.mode === mode) : calculations;
  const activeSaved = getPlanCalculation(candidateCalcs);

  if (activeSaved && !showLivePreview) {
    try {
      const normalized = normalizeOrderCalculation(activeSaved);
      const priceTotal = normalized.priceTotal;
      const costTotal = normalized.costTotal;
      const margin = normalized.result.margin;
      const marginPct =
        normalized.marginPct !== null
          ? normalized.marginPct
          : priceTotal === 0
          ? null
          : margin / priceTotal;

      const currentContractPrice =
        options.order.contract_price !== null && options.order.contract_price !== undefined
          ? Number(options.order.contract_price)
          : null;

      let contractPriceMismatch: { snapshot: number; current: number } | null = null;
      if (
        normalized.mode === "check_contract" &&
        currentContractPrice !== null &&
        currentContractPrice !== priceTotal
      ) {
        contractPriceMismatch = {
          snapshot: priceTotal,
          current: currentContractPrice,
        };
      }

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
        contractPriceMismatch,
      };
    } catch {
      // При повреждении сохранённого снимка не падаем, переходим к живому предпросмотру
    }
  }

  if (liveOutcome && liveOutcome.ok) {
    const res = liveOutcome.result;
    const priceTotal = res.priceTotal;
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
      contractPriceMismatch: null,
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
 * Защита от сохранения подозрительного расчёта: требует явного подтверждения,
 * если в заказе 0 позиций, итоговая цена равна 0 или маржа отрицательная (Step B4, A3).
 */
export function shouldConfirmCalculationSave(options: {
  linesCount: number;
  priceTotal: number;
  margin?: number;
}): {
  needsConfirmation: boolean;
  reason: string | null;
} {
  const hasZeroLines = options.linesCount === 0;
  const hasZeroPrice = options.priceTotal === 0;
  const hasNegativeMargin = options.margin !== undefined && options.margin < 0;

  if (hasZeroLines || hasZeroPrice || hasNegativeMargin) {
    let reason: string;
    if (hasZeroLines && hasZeroPrice) {
      reason = "В заказе нет позиций и итоговая цена равна 0.";
    } else if (hasZeroLines) {
      reason = "В заказе нет позиций.";
    } else if (hasZeroPrice) {
      reason = "Итоговая цена заказа равна 0.";
    } else {
      reason = "Маржа заказа отрицательная (убыточный расчёт).";
    }

    if (hasNegativeMargin && (hasZeroLines || hasZeroPrice)) {
      reason += " Маржа заказа отрицательная.";
    }

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

/**
 * Преобразует код ошибки расчёта в понятный текст для пользователя с проверкой на исчерпанность (Step A3).
 */
export function formatCalculationOutcomeError(
  error: Exclude<CalculationOutcome, { ok: true }>["error"],
): string {
  switch (error) {
    case "invalid_input":
      return "Некорректные входные данные расчёта. Проверьте позиции заказа.";
    case "parameters_leave_no_share_for_fixed_costs":
      return "Сумма процентных ставок превышает 100%. Измените параметры расчёта.";
    case "parameters_share_too_high":
      return `Сумма процентных ставок превышает максимально допустимые ${(MAX_PRICE_SHARES_SUM * 100).toFixed(0)}%. Уменьшите ставки в параметрах.`;
    case "contract_price_required":
      return "Необходимо указать цену по договору в шапке заказа.";
    case "price_not_positive":
      return "Расчётная цена заказа меньше или равна нулю. Уменьшите скидку или проверьте позиции.";
    default: {
      const _exhaustiveCheck: never = error;
      return `Неизвестная ошибка расчёта (${String(_exhaustiveCheck)}).`;
    }
  }
}


