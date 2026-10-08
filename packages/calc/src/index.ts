export type CostCategory =
  | "materials"
  | "workshop"
  | "facades"
  | "hardware"
  | "transport"
  | "labor"
  | "other";

export type BillableQuantityRounding = "none" | "ceil_to_unit";
export type AssemblyMode = "percent" | "per_meter";
export type TechnologMode = "percent" | "per_sheet";
export type CalculationMode = "quote" | "check_contract";

export interface CalculationLine {
  id?: string;
  category: CostCategory;
  qty: number;
  unitPrice: number;
  wastePct: number;
  billableQtyRounding: BillableQuantityRounding;
  countsForTechnolog?: boolean;
}

export interface CalculationOrderItem {
  kind: "kitchen" | "wardrobe" | "other";
  linearMeters?: number;
}

export interface CalculationAdjustment {
  kind: "cost" | "price";
  amount: number;
}

export interface CalculationParameters {
  targetMarginPct: number;
  assemblyMode: AssemblyMode;
  assemblyPct: number;
  assemblyPerMeterKitchen: number;
  assemblyPerMeterWardrobe: number;
  technologMode: TechnologMode;
  technologPct: number;
  technologPerSheet: number;
  riskReservePct: number;
  priceRounding: number;
}

export interface CalculationInput {
  mode: CalculationMode;
  lines: readonly CalculationLine[];
  orderItems?: readonly CalculationOrderItem[];
  adjustments?: readonly CalculationAdjustment[];
  parameters: CalculationParameters;
  contractPrice?: number;
}

export interface LineCalculation {
  id?: string;
  billableQty: number;
  total: number;
}

