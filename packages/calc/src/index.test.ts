import { describe, expect, it } from "vitest";

import { calculate, type CalculationInput, type CalculationParameters } from "./index";

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
