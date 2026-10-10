import type { CalculationParameters } from "@kuhni/calc";
import type { OrderCalculation } from "../types/database";
import {
  normalizeCalculationInput,
  normalizeCalculationParams,
  type NormalizedCalculationInput,
  type NormalizedCalculationParams,
  type NormalizedOrderCalculation,
} from "./orders";

export interface CurrentCalculationSnapshotInput {
  mode: "quote" | "check_contract";
  contractPrice?: number | null;
  parameters: CalculationParameters;
  lines: Array<{
    id?: string;
    price_item_id?: string | null;
    priceItemId?: string | null;
    name?: string;
    category?: string;
    unit?: string;
    qty?: number | string;
    unit_price?: number | string;
    unitPrice?: number | string;
    waste_pct?: number | string;
    wastePct?: number | string;
    billable_qty_rounding?: string;
    billableQtyRounding?: string;
    counts_for_technolog?: boolean;
    countsForTechnolog?: boolean;
    is_manual?: boolean;
    isManual?: boolean;
    order_item_id?: string | null;
    orderItemId?: string | null;
    comment?: string | null;
  }>;
  items?: Array<{
    id?: string;
    title?: string;
    kind?: string;
    linear_meters?: number | string | null;
    linearMeters?: number | string | null;
    description?: string | null;
  }>;
  adjustments?: Array<{
    id?: string;
    kind?: string;
    category?: string;
    label?: string;
    amount?: number | string;
    comment?: string | null;
  }>;
}

export type VersionSyncBadgeColor = "neutral" | "warning";

export type VersionSyncStatus =
  | {
      type: "no_versions";
      label: string;
      isDirty: false;
      badgeColor: "neutral";
    }
  | {
      type: "synced";
      version: number;
      label: string;
      isDirty: false;
      badgeColor: "neutral";
    }
  | {
      type: "dirty";
      version: number;
      label: string;
      isDirty: true;
      badgeColor: "warning";
    };

interface CanonicalLine {
  id: string;
  priceItemId: string | null;
  orderItemId: string | null;
  name: string;
  category: string;
  unit: string;
  qty: number;
  unitPrice: number;
  wastePct: number;
  billableQtyRounding: string;
  countsForTechnolog: boolean;
  isManual: boolean;
  comment: string;
}

interface CanonicalItem {
  id: string;
  title: string;
  kind: string;
  linearMeters: number | null;
}

interface CanonicalAdjustment {
  id: string;
  kind: string;
  amount: number;
  label: string;
}

function canonicalizeLine(l: any): CanonicalLine {
  return {
    id: String(l.id ?? ""),
    priceItemId:
      l.priceItemId !== undefined
        ? l.priceItemId
          ? String(l.priceItemId)
          : null
        : l.price_item_id
        ? String(l.price_item_id)
        : null,
    orderItemId:
      l.orderItemId !== undefined
        ? l.orderItemId
          ? String(l.orderItemId)
          : null
        : l.order_item_id
        ? String(l.order_item_id)
        : null,
    name: String(l.name ?? "").trim(),
    category: String(l.category ?? "").trim(),
    unit: String(l.unit ?? "").trim(),
    qty: Math.round(Number(l.qty ?? 0) * 1000) / 1000,
    unitPrice: Math.round(Number(l.unitPrice ?? l.unit_price ?? 0)),
    wastePct: Math.round(Number(l.wastePct ?? l.waste_pct ?? 0) * 1000) / 1000,
    billableQtyRounding: String(
      l.billableQtyRounding ?? l.billable_qty_rounding ?? "none",
    ),
    countsForTechnolog: Boolean(
      l.countsForTechnolog ?? l.counts_for_technolog,
    ),
    isManual: Boolean(l.isManual ?? l.is_manual),
    comment: l.comment ? String(l.comment).trim() : "",
  };
}

