import type { ParametersMap } from "./parameters";
import type { OrderLine, PriceItem } from "../types/database";

/**
 * Округляет количество до 3 десятичных знаков (numeric(12,3)),
 * устраняя артефакты плавающей запятой в JavaScript.
 */
export function roundQuantity(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.round(qty * 1000) / 1000;
}

/**
 * Возвращает шаг изменения количества для заданной единицы измерения.
 * По спецификации U1: шаг по умолчанию 1.
 */
export function getStepIncrement(_unit: string): number {
  return 1;
}

export interface MergeOrAddResult {
  lines: OrderLine[];
  affectedLine: OrderLine | null;
  action: "added" | "updated" | "deleted" | "noop";
}

/**
 * Находит существующую позицию по price_item_id и order_item_id
 * и суммирует/вычитает количество, либо добавляет новую строку.
 * При deltaQty < 0 и qty <= 0 — удаляет строку.
 */
export function mergeOrAddPriceItem(
  currentLines: OrderLine[],
  params: {
    priceItem: PriceItem;
    orderItemId: string | null;
    orderId: string;
    deltaQty?: number;
    globalParams?: ParametersMap;
  }
): MergeOrAddResult {
  const { priceItem, orderItemId, orderId, deltaQty = 1, globalParams } = params;

  const existingIndex = currentLines.findIndex(
    (l) => l.order_item_id === orderItemId && l.price_item_id === priceItem.id
  );

  if (existingIndex >= 0) {
    const existing = currentLines[existingIndex];
    const newQty = roundQuantity(existing.qty + deltaQty);

    if (newQty <= 0) {
      return {
        lines: currentLines.filter((_, idx) => idx !== existingIndex),
        affectedLine: existing,
        action: "deleted",
      };
    }

    const updatedLine: OrderLine = {
      ...existing,
      qty: newQty,
    };
    const nextLines = [...currentLines];
    nextLines[existingIndex] = updatedLine;
    return {
      lines: nextLines,
      affectedLine: updatedLine,
      action: "updated",
    };
  }

  // Если позиции нет и запрошено уменьшение — ничего не делаем
  if (deltaQty <= 0) {
    return {
      lines: currentLines,
      affectedLine: null,
      action: "noop",
    };
  }

  const normalizedDelta = roundQuantity(deltaQty);

  // Расчёт отхода по умолчанию для новой позиции (для кромки берётся из параметров)
  let defaultWaste = 0;
  if (priceItem.waste_applicable && globalParams) {
    defaultWaste = priceItem.waste_kind === "edge" ? globalParams.waste_edge_pct : 0;
  }

  const newLine: OrderLine = {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    order_id: orderId,
    order_item_id: orderItemId,
    price_item_id: priceItem.id,
    category: priceItem.category,
    name: priceItem.name,
    unit: priceItem.unit,
    qty: normalizedDelta,
    unit_price: priceItem.price,
    waste_pct: defaultWaste,
    billable_qty_rounding: priceItem.billable_qty_rounding,
    counts_for_technolog: priceItem.counts_for_technolog,
    is_manual: false,
    comment: null,
  };

  return {
    lines: [...currentLines, newLine],
    affectedLine: newLine,
    action: "added",
  };
}

export interface UpdateQuantityResult {
  lines: OrderLine[];
  affectedLine: OrderLine | null;
  action: "updated" | "deleted";
}

/**
 * Обновляет количество строки заказа.
 * Если newQty <= 0 — удаляет строку.
 */
export function updateLineQuantity(
  currentLines: OrderLine[],
  lineId: string,
  newQty: number
): UpdateQuantityResult {
  const rounded = roundQuantity(newQty);

  if (rounded <= 0) {
    const removedLine = currentLines.find((l) => l.id === lineId) ?? null;
    return {
      lines: currentLines.filter((l) => l.id !== lineId),
      affectedLine: removedLine,
      action: "deleted",
    };
  }

  const targetIndex = currentLines.findIndex((l) => l.id === lineId);
  if (targetIndex < 0) {
    return {
      lines: currentLines,
      affectedLine: null,
      action: "updated",
    };
  }

  const updatedLine: OrderLine = {
    ...currentLines[targetIndex],
    qty: rounded,
  };

  const nextLines = [...currentLines];
  nextLines[targetIndex] = updatedLine;

  return {
    lines: nextLines,
    affectedLine: updatedLine,
    action: "updated",
  };
}

/**
 * Возвращает до `limit` популярных позиций на основе частоты в order_lines.
 */
export function getRecentPriceItems(
  orderLinesHistory: OrderLine[],
  priceItemsById: Map<string, PriceItem>,
  limit = 8
): PriceItem[] {
  const counts = new Map<string, number>();

  for (const line of orderLinesHistory) {
    if (line.price_item_id && priceItemsById.has(line.price_item_id)) {
      counts.set(line.price_item_id, (counts.get(line.price_item_id) ?? 0) + 1);
    }
  }

  // Сортировка по убыванию частоты
  const sortedIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const result: PriceItem[] = [];
  for (const id of sortedIds) {
    const item = priceItemsById.get(id);
    if (item && item.active) {
      result.push(item);
      if (result.length >= limit) break;
    }
  }

  // Если недавних мало, дополняем первыми активными позициями
  if (result.length < limit) {
    for (const item of priceItemsById.values()) {
      if (item.active && !result.some((r) => r.id === item.id)) {
        result.push(item);
        if (result.length >= limit) break;
      }
    }
  }

  return result;
}

export interface PricePickerInitialValues {
  qty: string;
  waste: string;
  comment: string;
  isExisting: boolean;
}

/**
 * Инициализирует поля детальной формы модального окна справочника цен (B2).
 * Если позиция уже добавлена в заказ — подставляет её текущие значения.
 * Если позиции нет — сбрасывает в дефолты и не оставляет значения от предыдущего выбора.
 */
export function getInitialPricePickerValues(
  priceItem: PriceItem,
  existingLine: OrderLine | null | undefined,
  globalParams: ParametersMap
): PricePickerInitialValues {
  if (existingLine) {
    return {
      qty: String(existingLine.qty),
      waste:
        existingLine.waste_pct > 0
          ? String(roundQuantity(existingLine.waste_pct * 100))
          : "",
      comment: existingLine.comment || "",
      isExisting: true,
    };
  }

  return {
    qty: "1",
    waste:
      priceItem.waste_applicable && priceItem.waste_kind === "edge"
        ? String(roundQuantity(globalParams.waste_edge_pct * 100))
        : "",
    comment: "",
    isExisting: false,
  };
}