export interface CalculationResult {
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

export type CalculationOutcome =
  | { ok: true; result: CalculationResult }
  | { ok: false; error: "invalid_input"; details: string[] }
  | { ok: false; error: "parameters_leave_no_share_for_fixed_costs" | "contract_price_required" };

export interface CalculationSnapshotLine extends CalculationLine {
  id: string;
  name: string;
  unit: string;
  priceItemId: string | null;
  isManual: boolean;
  countsForTechnolog: boolean;
  comment?: string | null;
}

export interface CalculationSnapshotOrderItem extends CalculationOrderItem {
  id: string;
  title: string;
  description?: string | null;
  dims?: Record<string, unknown>;
}

export interface CalculationSnapshotAdjustment extends CalculationAdjustment {
  id: string;
  label: string;
  category: "adjustments";
  comment?: string | null;
}

export interface CalculationVersionInput
  extends Omit<CalculationInput, "lines" | "orderItems" | "adjustments"> {
  lines: readonly CalculationSnapshotLine[];
  orderItems?: readonly CalculationSnapshotOrderItem[];
  adjustments?: readonly CalculationSnapshotAdjustment[];
}

export interface CalculationVersion {
  mode: CalculationMode;
  paramsSnapshot: CalculationParameters;
  inputSnapshot: {
    lines: CalculationSnapshotLine[];
    orderItems: CalculationSnapshotOrderItem[];
    adjustments: CalculationSnapshotAdjustment[];
    contractPrice: number | null;
  };
  result: CalculationResult;
  costTotal: number;
  priceTotal: number;
  marginPct: number | null;
}

export type CalculationVersionOutcome =
  | { ok: true; version: CalculationVersion }
  | Extract<CalculationOutcome, { ok: false }>;

const categories: readonly CostCategory[] = [
  "materials",
  "workshop",
  "facades",
  "hardware",
  "transport",
  "labor",
  "other",
];

const floatingPointTolerance = (value: number) =>
  Number.EPSILON * Math.max(1, Math.abs(value)) * 8;

/** Rounds a monetary amount upward, while ignoring binary floating-point noise. */
export function roundKztUp(value: number): number {
  const rounded = Math.ceil(value - floatingPointTolerance(value));
  return rounded === 0 ? 0 : rounded;
}

/** Rounds positive or negative values to the nearest increment, with .5 rounded up. */
export function roundHalfUp(value: number, increment: number): number {
  return (
    Math.floor(value / increment + 0.5 + floatingPointTolerance(value / increment)) * increment
  );
}

function formatKzt(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function calculateLine(line: CalculationLine): LineCalculation {
  const qtyWithWaste = line.qty * (1 + line.wastePct);
  const billableQty =
    line.billableQtyRounding === "ceil_to_unit"
      ? (() => {
          const rounded = Math.ceil(qtyWithWaste - floatingPointTolerance(qtyWithWaste));
          return rounded === 0 ? 0 : rounded;
        })()
      : qtyWithWaste;

  return {
    ...(line.id === undefined ? {} : { id: line.id }),
    billableQty,
    total: roundKztUp(billableQty * line.unitPrice),
  };
}

function fixedAssemblyCost(
  mode: AssemblyMode,
  items: readonly CalculationOrderItem[],
  parameters: CalculationParameters,
): number {
  if (mode !== "per_meter") return 0;

  return items.reduce((total, item) => {
    const linearMeters = item.linearMeters ?? 0;
    if (item.kind === "kitchen") {
      return total + linearMeters * parameters.assemblyPerMeterKitchen;
    }
    if (item.kind === "wardrobe") {
      return total + linearMeters * parameters.assemblyPerMeterWardrobe;
    }
    return total;
  }, 0);
}

function fixedTechnologCost(
  mode: TechnologMode,
  lines: readonly CalculationLine[],
  parameters: CalculationParameters,
): number {
  if (mode !== "per_sheet") return 0;

  return lines.reduce(
    (total, line) =>
      line.countsForTechnolog ? total + line.qty * parameters.technologPerSheet : total,
    0,
  );
}

export function calculatePriceDenominator(parameters: CalculationParameters): number {
  const assemblyPct = parameters.assemblyMode === "percent" ? parameters.assemblyPct : 0;
  const technologPct = parameters.technologMode === "percent" ? parameters.technologPct : 0;
  const sumRates =
    parameters.targetMarginPct + assemblyPct + technologPct + parameters.riskReservePct;
  const denominator = 1 - sumRates;
  return Math.abs(denominator) < floatingPointTolerance(1) && sumRates >= 1 ? 0 : denominator;
}

function minimumPrice(
  fixedCost: number,
  parameters: CalculationParameters,
): number | "parameters_leave_no_share_for_fixed_costs" {
  const denominator = calculatePriceDenominator(parameters);

  if (denominator <= 0) return "parameters_leave_no_share_for_fixed_costs";
  return roundHalfUp(fixedCost / denominator, parameters.priceRounding);
}

export function validateCalculationInput(input: CalculationInput): string[] {
  const details: string[] = [];

  const params = input.parameters;
  if (!params) {
    details.push("parameters are required");
    return details;
  }

  if (!Number.isFinite(params.priceRounding) || params.priceRounding <= 0) {
    details.push("parameters.priceRounding must be a positive finite number");
  }
  if (!Number.isFinite(params.targetMarginPct)) {
    details.push("parameters.targetMarginPct must be a finite number");
  }
  if (!Number.isFinite(params.assemblyPct)) {
    details.push("parameters.assemblyPct must be a finite number");
  }
  if (!Number.isFinite(params.assemblyPerMeterKitchen) || params.assemblyPerMeterKitchen < 0) {
    details.push("parameters.assemblyPerMeterKitchen must be a non-negative finite number");
  }
  if (!Number.isFinite(params.assemblyPerMeterWardrobe) || params.assemblyPerMeterWardrobe < 0) {
    details.push("parameters.assemblyPerMeterWardrobe must be a non-negative finite number");
  }
  if (!Number.isFinite(params.technologPct)) {
    details.push("parameters.technologPct must be a finite number");
  }
  if (!Number.isFinite(params.technologPerSheet) || params.technologPerSheet < 0) {
    details.push("parameters.technologPerSheet must be a non-negative finite number");
  }
  if (!Number.isFinite(params.riskReservePct)) {
    details.push("parameters.riskReservePct must be a finite number");
  }

  if (input.contractPrice !== undefined) {
    if (!Number.isFinite(input.contractPrice)) {
      details.push("contractPrice must be a finite number");
    } else if (input.contractPrice < 0) {
      details.push("contractPrice cannot be negative");
    }
  }

  input.lines?.forEach((line, index) => {
    if (!Number.isFinite(line.qty) || line.qty < 0) {
      details.push(`lines[${index}].qty must be a non-negative finite number`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      details.push(`lines[${index}].unitPrice must be a non-negative finite number`);
    }
    if (!Number.isFinite(line.wastePct) || line.wastePct < 0) {
      details.push(`lines[${index}].wastePct must be a non-negative finite number`);
    }
  });

  input.orderItems?.forEach((item, index) => {
    if (
      item.linearMeters !== undefined &&
      (!Number.isFinite(item.linearMeters) || item.linearMeters < 0)
    ) {
      details.push(`orderItems[${index}].linearMeters must be a non-negative finite number`);
    }
  });

  input.adjustments?.forEach((adjustment, index) => {
    if (!Number.isFinite(adjustment.amount)) {
      details.push(`adjustments[${index}].amount must be a finite number`);
    }
  });

  return details;
}

/**
 * Calculates a quote or checks a contract using only the supplied snapshots.
 * It deliberately has no database, clock, or network dependency.
 */
export function calculate(input: CalculationInput): CalculationOutcome {
  const validationErrors = validateCalculationInput(input);
  if (validationErrors.length > 0) {
    return { ok: false, error: "invalid_input", details: validationErrors };
  }

  const parameters = input.parameters;
  const categoryTotals = Object.fromEntries(
    [...categories, "adjustments"].map((category) => [category, 0]),
  ) as CalculationResult["categoryTotals"];
  const lineCalculations = input.lines.map(calculateLine);

  input.lines.forEach((line, index) => {
    categoryTotals[line.category] += lineCalculations[index].total;
  });

  const adjustments = input.adjustments ?? [];
  const costAdjustments = adjustments
    .filter((adjustment) => adjustment.kind === "cost")
    .reduce((total, adjustment) => total + adjustment.amount, 0);
  const priceAdjustments = adjustments
    .filter((adjustment) => adjustment.kind === "price")
    .reduce((total, adjustment) => total + adjustment.amount, 0);
  categoryTotals.adjustments = costAdjustments;

  const fixedAssembly = fixedAssemblyCost(
    parameters.assemblyMode,
    input.orderItems ?? [],
    parameters,
  );
  const fixedTechnolog = fixedTechnologCost(parameters.technologMode, input.lines, parameters);
  const fixedCost =
    Object.values(categoryTotals).reduce((total, value) => total + value, 0) +
    fixedAssembly +
    fixedTechnolog;
  const minPriceForTargetMargin = minimumPrice(fixedCost, parameters);

  if (minPriceForTargetMargin === "parameters_leave_no_share_for_fixed_costs") {
    return { ok: false, error: minPriceForTargetMargin };
  }
  if (input.mode === "check_contract" && input.contractPrice === undefined) {
    return { ok: false, error: "contract_price_required" };
  }

  const priceTotal =
    input.mode === "quote"
      ? minPriceForTargetMargin + priceAdjustments
      : input.contractPrice!;
  const assembly =
    parameters.assemblyMode === "percent" ? roundKztUp(parameters.assemblyPct * priceTotal) : 0;
  const technolog =
    parameters.technologMode === "percent" ? roundKztUp(parameters.technologPct * priceTotal) : 0;
  const riskReserve = roundKztUp(parameters.riskReservePct * priceTotal);
  const costTotal = fixedCost + assembly + technolog + riskReserve;
  const margin = priceTotal - costTotal;
  const warnings: string[] = [];

  if (input.mode === "check_contract" && priceTotal < minPriceForTargetMargin) {
    warnings.push(`договор ниже минимальной цены ${formatKzt(minPriceForTargetMargin)}`);
  }

  return {
    ok: true,
    result: {
      categoryTotals,
      lineCalculations,
      fixedAssembly,
      fixedTechnolog,
      fixedCost,
      assembly,
      technolog,
      riskReserve,
      costTotal,
      priceTotal,
      margin,
      marginPct: priceTotal === 0 ? null : margin / priceTotal,
      minPriceForTargetMargin,
      warnings,
    },
  };
}

/**
 * Builds the immutable payload for public.calculations from the same pure
 * calculation used by the app and future agent API. No database or clock is
 * consulted, and every object is deep-copied before it can be persisted.
 */
export function createCalculationVersion(input: CalculationVersionInput): CalculationVersionOutcome {
  const outcome = calculate(input);
  if (!outcome.ok) return outcome;

  const result = structuredClone(outcome.result);
  return {
    ok: true,
    version: {
      mode: input.mode,
      paramsSnapshot: structuredClone(input.parameters),
      inputSnapshot: {
        lines: [...structuredClone(input.lines)],
        orderItems: [...structuredClone(input.orderItems ?? [])],
        adjustments: [...structuredClone(input.adjustments ?? [])],
        contractPrice: input.contractPrice ?? null,
      },
      result,
      costTotal: result.costTotal,
      priceTotal: result.priceTotal,
      marginPct: result.marginPct,
    },
  };
}
