import { describe, expect, it } from "vitest";

import type { Order, OrderCalculation, OrderLine } from "../types/database";
import {
  DEFAULT_PARAMETERS,
  parametersArrayToMap,
} from "./parameters";
import {
  normalizeOrderCalculation,
  prepareCalculationSnapshot,
  resolveOrderDisplayCalculation,
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

  it("normalizeOrderCalculation recognizes legacy snake_case format", () => {
    const legacyCalc: OrderCalculation = {
      id: "calc-old-1",
      order_id: "ord-test-1",
      version: 1,
      mode: "quote",
      params_snapshot: {
        target_margin_pct: 0.18,
        assembly_mode: "percent",
        assembly_pct: 0.145,
        assembly_per_meter_kitchen: 35000,
        assembly_per_meter_wardrobe: 25000,
        technolog_mode: "percent",
        technolog_pct: 0.04,
        technolog_per_sheet: 4000,
        risk_reserve_pct: 0.02,
        price_rounding: 1000,
      },
      input_snapshot: {
        contract_price: null,
        items: [
          {
            id: "item-1",
            title: "Кухня",
            kind: "kitchen",
            linear_meters: 3.5,
          },
        ],
        lines: [
          {
            id: "line-1",
            category: "materials",
            name: "ЛДСП",
            unit: "лист",
            qty: 5,
            unit_price: 14000,
            waste_pct: 0.10,
            billable_qty_rounding: "none",
            counts_for_technolog: true,
            is_manual: false,
          },
        ],
        adjustments: [],
      },
      result: {
        categoryTotals: { materials: 77000 },
        costTotal: 100000,
        priceTotal: 130000,
        margin: 30000,
        marginPct: 0.2307,
        assembly: 18850,
        technolog: 5200,
        riskReserve: 2600,
        minPriceForTargetMargin: 125000,
        warnings: [],
      },
      cost_total: 100000,
      price_total: 130000,
      margin_pct: 0.2307,
      is_contract_baseline: false,
      created_at: "2026-10-01T12:00:00Z",
    };

    const normalized = normalizeOrderCalculation(legacyCalc);

    expect(normalized.version).toBe(1);
    expect(normalized.parameters.targetMarginPct).toBe(0.18);
    expect(normalized.parameters.assemblyMode).toBe("percent");
    expect(normalized.parameters.riskReservePct).toBe(0.02);

    expect(normalized.input.items[0].linearMeters).toBe(3.5);
    expect(normalized.input.lines[0].unitPrice).toBe(14000);
    expect(normalized.input.lines[0].wastePct).toBe(0.10);

    expect(normalized.result.costTotal).toBe(100000);
    expect(normalized.result.priceTotal).toBe(130000);
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
        assembly: 120000,
        technolog: 20000,
        riskReserve: 8500,
        minPriceForTargetMargin: 300000,
        warnings: [],
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

  it("resolveOrderDisplayCalculation renders accurately for both old and new formats", () => {
    const legacyCalc: OrderCalculation = {
      id: "calc-1",
      order_id: "ord-test-1",
      version: 1,
      mode: "quote",
      params_snapshot: { target_margin_pct: 0.18 },
      input_snapshot: {},
      result: {
        cost_total: 706025,
        price_total: 861000,
        margin_pct: 0.18,
        category_totals: { materials: 300000 },
        assembly: 124845,
        technolog: 34440,
      },
      cost_total: 706025,
      price_total: 861000,
      margin_pct: 0.18,
      is_contract_baseline: true,
      created_at: "2026-10-01T12:00:00Z",
    };

    const display = resolveOrderDisplayCalculation({
      order: sampleOrder,
      calculations: [legacyCalc],
      liveOutcome: null,
      mode: "quote",
      showLivePreview: false,
    });

    expect(display).not.toBeNull();
    expect(display?.source).toBe("saved");
    expect(display?.priceTotal).toBe(861000);
    expect(display?.costTotal).toBe(706025);
    expect(display?.assembly).toBe(124845);
    expect(display?.technolog).toBe(34440);
  });
});
