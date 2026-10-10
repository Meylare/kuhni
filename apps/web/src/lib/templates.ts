import { mergeOrAddPriceItem, roundQuantity } from "./order-lines-stepper";
import type { ParametersMap } from "./parameters";
import type {
  OrderLine,
  PriceItem,
  ProductTemplateLine,
} from "../types/database";

export interface GroupOrderLinesResult {
  templateLines: { price_item_id: string; qty: number; note: string | null }[];
  manualLinesCount: number;
  skippedManualNames: string[];
}

/**
 * Группирует позиции заказа по price_item_id, суммируя количества.
 * Ручные позиции (без price_item_id) исключаются и перечисляются в отчёте.
 */
export function groupOrderLinesForTemplate(lines: OrderLine[]): GroupOrderLinesResult {
  const groupedMap = new Map<string, { qty: number; note: string | null }>();
  const skippedManualNames: string[] = [];
  let manualLinesCount = 0;

  for (const line of lines) {
    if (!line.price_item_id) {
      manualLinesCount++;
      skippedManualNames.push(line.name);
      continue;
    }

    const existing = groupedMap.get(line.price_item_id);
    if (existing) {
      existing.qty = roundQuantity(existing.qty + line.qty);
      if (!existing.note && line.comment) {
        existing.note = line.comment;
      }
    } else {
      groupedMap.set(line.price_item_id, {
        qty: roundQuantity(line.qty),
        note: line.comment ?? null,
      });
    }
  }

  const templateLines = Array.from(groupedMap.entries()).map(([price_item_id, val]) => ({
    price_item_id,
    qty: val.qty,
    note: val.note,
  }));

  return {
    templateLines,
    manualLinesCount,
    skippedManualNames,
  };
}

export interface ApplyTemplateResult {
  nextLines: OrderLine[];
  appliedCount: number;
  skippedInactiveCount: number;
  skippedNames: string[];
}

/**
 * Применяет позиции шаблона к заказу.
 * Позиции, которых нет в справочнике или неактивны, пропускаются.
 * Активные позиции добавляются или суммируются с существующими строками (правило U1).
 */
export function applyTemplateToOrderLines(params: {
  templateLines: ProductTemplateLine[];
  currentLines: OrderLine[];
  priceItemsById: Map<string, PriceItem>;
  orderId: string;
  orderItemId: string | null;
  globalParams?: ParametersMap;
}): ApplyTemplateResult {
  const {
    templateLines,
    currentLines,
    priceItemsById,
    orderId,
    orderItemId,
    globalParams,
  } = params;

  let linesAcc = [...currentLines];
  let appliedCount = 0;
  let skippedInactiveCount = 0;
  const skippedNames: string[] = [];

  for (const tLine of templateLines) {
    const priceItem = priceItemsById.get(tLine.price_item_id);
    if (!priceItem || !priceItem.active) {
      skippedInactiveCount++;
      skippedNames.push(priceItem ? priceItem.name : `ID: ${tLine.price_item_id}`);
      continue;
    }

    const mergeRes = mergeOrAddPriceItem(linesAcc, {
      priceItem,
      orderItemId,
      orderId,
      deltaQty: tLine.qty,
      globalParams,
    });

    linesAcc = mergeRes.lines;
    appliedCount++;
  }

  return {
    nextLines: linesAcc,
    appliedCount,
    skippedInactiveCount,
    skippedNames,
  };
}
