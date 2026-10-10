import { describe, expect, it } from "vitest";

import {
  calculate,
  calculateLine,
  calculatePriceDenominator,
  createCalculationVersion,
  MAX_PRICE_SHARES_SUM,
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
  it("calculates example A: quote with percentage assembly and technolog (new benchmark: 862 000 ₸)", () => {
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
    expect(result.priceTotal).toBe(862_000);
    expect(result.assembly).toBe(124_990);
    expect(result.technolog).toBe(34_480);
    expect(result.costTotal).toBe(706_210);
    expect(result.margin).toBe(155_790);
    expect(result.marginPct).toBeCloseTo(0.1807, 4);
  });

  it("calculates example B: checks the contract and warns below minimum price 862 000", () => {
    const result = successful({ ...exampleInput, mode: "check_contract", contractPrice: 850_000 });

    expect(result.minPriceForTargetMargin).toBe(862_000);
    expect(result.priceTotal).toBe(850_000);
    expect(result.costTotal).toBe(703_990);
    expect(result.margin).toBe(146_010);
    expect(result.marginPct).toBeCloseTo(0.171776, 5);
    expect(result.warnings).toEqual(["договор ниже минимальной цены 862 000"]);
  });

  it("preserves exact multiple without adding an extra increment at boundary", () => {
    // 400 000 / (1 - 0.5) = 800 000, which is an exact multiple of 1 000
    const boundaryInput: CalculationInput = {
      mode: "quote",
      parameters: {
        ...defaultParameters,
        targetMarginPct: 0.5,
        assemblyMode: "percent",
        assemblyPct: 0,
        technologMode: "percent",
        technologPct: 0,
        riskReservePct: 0,
        priceRounding: 1_000,
      },
      lines: [
        { category: "materials", qty: 400, unitPrice: 1_000, wastePct: 0, billableQtyRounding: "none" },
      ],
    };
    const result = successful(boundaryInput);
    expect(result.fixedCost).toBe(400_000);
    expect(result.priceTotal).toBe(800_000);
  });

  it("satisfies minimumPrice invariant across 10 000 deterministic pseudo-random orders", () => {
    let seed = 42;
    const nextRandom = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const roundings = [100, 500, 1000, 5000];

    for (let i = 0; i < 10_000; i++) {
      const fixedCost = Math.floor(nextRandom() * 4_000_000) + 50_000;
      const targetMarginPct = 0.05 + nextRandom() * 0.35; // 5% to 40%
      const assemblyPct = 0.05 + nextRandom() * 0.15; // 5% to 20%
      const technologPct = 0.01 + nextRandom() * 0.08; // 1% to 9%
      const riskReservePct = nextRandom() * 0.05; // 0% to 5%
      const priceRounding = roundings[Math.floor(nextRandom() * roundings.length)];

      const params: CalculationParameters = {
        ...defaultParameters,
        targetMarginPct,
        assemblyPct,
        technologPct,
        riskReservePct,
        priceRounding,
      };

      const denominator = calculatePriceDenominator(params);
      if (denominator <= 0) continue;

      const outcome = calculate({
        mode: "quote",
        parameters: params,
        lines: [
          { category: "materials", qty: fixedCost, unitPrice: 1, wastePct: 0, billableQtyRounding: "none" },
        ],
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error(outcome.error);

      const priceTotal = outcome.result.priceTotal;
      const rawPrice = fixedCost / denominator;

      // Invariant 1: priceTotal >= fixedCost / denominator
      expect(priceTotal).toBeGreaterThanOrEqual(rawPrice - 1e-6);

      // Invariant 2: priceTotal - rawPrice < priceRounding
      expect(priceTotal - rawPrice).toBeLessThan(priceRounding + 1e-6);

      // Invariant 3: priceTotal is a multiple of priceRounding
      expect(priceTotal % priceRounding).toBe(0);

      // Invariant 4: actual margin is >= target margin (allowing up to 3 KZT variance for separate roundKztUp ceiling on shares)
      const allowedVarianceMargin = 3 / priceTotal;
      expect(outcome.result.marginPct).toBeGreaterThanOrEqual(targetMarginPct - allowedVarianceMargin);
    }
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
      lines: [
        { category: "materials", qty: 10, unitPrice: 14_000, wastePct: 0, billableQtyRounding: "none" },
        { category: "other", qty: 0, unitPrice: 99_999, wastePct: 0.1, billableQtyRounding: "none" },
      ],
    });

    expect(result.lineCalculations[1]).toMatchObject({ billableQty: 0, total: 0 });
    expect(result.categoryTotals.other).toBe(0);
  });

  it("enforces MAX_PRICE_SHARES_SUM boundary: exactly 0.80 succeeds, >0.80 returns parameters_share_too_high", () => {
    expect(MAX_PRICE_SHARES_SUM).toBe(0.8);

    // 0.615 + 0.145 + 0.04 + 0 = 0.80
    const exactMaxOutcome = calculate({
      ...exampleInput,
      parameters: { ...defaultParameters, targetMarginPct: 0.615 },
    });
    expect(exactMaxOutcome.ok).toBe(true);

    // 0.6151 + 0.145 + 0.04 + 0 = 0.8001 > 0.80
    const tooHighOutcome = calculate({
      ...exampleInput,
      parameters: { ...defaultParameters, targetMarginPct: 0.6151 },
    });
    expect(tooHighOutcome).toEqual({ ok: false, error: "parameters_share_too_high" });
  });

  it("returns price_not_positive error in quote mode when discount makes price <= 0", () => {
    const negativeOutcome = calculate({
      ...exampleInput,
      adjustments: [{ kind: "price", amount: -1_000_000 }],
    });
    expect(negativeOutcome).toEqual({ ok: false, error: "price_not_positive" });

    const zeroOutcome = calculate({
      ...exampleInput,
      adjustments: [{ kind: "price", amount: -862_000 }],
    });
    expect(zeroOutcome).toEqual({ ok: false, error: "price_not_positive" });
  });

  it("adds warning when cost adjustments make fixed costs negative", () => {
    const outcome = calculate({
      ...exampleInput,
      mode: "check_contract",
      contractPrice: 850_000,
      adjustments: [{ kind: "cost", amount: -600_000 }],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.result.warnings).toContain("корректировки сделали затраты отрицательными");
  });

  it("adds warning when contract price is zero in check_contract mode", () => {
    const outcome = calculate({
      ...exampleInput,
      mode: "check_contract",
      contractPrice: 0,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.result.warnings).toContain("цена договора равна 0");
  });

  it("returns an error when parameters leave no share for fixed costs (fallback when > 100%)", () => {
    expect(
      calculate({
        ...exampleInput,
        parameters: { ...defaultParameters, targetMarginPct: 0.82 },
      }),
    ).toEqual({ ok: false, error: "parameters_share_too_high" });
  });

  it("applies negative price adjustments as a discount after base price rounding", () => {
    const result = successful({
      ...exampleInput,
      adjustments: [{ kind: "price", amount: -12_000 }],
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

  it("avoids IEEE-754 precision bug giving extra unit for 50, 90, 100 with 10% waste and ceil_to_unit", () => {
    const l50 = calculateLine({
      category: "materials",
      qty: 50,
      unitPrice: 100,
      wastePct: 0.1,
      billableQtyRounding: "ceil_to_unit",
    });
    const l90 = calculateLine({
      category: "materials",
      qty: 90,
      unitPrice: 100,
      wastePct: 0.1,
      billableQtyRounding: "ceil_to_unit",
    });
    const l100 = calculateLine({
      category: "materials",
      qty: 100,
      unitPrice: 100,
      wastePct: 0.1,
      billableQtyRounding: "ceil_to_unit",
    });

    expect(l50.billableQty).toBe(55);
    expect(l90.billableQty).toBe(99);
    expect(l100.billableQty).toBe(110);
  });
});

describe("calculate input validation", () => {
  it("returns invalid_input when priceRounding <= 0 or not finite", () => {
    const outcomeZero = calculate({
      ...exampleInput,
      parameters: { ...defaultParameters, priceRounding: 0 },
    });
    expect(outcomeZero.ok).toBe(false);
    if (!outcomeZero.ok) {
      expect(outcomeZero.error).toBe("invalid_input");
      expect((outcomeZero as any).details).toBeDefined();
    }

    const outcomeNeg = calculate({
      ...exampleInput,
      parameters: { ...defaultParameters, priceRounding: -100 },
    });
    expect(outcomeNeg.ok).toBe(false);
    if (!outcomeNeg.ok) {
      expect(outcomeNeg.error).toBe("invalid_input");
    }
  });

  it("returns invalid_input when negative quantities, negative prices, or NaN are passed", () => {
    const outcomeNaN = calculate({
      ...exampleInput,
      lines: [
        { category: "materials", qty: NaN, unitPrice: 100, wastePct: 0, billableQtyRounding: "none" },
      ],
    });
    expect(outcomeNaN.ok).toBe(false);
    if (!outcomeNaN.ok) {
      expect(outcomeNaN.error).toBe("invalid_input");
      expect((outcomeNaN as any).details?.length).toBeGreaterThan(0);
    }

    const outcomeNegQty = calculate({
      ...exampleInput,
      lines: [
        { category: "materials", qty: -5, unitPrice: 100, wastePct: 0, billableQtyRounding: "none" },
      ],
    });
    expect(outcomeNegQty.ok).toBe(false);
    if (!outcomeNegQty.ok) {
      expect(outcomeNegQty.error).toBe("invalid_input");
    }

    const outcomeNegPrice = calculate({
      ...exampleInput,
      lines: [
        { category: "materials", qty: 5, unitPrice: -100, wastePct: 0, billableQtyRounding: "none" },
      ],
    });
    expect(outcomeNegPrice.ok).toBe(false);
    if (!outcomeNegPrice.ok) {
      expect(outcomeNegPrice.error).toBe("invalid_input");
    }
  });

  it("returns invalid_input when negative contractPrice is passed", () => {
    const outcome = calculate({
      ...exampleInput,
      mode: "check_contract",
      contractPrice: -500_000,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe("invalid_input");
    }
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
