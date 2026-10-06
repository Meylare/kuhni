import {
  calculate,
  calculateLine,
  type CalculationInput,
  type CalculationLine,
  type CalculationOrderItem,
  type CalculationAdjustment,
  type CalculationOutcome,
  type CalculationParameters,
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
    category: line.category,
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
    category: line.category,
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
