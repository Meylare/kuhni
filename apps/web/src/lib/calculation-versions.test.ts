import { describe, expect, it } from "vitest";

import type { Order, OrderCalculation, OrderLine } from "../types/database";
import {
  DEFAULT_PARAMETERS,
  parametersArrayToMap,
} from "./parameters";
import {
  DEFAULT_SNAPSHOT_PARAMS,
  getPlanCalculation,
  normalizeOrderCalculation,
  prepareCalculationSnapshot,
  resolveOrderDisplayCalculation,
  SnapshotCorruptedError,
} from "./orders";

describe("Step B5: Calculation versions snapshot format and compatibility layer", () => {
  const sampleOrder: Order = {
    id: "ord-test-1",
    name: "Тестовый заказ кухни",
    client_label: "Иван",
    status: "draft",
    contract_price: 850_000,
    settings: {},
    note: null,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
  };

  const sampleLine: OrderLine = {
    id: "line-1",
    order_id: "ord-test-1",
    order_item_id: null,
    price_item_id: "pi-1",
    category: "materials",
    name: "ЛДСП белый стандарт",
    unit: "лист",
    qty: 10,
    unit_price: 14_000,
    waste_pct: 0,
    billable_qty_rounding: "none",
    counts_for_technolog: true,
    is_manual: false,
    comment: null,
  };

  it("prepareCalculationSnapshot creates snapshot using packages/calc format", () => {
    const payload = prepareCalculationSnapshot({
      order: sampleOrder,
      items: [],
      lines: [sampleLine],
      adjustments: [],
      globalParams: DEFAULT_PARAMETERS,
      mode: "quote",
    });

    expect(payload.order_id).toBe("ord-test-1");
    expect(payload.mode).toBe("quote");

    // params_snapshot should use camelCase from CalculationParameters
    const params = payload.params_snapshot as Record<string, unknown>;
    expect(params.targetMarginPct).toBe(0.18);
    expect(params.assemblyMode).toBe("percent");
    expect(params.priceRounding).toBe(1000);

    // input_snapshot should contain lines and orderItems
    const input = payload.input_snapshot as Record<string, unknown>;
    expect(Array.isArray(input.lines)).toBe(true);
    expect(Array.isArray(input.orderItems)).toBe(true);

    const firstLine = (input.lines as Array<Record<string, unknown>>)[0];
    expect(firstLine.unitPrice).toBe(14_000);
    expect(firstLine.qty).toBe(10);

    // result
    const result = payload.result as Record<string, unknown>;
    expect(result.costTotal).toBeGreaterThan(0);
    expect(result.priceTotal).toBeGreaterThan(0);
  });

  it("throws SnapshotCorruptedError when mandatory parameters fields are missing", () => {
    const corruptedParamsCalc: OrderCalculation = {
      id: "calc-bad-params",
      order_id: "ord-test-1",
      version: 1,
      mode: "quote",
      params_snapshot: {
        // targetMarginPct missing
        assemblyMode: "percent",
        assemblyPct: 0.145,
        assemblyPerMeterKitchen: 35000,
        assemblyPerMeterWardrobe: 25000,
        technologMode: "percent",
        technologPct: 0.04,
        technologPerSheet: 4000,
        riskReservePct: 0.02,
        priceRounding: 1000,
      },
      input_snapshot: { lines: [] },
      result: {
        categoryTotals: {},
        costTotal: 100000,
        priceTotal: 130000,
        margin: 30000,
        marginPct: 0.2307,
        fixedCost: 20000,
        fixedAssembly: 15000,
        fixedTechnolog: 5000,
        assembly: 15000,
        technolog: 5000,
        riskReserve: 2000,
        minPriceForTargetMargin: 125000,
        warnings: [],
        lineCalculations: [],
      },
      cost_total: 100000,
      price_total: 130000,
      margin_pct: 0.2307,
      is_contract_baseline: false,
      created_at: "2026-10-01T12:00:00Z",
    };

    expect(() => normalizeOrderCalculation(corruptedParamsCalc)).toThrow(SnapshotCorruptedError);
    try {
      normalizeOrderCalculation(corruptedParamsCalc);
    } catch (e: any) {
      expect(e).toBeInstanceOf(SnapshotCorruptedError);
      expect(e.missingField).toBe("targetMarginPct");
    }
  });

  it("throws SnapshotCorruptedError when mandatory lines or result fields are missing", () => {
    const corruptedLinesCalc: OrderCalculation = {
      id: "calc-bad-lines",
      order_id: "ord-test-1",
      version: 1,
      mode: "quote",
      params_snapshot: DEFAULT_SNAPSHOT_PARAMS,
      input_snapshot: {
        lines: [
          {
            id: "line-1",
            name: "ЛДСП",
            category: "materials",
            unit: "лист",
            // qty is missing
            unitPrice: 14000,
            wastePct: 0.10,
          },
        ],
      },
      result: {
        categoryTotals: {},
        costTotal: 100000,
        priceTotal: 130000,
        margin: 30000,
        marginPct: 0.2307,
        fixedCost: 20000,
        fixedAssembly: 15000,
        fixedTechnolog: 5000,
        assembly: 15000,
        technolog: 5000,
        riskReserve: 2000,
        minPriceForTargetMargin: 125000,
        warnings: [],
        lineCalculations: [],
      },
      cost_total: 100000,
      price_total: 130000,
      margin_pct: 0.2307,
      is_contract_baseline: false,
      created_at: "2026-10-01T12:00:00Z",
    };

    expect(() => normalizeOrderCalculation(corruptedLinesCalc)).toThrow(SnapshotCorruptedError);
    try {
      normalizeOrderCalculation(corruptedLinesCalc);
    } catch (e: any) {
      expect(e).toBeInstanceOf(SnapshotCorruptedError);
      expect(e.missingField).toBe("lines[0].qty");
    }

    const corruptedResultCalc: OrderCalculation = {
      ...corruptedLinesCalc,
      input_snapshot: { lines: [] },
      result: {
        // costTotal missing
        categoryTotals: {},
        priceTotal: 130000,
        margin: 30000,
      },
    };

    expect(() => normalizeOrderCalculation(corruptedResultCalc)).toThrow(SnapshotCorruptedError);
    try {
      normalizeOrderCalculation(corruptedResultCalc);
    } catch (e: any) {
      expect(e).toBeInstanceOf(SnapshotCorruptedError);
      expect(e.missingField).toBe("costTotal");
    }
  });

  it("normalizeOrderCalculation recognizes modern packages/calc camelCase format", () => {
    const modernCalc: OrderCalculation = {
      id: "calc-new-2",
      order_id: "ord-test-1",
      version: 2,
      mode: "check_contract",
      params_snapshot: {
        targetMarginPct: 0.20,
        assemblyMode: "per_meter",
        assemblyPct: 0.15,
        assemblyPerMeterKitchen: 40000,
        assemblyPerMeterWardrobe: 30000,
        technologMode: "per_sheet",
        technologPct: 0.05,
        technologPerSheet: 5000,
        riskReservePct: 0.01,
        priceRounding: 500,
      },
      input_snapshot: {
        contractPrice: 850000,
        orderItems: [
          {
            id: "item-1",
            title: "Кухня",
            kind: "kitchen",
            linearMeters: 3,
          },
        ],
        lines: [
          {
            id: "line-1",
            category: "materials",
            name: "ЛДСП",
            unit: "лист",
            qty: 4,
            unitPrice: 20000,
            wastePct: 0,
            billableQtyRounding: "none",
            countsForTechnolog: true,
            isManual: false,
          },
        ],
        adjustments: [],
      },
      result: {
        categoryTotals: { materials: 80000 },
        costTotal: 200000,
        priceTotal: 850000,
        margin: 650000,
        marginPct: 0.7647,
        fixedCost: 40000,
        fixedAssembly: 120000,
        fixedTechnolog: 20000,
        assembly: 120000,
        technolog: 20000,
        riskReserve: 8500,
        minPriceForTargetMargin: 300000,
        warnings: [],
        lineCalculations: [],
      },
      cost_total: 200000,
      price_total: 850000,
      margin_pct: 0.7647,
      is_contract_baseline: true,
      created_at: "2026-10-02T12:00:00Z",
    };

    const normalized = normalizeOrderCalculation(modernCalc);

    expect(normalized.version).toBe(2);
    expect(normalized.isContractBaseline).toBe(true);
    expect(normalized.parameters.targetMarginPct).toBe(0.20);
    expect(normalized.parameters.assemblyMode).toBe("per_meter");
    expect(normalized.parameters.assemblyPerMeterKitchen).toBe(40000);

    expect(normalized.input.contractPrice).toBe(850000);
    expect(normalized.input.items[0].linearMeters).toBe(3);
    expect(normalized.input.lines[0].unitPrice).toBe(20000);

    expect(normalized.result.priceTotal).toBe(850000);
  });

  it("resolveOrderDisplayCalculation does not crash on corrupted calculation version and falls back", () => {
    const corruptedCalc: OrderCalculation = {
      id: "calc-corrupted",
      order_id: "ord-test-1",
      version: 1,
      mode: "quote",
      params_snapshot: {}, // missing all fields
      input_snapshot: {},
      result: {},
      cost_total: 100000,
      price_total: 130000,
      margin_pct: 0.23,
      is_contract_baseline: false,
      created_at: "2026-10-01T10:00:00Z",
    };

    // Should not throw, should fall back to liveOutcome
    const display = resolveOrderDisplayCalculation({
      order: sampleOrder,
      calculations: [corruptedCalc],
      liveOutcome: {
        ok: true,
        result: {
          priceTotal: 500000,
          costTotal: 400000,
          margin: 100000,
          marginPct: 0.20,
          fixedCost: 50000,
          fixedAssembly: 30000,
          fixedTechnolog: 10000,
          assembly: 30000,
          technolog: 10000,
          riskReserve: 0,
          minPriceForTargetMargin: 500000,
          warnings: [],
          categoryTotals: {
            materials: 300000,
            workshop: 0,
            facades: 0,
            hardware: 0,
            transport: 0,
            labor: 0,
            other: 0,
            adjustments: 0,
          },
          lineCalculations: [],
        },
      },
      mode: "quote",
      showLivePreview: false,
    });

    expect(display).not.toBeNull();
    expect(display?.source).toBe("live");
    expect(display?.priceTotal).toBe(500000);
  });

  it("getPlanCalculation filters out corrupted calculations and selects the latest valid one", () => {
    const corruptedCalc: OrderCalculation = {
      id: "calc-bad-1",
      order_id: "ord-test-1",
      version: 2, // higher version, but corrupted!
      mode: "quote",
      params_snapshot: {},
      input_snapshot: {},
      result: {},
      cost_total: 500000,
      price_total: 600000,
      margin_pct: 0.2,
      is_contract_baseline: false,
      created_at: "2026-10-02T10:00:00Z",
    };

    const validCalc: OrderCalculation = {
      id: "calc-good-1",
      order_id: "ord-test-1",
      version: 1,
      mode: "quote",
      params_snapshot: DEFAULT_SNAPSHOT_PARAMS,
      input_snapshot: { lines: [] },
      result: {
        costTotal: 100000,
        priceTotal: 130000,
        margin: 30000,
        marginPct: 0.23,
        fixedCost: 20000,
        fixedAssembly: 10000,
        fixedTechnolog: 5000,
        assembly: 10000,
        technolog: 5000,
        riskReserve: 0,
        minPriceForTargetMargin: 130000,
        warnings: [],
        categoryTotals: {},
        lineCalculations: [],
      },
      cost_total: 100000,
      price_total: 130000,
      margin_pct: 0.23,
      is_contract_baseline: false,
      created_at: "2026-10-01T10:00:00Z",
    };

    const plan = getPlanCalculation([corruptedCalc, validCalc]);
    expect(plan?.id).toBe("calc-good-1");
    expect(plan?.version).toBe(1);
  });
});
