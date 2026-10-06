import { describe, expect, it } from "vitest";

import type {
  Order,
  OrderAdjustment,
  OrderItem,
  OrderLine,
  OrderWithCalculations,
} from "../types/database";
import { DEFAULT_PARAMETERS } from "./parameters";
import {
  buildCalculationInput,
  calculateOrderLive,
  filterOrders,
  getLatestCalculation,
  getLineCalculationsMap,
  getOrderLineCalculation,
  isOrderLocked,
  mergeOrderParameters,
  sortOrders,
  validateAdjustmentInput,
  validateManualLineInput,
  validateOrderInput,
  validateOrderItemInput,
} from "./orders";

describe("orders helpers", () => {
  const sampleOrders: OrderWithCalculations[] = [
    {
      id: "ord-1",
      name: "Кухня для Анны",
      client_label: "Анна Сафина",
      status: "draft",
      contract_price: null,
      settings: {},
      note: null,
      created_at: "2026-10-01T10:00:00Z",
      updated_at: "2026-10-01T10:00:00Z",
      calculations: [
        {
          id: "calc-1",
          version: 1,
          mode: "quote",
          price_total: 800_000,
          cost_total: 650_000,
          margin_pct: 0.1875,
          created_at: "2026-10-01T10:30:00Z",
        },
        {
          id: "calc-2",
          version: 2,
          mode: "quote",
          price_total: 861_000,
          cost_total: 706_025,
          margin_pct: 0.18,
          created_at: "2026-10-01T11:00:00Z",
        },
      ],
    },
    {
      id: "ord-2",
      name: "Шкаф в прихожую",
      client_label: "Берик",
      status: "approved",
      contract_price: 450_000,
      settings: {},
      note: "Срочно",
      created_at: "2026-10-02T14:00:00Z",
      updated_at: "2026-10-02T14:00:00Z",
      calculations: [],
    },
  ];

  it("extracts the latest calculation version", () => {
    const latest = getLatestCalculation(sampleOrders[0]);
    expect(latest?.version).toBe(2);
    expect(latest?.price_total).toBe(861_000);

    const empty = getLatestCalculation(sampleOrders[1]);
    expect(empty).toBeNull();
  });

  it("filters orders by query and status", () => {
    // Search by name
    expect(filterOrders(sampleOrders, "кухня", "all")).toHaveLength(1);
    expect(filterOrders(sampleOrders, "кухня", "all")[0].id).toBe("ord-1");

    // Search by client label
    expect(filterOrders(sampleOrders, "берик", "all")).toHaveLength(1);
    expect(filterOrders(sampleOrders, "берик", "all")[0].id).toBe("ord-2");

    // Filter by status
    expect(filterOrders(sampleOrders, "", "draft")).toHaveLength(1);
    expect(filterOrders(sampleOrders, "", "approved")).toHaveLength(1);
    expect(filterOrders(sampleOrders, "", "done")).toHaveLength(0);
  });

  it("sorts orders by newest and oldest", () => {
    const newest = sortOrders(sampleOrders, "newest");
    expect(newest[0].id).toBe("ord-2");

    const oldest = sortOrders(sampleOrders, "oldest");
    expect(oldest[0].id).toBe("ord-1");
  });

  it("identifies locked status correctly", () => {
    expect(isOrderLocked("draft")).toBe(false);
    expect(isOrderLocked("quoted")).toBe(false);
    expect(isOrderLocked("approved")).toBe(true);
    expect(isOrderLocked("in_production")).toBe(true);
    expect(isOrderLocked("done")).toBe(true);
    expect(isOrderLocked("cancelled")).toBe(true);
  });

  it("merges custom order settings with global parameters", () => {
    const merged = mergeOrderParameters(DEFAULT_PARAMETERS, {
      target_margin_pct: 0.22,
      assembly_mode: "per_meter",
    });
    expect(merged.targetMarginPct).toBe(0.22);
    expect(merged.assemblyMode).toBe("per_meter");
    // Fallbacks to default
    expect(merged.technologPct).toBe(0.04);
  });

  it("validates user inputs accurately", () => {
    expect(validateOrderInput({ name: "" }).valid).toBe(false);
    expect(validateOrderInput({ name: "Заказ 1", contract_price: -5 }).valid).toBe(false);
    expect(validateOrderInput({ name: "Заказ 1", contract_price: 500_000 }).valid).toBe(true);

    expect(validateOrderItemInput({ title: "", kind: "kitchen" }).valid).toBe(false);
    expect(validateOrderItemInput({ title: "Кухня", kind: "kitchen", linear_meters: -1 }).valid).toBe(false);
    expect(validateOrderItemInput({ title: "Кухня", kind: "kitchen", linear_meters: 3 }).valid).toBe(true);

    expect(validateManualLineInput({ name: "", category: "materials", qty: 1, unit_price: 100 }).valid).toBe(false);
    expect(validateManualLineInput({ name: "Транспорт", category: "transport", qty: 0, unit_price: 100 }).valid).toBe(false);
    expect(validateManualLineInput({ name: "Транспорт", category: "transport", qty: 1, unit_price: -100 }).valid).toBe(false);
    expect(validateManualLineInput({ name: "Транспорт", category: "transport", qty: 1, unit_price: 20_000 }).valid).toBe(true);

    expect(validateAdjustmentInput({ label: "", amount: 100 }).valid).toBe(false);
    expect(validateAdjustmentInput({ label: "Скидка", amount: -10_000 }).valid).toBe(true);
  });

  it("calculates live baseline example accurately with packages/calc", () => {
    const order: Order = {
      id: "ord-test",
      name: "Эталонная кухня",
      client_label: "Тест",
      status: "draft",
      contract_price: null,
      settings: {},
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const items: OrderItem[] = [
      {
        id: "item-1",
        order_id: "ord-test",
        kind: "kitchen",
        title: "Кухня",
        description: null,
        linear_meters: 3,
        dims: {},
      },
    ];

    const lines: OrderLine[] = [
      {
        id: "l-1",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-1",
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
      },
      {
        id: "l-2",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-2",
        category: "materials",
        name: "Кромка дешёвая",
        unit: "м",
        qty: 120,
        unit_price: 70,
        waste_pct: 0.1,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-3",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-3",
        category: "facades",
        name: "МДФ плёнка, Фрезеровка 18 мм",
        unit: "м2",
        qty: 6,
        unit_price: 26_000,
        waste_pct: 0,
        billable_qty_rounding: "ceil_to_unit",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-4",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-4",
        category: "materials",
        name: "ДВП",
        unit: "лист",
        qty: 2,
        unit_price: 7_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-5",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-5",
        category: "workshop",
        name: "Распил обычный ЛДСП",
        unit: "лист",
        qty: 10,
        unit_price: 2_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-6",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-6",
        category: "workshop",
        name: "Присадка ЛДСП",
        unit: "лист",
        qty: 10,
        unit_price: 6_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-7",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-7",
        category: "workshop",
        name: "Закатка кромки стандарт",
        unit: "м",
        qty: 120,
        unit_price: 200,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-8",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-8",
        category: "workshop",
        name: "Распил ДВП",
        unit: "лист",
        qty: 2,
        unit_price: 1_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-9",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-9",
        category: "facades",
        name: "Присадка МДФ",
        unit: "м2",
        qty: 6,
        unit_price: 2_000,
        waste_pct: 0,
        billable_qty_rounding: "ceil_to_unit",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-10",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-10",
        category: "workshop",
        name: "Доставка до цеха",
        unit: "проект",
        qty: 1,
        unit_price: 3_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-11",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-11",
        category: "workshop",
        name: "Упаковка",
        unit: "шт",
        qty: 12,
        unit_price: 2_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-12",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-12",
        category: "hardware",
        name: "Тандем полного выдвижения 500",
        unit: "шт",
        qty: 5,
        unit_price: 6_500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-13",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-13",
        category: "hardware",
        name: "Петли GTV",
        unit: "шт",
        qty: 20,
        unit_price: 750,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-14",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: null,
        category: "transport",
        name: "Транспорт (ручная позиция)",
        unit: "проект",
        qty: 1,
        unit_price: 20_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: true,
        comment: null,
      },
      {
        id: "l-15",
        order_id: "ord-test",
        order_item_id: "item-1",
        price_item_id: "p-15",
        category: "labor",
        name: "Подключение мойки",
        unit: "шт",
        qty: 1,
        unit_price: 15_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
    ];

    const adjustments: OrderAdjustment[] = [];

    const outcome = calculateOrderLive({
      order,
      items,
      lines,
      adjustments,
      globalParams: DEFAULT_PARAMETERS,
      mode: "quote",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error);

    expect(outcome.result.fixedCost).toBe(546_740);
    expect(outcome.result.priceTotal).toBe(861_000);
    expect(outcome.result.costTotal).toBe(706_025);
    expect(outcome.result.margin).toBe(154_975);
    expect(outcome.result.marginPct).toBeCloseTo(0.18, 4);

    // Now test contract check mode with 850 000
    const contractOutcome = calculateOrderLive({
      order: { ...order, contract_price: 850_000 },
      items,
      lines,
      adjustments,
      globalParams: DEFAULT_PARAMETERS,
      mode: "check_contract",
    });

    expect(contractOutcome.ok).toBe(true);
    if (!contractOutcome.ok) throw new Error(contractOutcome.error);

    expect(contractOutcome.result.priceTotal).toBe(850_000);
    expect(contractOutcome.result.costTotal).toBe(703_990);
    expect(contractOutcome.result.margin).toBe(146_010);
    expect(contractOutcome.result.marginPct).toBeCloseTo(0.1718, 3);
    expect(contractOutcome.result.warnings).toEqual([
      "договор ниже минимальной цены 861 000",
    ]);
  });

  it("calculates the 886 000 variant from ui_spec.md when 10% waste applies to MDF", () => {
    const order: Order = {
      id: "ord-886",
      name: "Кухня 886k",
      client_label: "Клиент",
      status: "draft",
      contract_price: null,
      settings: {},
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const items: OrderItem[] = [
      {
        id: "item-1",
        order_id: "ord-886",
        kind: "kitchen",
        title: "Кухня",
        description: null,
        linear_meters: 3,
        dims: {},
      },
    ];

    // With 10% waste on MDF: 6 m2 * 1.10 = 6.6 m2 (non-rounded) -> 171 600 KZT (+15 600)
    const lines: OrderLine[] = [
      {
        id: "l-1",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-1",
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
      },
      {
        id: "l-2",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-2",
        category: "materials",
        name: "Кромка дешёвая",
        unit: "м",
        qty: 120,
        unit_price: 70,
        waste_pct: 0.1,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-3",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-3",
        category: "facades",
        name: "МДФ плёнка, Фрезеровка 18 мм",
        unit: "м2",
        qty: 6,
        unit_price: 26_000,
        waste_pct: 0.1,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-4",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-4",
        category: "materials",
        name: "ДВП",
        unit: "лист",
        qty: 2,
        unit_price: 7_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-5",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-5",
        category: "workshop",
        name: "Распил обычный ЛДСП",
        unit: "лист",
        qty: 10,
        unit_price: 2_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-6",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-6",
        category: "workshop",
        name: "Присадка ЛДСП",
        unit: "лист",
        qty: 10,
        unit_price: 6_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-7",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-7",
        category: "workshop",
        name: "Закатка кромки стандарт",
        unit: "м",
        qty: 120,
        unit_price: 200,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-8",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-8",
        category: "workshop",
        name: "Распил ДВП",
        unit: "лист",
        qty: 2,
        unit_price: 1_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-9",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-9",
        category: "facades",
        name: "Присадка МДФ",
        unit: "м2",
        qty: 6,
        unit_price: 2_000,
        waste_pct: 0,
        billable_qty_rounding: "ceil_to_unit",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-10",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-10",
        category: "workshop",
        name: "Доставка до цеха",
        unit: "проект",
        qty: 1,
        unit_price: 3_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-11",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-11",
        category: "workshop",
        name: "Упаковка",
        unit: "шт",
        qty: 12,
        unit_price: 2_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-12",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-12",
        category: "hardware",
        name: "Тандем полного выдвижения 500",
        unit: "шт",
        qty: 5,
        unit_price: 6_500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-13",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-13",
        category: "hardware",
        name: "Петли GTV",
        unit: "шт",
        qty: 20,
        unit_price: 750,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-14",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: null,
        category: "transport",
        name: "Транспорт (ручная позиция)",
        unit: "проект",
        qty: 1,
        unit_price: 20_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: true,
        comment: null,
      },
      {
        id: "l-15",
        order_id: "ord-886",
        order_item_id: "item-1",
        price_item_id: "p-15",
        category: "labor",
        name: "Подключение мойки",
        unit: "шт",
        qty: 1,
        unit_price: 15_000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
    ];

    const outcome = calculateOrderLive({
      order,
      items,
      lines,
      adjustments: [],
      globalParams: DEFAULT_PARAMETERS,
      mode: "quote",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error);

    expect(outcome.result.fixedCost).toBe(562_340);
    expect(outcome.result.priceTotal).toBe(886_000);
    expect(outcome.result.costTotal).toBe(726_250);
    expect(outcome.result.margin).toBe(159_750);
    expect(outcome.result.marginPct).toBeCloseTo(0.1803, 3);

    // Contract price test 850 000
    const contractOutcome = calculateOrderLive({
      order: { ...order, contract_price: 850_000 },
      items,
      lines,
      adjustments: [],
      globalParams: DEFAULT_PARAMETERS,
      mode: "check_contract",
    });

    expect(contractOutcome.ok).toBe(true);
    if (!contractOutcome.ok) throw new Error(contractOutcome.error);

    expect(contractOutcome.result.priceTotal).toBe(850_000);
    expect(contractOutcome.result.costTotal).toBe(719_590);
    expect(contractOutcome.result.margin).toBe(130_410);
    expect(contractOutcome.result.marginPct).toBeCloseTo(0.1534, 3);
    expect(contractOutcome.result.warnings).toEqual([
      "договор ниже минимальной цены 886 000",
    ]);
  });

  it("calculates individual order line and maps line calculations by id using packages/calc", () => {
    const line: OrderLine = {
      id: "line-test-1",
      order_id: "ord-test",
      order_item_id: null,
      price_item_id: null,
      category: "facades",
      name: "Фасад МДФ",
      unit: "м2",
      qty: 6.2,
      unit_price: 26_000,
      waste_pct: 0,
      billable_qty_rounding: "ceil_to_unit",
      counts_for_technolog: false,
      is_manual: true,
      comment: null,
    };

    const calc = getOrderLineCalculation(line);
    expect(calc).toEqual({
      id: "line-test-1",
      billableQty: 7,
      total: 182_000,
    });

    const map = getLineCalculationsMap([calc]);
    expect(map.get("line-test-1")).toEqual(calc);
  });
});