function canonicalizeItem(it: any): CanonicalItem {
  const lmRaw =
    it.linearMeters !== undefined ? it.linearMeters : it.linear_meters;
  return {
    id: String(it.id ?? ""),
    title: String(it.title ?? "").trim(),
    kind: String(it.kind ?? "kitchen"),
    linearMeters:
      lmRaw !== undefined && lmRaw !== null
        ? Math.round(Number(lmRaw) * 100) / 100
        : null,
  };
}

function canonicalizeAdjustment(a: any): CanonicalAdjustment {
  return {
    id: String(a.id ?? ""),
    kind: String(a.kind ?? "price"),
    amount: Math.round(Number(a.amount ?? 0)),
    label: String(a.label ?? "").trim(),
  };
}

function sortLines(lines: CanonicalLine[]): CanonicalLine[] {
  return [...lines].sort((a, b) => {
    const kA = `${a.id}|${a.orderItemId ?? ""}|${a.priceItemId ?? ""}|${a.name}`;
    const kB = `${b.id}|${b.orderItemId ?? ""}|${b.priceItemId ?? ""}|${b.name}`;
    return kA.localeCompare(kB);
  });
}

function sortItems(items: CanonicalItem[]): CanonicalItem[] {
  return [...items].sort((a, b) => {
    const kA = `${a.id}|${a.title}`;
    const kB = `${b.id}|${b.title}`;
    return kA.localeCompare(kB);
  });
}

function sortAdjustments(adjs: CanonicalAdjustment[]): CanonicalAdjustment[] {
  return [...adjs].sort((a, b) => {
    const kA = `${a.id}|${a.kind}|${a.label}`;
    const kB = `${b.id}|${b.kind}|${b.label}`;
    return kA.localeCompare(kB);
  });
}

function areParamsEqual(
  p1: CalculationParameters | NormalizedCalculationParams,
  p2: CalculationParameters | NormalizedCalculationParams,
): boolean {
  if (p1.assemblyMode !== p2.assemblyMode) return false;
  if (p1.technologMode !== p2.technologMode) return false;
  if (Math.abs(p1.targetMarginPct - p2.targetMarginPct) > 1e-4) return false;
  if (Math.abs(p1.assemblyPct - p2.assemblyPct) > 1e-4) return false;
  if (Math.abs(p1.assemblyPerMeterKitchen - p2.assemblyPerMeterKitchen) > 0.01) return false;
  if (Math.abs(p1.assemblyPerMeterWardrobe - p2.assemblyPerMeterWardrobe) > 0.01) return false;
  if (Math.abs(p1.technologPct - p2.technologPct) > 1e-4) return false;
  if (Math.abs(p1.technologPerSheet - p2.technologPerSheet) > 0.01) return false;
  if (Math.abs(p1.riskReservePct - p2.riskReservePct) > 1e-4) return false;
  if (Math.abs(p1.priceRounding - p2.priceRounding) > 0.01) return false;
  return true;
}

/**
 * Чистая функция сравнения текущих входных данных с сохранённой версией (Step U4).
 * Возвращает true, если есть изменения относительно версии, и false, если идентично.
 * Порядок строк, изделий и корректировок не влияет на результат.
 */
