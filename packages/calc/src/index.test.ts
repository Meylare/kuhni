import { describe, expect, it } from "vitest";

import {
  calculate,
  calculateLine,
  calculatePriceDenominator,
  createCalculationVersion,
  type CalculationInput,
  type CalculationParameters,
  type CalculationVersionInput,
} from "./index";

const defaultParameters: CalculationParameters = {
  targetMarginPct: 0.18,
  assemblyMode: "percent",
  assemblyPct: 0.145,
  assemblyPerMeterKitchen: 35_000,
  assemblyPerMeterWardrobe: 25_000,
  technologMode: "percent",
  technologPct: 0.04,
  technologPerSheet: 4_000,
  riskReservePct: 0,
  priceRounding: 1_000,
};

const exampleInput: CalculationInput = {
  mode: "quote",
  parameters: defaultParameters,
  orderItems: [{ kind: "kitchen", linearMeters: 3 }],
  lines: [
    { category: "materials", qty: 10, unitPrice: 14_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "materials", qty: 120, unitPrice: 70, wastePct: 0.1, billableQtyRounding: "none" },
    { category: "facades", qty: 6, unitPrice: 26_000, wastePct: 0, billableQtyRounding: "ceil_to_unit" },
    { category: "materials", qty: 2, unitPrice: 7_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "workshop", qty: 10, unitPrice: 2_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "workshop", qty: 10, unitPrice: 6_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "workshop", qty: 120, unitPrice: 200, wastePct: 0, billableQtyRounding: "none" },
    { category: "workshop", qty: 2, unitPrice: 1_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "facades", qty: 6, unitPrice: 2_000, wastePct: 0, billableQtyRounding: "ceil_to_unit" },
    { category: "workshop", qty: 1, unitPrice: 3_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "workshop", qty: 12, unitPrice: 2_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "hardware", qty: 5, unitPrice: 6_500, wastePct: 0, billableQtyRounding: "none" },
    { category: "hardware", qty: 20, unitPrice: 750, wastePct: 0, billableQtyRounding: "none" },
    { category: "transport", qty: 1, unitPrice: 20_000, wastePct: 0, billableQtyRounding: "none" },
    { category: "labor", qty: 1, unitPrice: 15_000, wastePct: 0, billableQtyRounding: "none" },
  ],
};

