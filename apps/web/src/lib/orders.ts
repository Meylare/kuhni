import {
  calculate,
  calculateLine,
  type CalculationInput,
  type CalculationLine,
  type CalculationOrderItem,
  type CalculationAdjustment,
  type CalculationOutcome,
  type CalculationParameters,
  type CostCategory,
  type LineCalculation,
} from "@kuhni/calc";

import type {
  Order,
  OrderAdjustment,
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
 * Формирует неизменяемый снимок расчёта для сохранения в базу данных.
 */
export function prepareCalculationSnapshot(params: {
  order: Order;
  items: OrderItem[];
  lines: OrderLine[];
  adjustments: OrderAdjustment[];
  globalParams: ParametersMap;
  mode: "quote" | "check_contract";
  outcome: CalculationOutcome;
  isContractBaseline?: boolean;
}): SaveCalculationPayload {
  if (!params.outcome.ok) {
    throw new Error(`Невозможно сохранить расчёт с ошибкой: ${params.outcome.error}`);
  }

  const calcParams = mergeOrderParameters(params.globalParams, params.order.settings);

  return {
    order_id: params.order.id,
    version: 0, // Базовый триггер БД назначит atomic следующий номер версии
    mode: params.mode,
    params_snapshot: {
      target_margin_pct: calcParams.targetMarginPct,
      assembly_mode: calcParams.assemblyMode,
      assembly_pct: calcParams.assemblyPct,
      assembly_per_meter_kitchen: calcParams.assemblyPerMeterKitchen,
      assembly_per_meter_wardrobe: calcParams.assemblyPerMeterWardrobe,
      technolog_mode: calcParams.technologMode,
      technolog_pct: calcParams.technologPct,
      technolog_per_sheet: calcParams.technologPerSheet,
      risk_reserve_pct: calcParams.riskReservePct,
      price_rounding: calcParams.priceRounding,
    },
    input_snapshot: {
      contract_price: params.order.contract_price,
      items: params.items.map((it) => ({
        id: it.id,
        kind: it.kind,
        title: it.title,
        linear_meters: it.linear_meters,
        description: it.description,
      })),
      lines: params.lines.map((l) => ({
        id: l.id,
        price_item_id: l.price_item_id,
        order_item_id: l.order_item_id,
        category: l.category,
        name: l.name,
        unit: l.unit,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        waste_pct: Number(l.waste_pct),
        billable_qty_rounding: l.billable_qty_rounding,
        counts_for_technolog: l.counts_for_technolog,
        is_manual: l.is_manual,
        comment: l.comment,
      })),
      adjustments: params.adjustments.map((a) => ({
        id: a.id,
        kind: a.kind,
        category: a.category,
        label: a.label,
        amount: Number(a.amount),
        comment: a.comment,
      })),
    },
    result: params.outcome.result as unknown as Record<string, unknown>,
    cost_total: params.outcome.result.costTotal,
    price_total: params.outcome.result.priceTotal,
    margin_pct: params.outcome.result.marginPct,
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