export function isDirtySince(
  version: OrderCalculation | NormalizedOrderCalculation | null | undefined,
  currentInput: CurrentCalculationSnapshotInput,
): boolean {
  if (!version) {
    return false;
  }

  let verParams: NormalizedCalculationParams;
  let verInput: NormalizedCalculationInput;
  let verMode: "quote" | "check_contract";

  try {
    if ("params_snapshot" in version && "input_snapshot" in version) {
      verParams = normalizeCalculationParams(version.params_snapshot);
      verInput = normalizeCalculationInput(version.input_snapshot);
      verMode = version.mode;
    } else {
      verParams = (version as NormalizedOrderCalculation).parameters;
      verInput = (version as NormalizedOrderCalculation).input;
      verMode = (version as NormalizedOrderCalculation).mode;
    }
  } catch {
    // Если снимок повреждён — считаем, что есть изменения
    return true;
  }

  // 1. Режим расчёта
  if (verMode !== currentInput.mode) {
    return true;
  }

  // 2. Цена договора
  const verContractPrice =
    verInput.contractPrice !== null && verInput.contractPrice !== undefined
      ? Math.round(Number(verInput.contractPrice))
      : null;
  const curContractPrice =
    currentInput.contractPrice !== null && currentInput.contractPrice !== undefined
      ? Math.round(Number(currentInput.contractPrice))
      : null;
  if (verContractPrice !== curContractPrice) {
    return true;
  }

  // 3. Параметры
  if (!areParamsEqual(verParams, currentInput.parameters)) {
    return true;
  }

  // 4. Позиции (lines)
  const verLines = sortLines(verInput.lines.map(canonicalizeLine));
  const curLines = sortLines(currentInput.lines.map(canonicalizeLine));

  if (verLines.length !== curLines.length) {
    return true;
  }

  for (let i = 0; i < verLines.length; i++) {
    const vL = verLines[i];
    const cL = curLines[i];
    if (vL.name !== cL.name) return true;
    if (vL.category !== cL.category) return true;
    if (vL.unit !== cL.unit) return true;
    if (Math.abs(vL.qty - cL.qty) > 1e-4) return true;
    if (Math.abs(vL.unitPrice - cL.unitPrice) > 0.01) return true;
    if (Math.abs(vL.wastePct - cL.wastePct) > 1e-4) return true;
    if (vL.billableQtyRounding !== cL.billableQtyRounding) return true;
    if (vL.countsForTechnolog !== cL.countsForTechnolog) return true;
    if (vL.isManual !== cL.isManual) return true;
    if (vL.priceItemId !== cL.priceItemId) return true;
    if (vL.orderItemId !== cL.orderItemId) return true;
    if (vL.comment !== cL.comment) return true;
  }

  // 5. Изделия (items)
  const verItems = sortItems(verInput.items.map(canonicalizeItem));
  const curItems = sortItems((currentInput.items ?? []).map(canonicalizeItem));

  if (verItems.length !== curItems.length) {
    return true;
  }

  for (let i = 0; i < verItems.length; i++) {
    const vI = verItems[i];
    const cI = curItems[i];
    if (vI.title !== cI.title) return true;
    if (vI.kind !== cI.kind) return true;
    const vLm = vI.linearMeters ?? 0;
    const cLm = cI.linearMeters ?? 0;
    if (Math.abs(vLm - cLm) > 1e-3) return true;
  }

  // 6. Корректировки (adjustments)
  const verAdjs = sortAdjustments(verInput.adjustments.map(canonicalizeAdjustment));
  const curAdjs = sortAdjustments((currentInput.adjustments ?? []).map(canonicalizeAdjustment));

  if (verAdjs.length !== curAdjs.length) {
    return true;
  }

  for (let i = 0; i < verAdjs.length; i++) {
    const vA = verAdjs[i];
    const cA = curAdjs[i];
    if (vA.kind !== cA.kind) return true;
    if (Math.abs(vA.amount - cA.amount) > 0.01) return true;
    if (vA.label !== cA.label) return true;
  }

  return false;
}

/**
 * Получает понятный статус синхронизации для показа в интерфейсе рядом с кнопкой «Зафиксировать версию»
 */
export function getVersionSyncStatus(
  latestVersion: OrderCalculation | NormalizedOrderCalculation | null | undefined,
  currentInput: CurrentCalculationSnapshotInput,
): VersionSyncStatus {
  if (!latestVersion) {
    return {
      type: "no_versions",
      label: "Версий пока нет",
      isDirty: false,
      badgeColor: "neutral",
    };
  }

  const isDirty = isDirtySince(latestVersion, currentInput);
  const versionNum = latestVersion.version;

  if (isDirty) {
    return {
      type: "dirty",
      version: versionNum,
      label: `Есть изменения после версии ${versionNum}`,
      isDirty: true,
      badgeColor: "warning",
    };
  }

  return {
    type: "synced",
    version: versionNum,
    label: `Совпадает с версией ${versionNum}`,
    isDirty: false,
    badgeColor: "neutral",
  };
}