function successful(input: CalculationInput) {
  const outcome = calculate(input);
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

describe("calculate", () => {
  it("calculates example A: quote with percentage assembly and technolog", () => {
    const result = successful(exampleInput);

    expect(result.categoryTotals).toMatchObject({
      materials: 163_240,
      facades: 168_000,
      workshop: 133_000,
      hardware: 47_500,
      transport: 20_000,
      labor: 15_000,
    });
    expect(result.fixedCost).toBe(546_740);
    expect(result.priceTotal).toBe(861_000);
    expect(result.assembly).toBe(124_845);
    expect(result.technolog).toBe(34_440);
    expect(result.costTotal).toBe(706_025);
    expect(result.margin).toBe(154_975);
    expect(result.marginPct).toBeCloseTo(0.18, 4);
  });

  it("calculates example B: checks the contract and warns below minimum price", () => {
    const result = successful({ ...exampleInput, mode: "check_contract", contractPrice: 850_000 });

    expect(result.minPriceForTargetMargin).toBe(861_000);
    expect(result.priceTotal).toBe(850_000);
    expect(result.costTotal).toBe(703_990);
    expect(result.margin).toBe(146_010);
    expect(result.marginPct).toBeCloseTo(0.171776, 5);
    expect(result.warnings).toEqual(["договор ниже минимальной цены 861 000"]);
  });

  it("calculates example C: adds per-meter assembly to fixed cost", () => {
    const result = successful({
      ...exampleInput,
      parameters: { ...defaultParameters, assemblyMode: "per_meter" },
    });

    expect(result.fixedAssembly).toBe(105_000);
    expect(result.fixedCost).toBe(651_740);
    expect(result.priceTotal).toBe(836_000);
    expect(result.costTotal).toBe(685_180);
    expect(result.marginPct).toBeCloseTo(0.1804, 4);
  });

  it("keeps a zero-quantity line at zero", () => {
    const result = successful({
      ...exampleInput,
      lines: [{ category: "other", qty: 0, unitPrice: 99_999, wastePct: 0.1, billableQtyRounding: "none" }],
    });

    expect(result.lineCalculations[0]).toMatchObject({ billableQty: 0, total: 0 });
    expect(result.categoryTotals.other).toBe(0);
  });

  it("returns an error when parameters leave no share for fixed costs", () => {
    expect(
      calculate({
        ...exampleInput,
        parameters: { ...defaultParameters, targetMarginPct: 0.82 },
      }),
    ).toEqual({ ok: false, error: "parameters_leave_no_share_for_fixed_costs" });
  });

  it("applies negative price adjustments as a discount after base price rounding", () => {
    const result = successful({
      ...exampleInput,
      adjustments: [{ kind: "price", amount: -11_000 }],
    });

    expect(result.priceTotal).toBe(850_000);
    expect(result.assembly).toBe(123_250);
    expect(result.technolog).toBe(34_000);
  });

  it("uses the waste snapshot and rounds every line total upward to KZT", () => {
    const result = successful({
      ...exampleInput,
      lines: [{ category: "materials", qty: 1.001, unitPrice: 100, wastePct: 0.1, billableQtyRounding: "none" }],
    });

    expect(result.lineCalculations[0]).toMatchObject({ billableQty: 1.1011, total: 111 });
  });

  it("bills 6.6 square metres of MDF as 7 square metres", () => {
    const result = successful({
      ...exampleInput,
      lines: [{ category: "facades", qty: 6.6, unitPrice: 26_000, wastePct: 0, billableQtyRounding: "ceil_to_unit" }],
    });

    expect(result.lineCalculations[0]).toMatchObject({ billableQty: 7, total: 182_000 });
  });

  it("rounds fractional percentage costs upward to KZT", () => {
    const result = successful({
      mode: "check_contract",
      contractPrice: 1_001,
      parameters: { ...defaultParameters, assemblyPct: 0.001, technologPct: 0, riskReservePct: 0.001 },
      lines: [],
    });

    expect(result.assembly).toBe(2);
    expect(result.riskReserve).toBe(2);
  });
});

describe("createCalculationVersion", () => {
  it("stores a deep snapshot and result produced by the pure calculation", () => {
    const input: CalculationVersionInput = {
      mode: "quote",
      parameters: { ...defaultParameters },
      lines: [
        {
          id: "line-1",
          priceItemId: "price-item-1",
          isManual: false,
          name: "Тестовая позиция",
          unit: "шт",
          category: "materials",
          qty: 2,
          unitPrice: 1_000,
          wastePct: 0,
          billableQtyRounding: "none",
          countsForTechnolog: false,
        },
      ],
      orderItems: [{ id: "item-1", title: "Изделие", kind: "kitchen", linearMeters: 1 }],
      adjustments: [{ id: "adjustment-1", kind: "price", category: "adjustments", label: "Скидка", amount: -100 }],
      contractPrice: 2_000,
    };

    const outcome = createCalculationVersion(input);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error);

    input.parameters.targetMarginPct = 0.5;
    input.lines[0].unitPrice = 9_999;
    input.orderItems![0].linearMeters = 9;
    input.adjustments![0].amount = -999;

    expect(outcome.version.paramsSnapshot.targetMarginPct).toBe(0.18);
    expect(outcome.version.inputSnapshot.lines[0].unitPrice).toBe(1_000);
    expect(outcome.version.inputSnapshot.orderItems[0].linearMeters).toBe(1);
    expect(outcome.version.inputSnapshot.adjustments[0].amount).toBe(-100);
    expect(outcome.version.inputSnapshot.contractPrice).toBe(2_000);
    expect(outcome.version.costTotal).toBe(outcome.version.result.costTotal);
    expect(outcome.version.priceTotal).toBe(outcome.version.result.priceTotal);
  });

  it("uses the order-line technolog snapshot after the price list changes", () => {
    const priceItem = { countsForTechnolog: true };
    const orderLine = {
      id: "line-1",
      priceItemId: "price-item-1",
      isManual: false,
      name: "ЛДСП",
      unit: "лист",
      category: "materials" as const,
      qty: 2,
      unitPrice: 1_000,
      wastePct: 0,
      billableQtyRounding: "none" as const,
      countsForTechnolog: priceItem.countsForTechnolog,
    };
    const parameters = { ...defaultParameters, technologMode: "per_sheet" as const };

    const beforePriceListChange = createCalculationVersion({
      mode: "quote",
      parameters,
      lines: [orderLine],
    });
    expect(beforePriceListChange.ok).toBe(true);
    if (!beforePriceListChange.ok) throw new Error(beforePriceListChange.error);

    priceItem.countsForTechnolog = false;
    const afterPriceListChange = createCalculationVersion({
      mode: "quote",
      parameters,
      lines: [orderLine],
    });
    expect(afterPriceListChange.ok).toBe(true);
    if (!afterPriceListChange.ok) throw new Error(afterPriceListChange.error);

    expect(orderLine.countsForTechnolog).toBe(true);
    expect(afterPriceListChange.version.result.fixedTechnolog).toBe(8_000);
    expect(afterPriceListChange.version.result).toEqual(beforePriceListChange.version.result);
  });
});

describe("calculateLine", () => {
  it("calculates billable quantity and rounds total upward to KZT", () => {
    const line = calculateLine({
      id: "test-line",
      category: "materials",
      qty: 1.001,
      unitPrice: 100,
      wastePct: 0.1,
      billableQtyRounding: "none",
    });

    expect(line).toEqual({
      id: "test-line",
      billableQty: 1.1011,
      total: 111,
    });
  });

  it("applies ceil_to_unit rounding to billable quantity", () => {
    const line = calculateLine({
      category: "facades",
      qty: 6.2,
      unitPrice: 10_000,
      wastePct: 0,
      billableQtyRounding: "ceil_to_unit",
    });

    expect(line).toEqual({
      billableQty: 7,
      total: 70_000,
    });
  });
});

describe("calculatePriceDenominator", () => {
  it("calculates denominator from default parameters", () => {
    // 1 - 0.18 - 0.145 - 0.04 - 0 = 0.635
    const denom = calculatePriceDenominator(defaultParameters);
    expect(denom).toBeCloseTo(0.635, 4);
  });

  it("returns <= 0 when percentage shares sum to >= 100%", () => {
    const denom = calculatePriceDenominator({
      ...defaultParameters,
      targetMarginPct: 0.85,
    });
    expect(denom).toBeLessThanOrEqual(0);
  });
});
