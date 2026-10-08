import { describe, expect, it } from "vitest";

import type {
  Order,
  OrderAdjustment,
  OrderCalculation,
  OrderItem,
  OrderLine,
  OrderWithCalculations,
  PriceItem,
} from "../types/database";
import { DEFAULT_PARAMETERS } from "./parameters";
import {
  buildCalculationInput,
  calculateOrderLive,
  computePriceUpdatesDiff,
  filterOrders,
  getLatestCalculation,
  getPlanCalculation,
  resolveOrderDisplayCalculation,
  getLineCalculationsMap,
  getOrderLineCalculation,
  isOrderLocked,
  mergeOrderParameters,
  prepareCalculationSnapshot,
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

  describe("Step U5: calculation snapshots, price change detection, and scenario steps 5-7", () => {
    const baseOrder: Order = {
      id: "ord-e2e-u5",
      name: "Кухня 3м сквозной сценарий",
      client_label: "Заказчик",
      status: "draft",
      contract_price: null,
      settings: {},
      note: null,
      created_at: "2026-10-06T10:00:00Z",
      updated_at: "2026-10-06T10:00:00Z",
    };

    const baseItems: OrderItem[] = [
      {
        id: "item-1",
        order_id: "ord-e2e-u5",
        kind: "kitchen",
        title: "Кухня",
        description: null,
        linear_meters: 3,
        dims: {},
      },
    ];

    // Эталонный набор позиций из backend_spec и ui_spec (с 10% отходом на МДФ)
    const baseLines: OrderLine[] = [
      {
        id: "l-ldsp",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-ldsp",
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
        id: "l-edge",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-edge",
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
        id: "l-mdf",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-mdf",
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
        id: "l-dvp",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-dvp",
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
        id: "l-cut",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-cut",
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
        id: "l-prisadka",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-prisadka",
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
        id: "l-edge-work",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-edge-work",
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
        id: "l-dvp-cut",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-dvp-cut",
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
        id: "l-mdf-prisadka",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-mdf-prisadka",
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
        id: "l-delivery",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-delivery",
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
        id: "l-pack",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-pack",
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
        id: "l-tandem",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-tandem",
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
        id: "l-hinges",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-hinges",
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
        id: "l-transport",
        order_id: "ord-e2e-u5",
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
        id: "l-labor",
        order_id: "ord-e2e-u5",
        order_item_id: "item-1",
        price_item_id: "price-labor",
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

    it("prepares calculation snapshot and validates immutability structure", () => {
      const outcome = calculateOrderLive({
        order: baseOrder,
        items: baseItems,
        lines: baseLines,
        adjustments: [],
        globalParams: DEFAULT_PARAMETERS,
        mode: "quote",
      });

      expect(outcome.ok).toBe(true);
      const snapshot = prepareCalculationSnapshot({
        order: baseOrder,
        items: baseItems,
        lines: baseLines,
        adjustments: [],
        globalParams: DEFAULT_PARAMETERS,
        mode: "quote",
        outcome,
        isContractBaseline: true,
      });

      expect(snapshot.order_id).toBe("ord-e2e-u5");
      expect(snapshot.mode).toBe("quote");
      expect(snapshot.price_total).toBe(886_000);
      expect(snapshot.cost_total).toBe(726_250);
      expect(snapshot.is_contract_baseline).toBe(true);

      const params = snapshot.params_snapshot as Record<string, unknown>;
      expect(params.target_margin_pct).toBe(DEFAULT_PARAMETERS.target_margin_pct);

      const input = snapshot.input_snapshot as Record<string, unknown>;
      const inputLines = input.lines as Array<{ unit_price: number }>;
      expect(inputLines).toHaveLength(baseLines.length);
      expect(inputLines[0].unit_price).toBe(14_000);
    });

    it("computes price updates diff when catalog price changes", () => {
      const catalog = new Map<string, PriceItem>([
        [
          "price-ldsp",
          {
            id: "price-ldsp",
            category: "materials",
            name: "ЛДСП белый стандарт",
            unit: "лист",
            price: 16_000, // changed from 14 000 (+2000 per sheet)
            supplier: null,
            waste_applicable: false,
            waste_kind: null,
            billable_qty_rounding: "none",
            counts_for_technolog: true,
            note: null,
            active: true,
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "price-edge",
          {
            id: "price-edge",
            category: "materials",
            name: "Кромка дешёвая",
            unit: "м",
            price: 70, // unchanged
            supplier: null,
            waste_applicable: true,
            waste_kind: "edge",
            billable_qty_rounding: "none",
            counts_for_technolog: false,
            note: null,
            active: true,
            updated_at: new Date().toISOString(),
          },
        ],
      ]);

      const diff = computePriceUpdatesDiff(baseLines, catalog);
      expect(diff.lines).toHaveLength(1);
      expect(diff.lines[0].lineId).toBe("l-ldsp");
      expect(diff.lines[0].oldUnitPrice).toBe(14_000);
      expect(diff.lines[0].newUnitPrice).toBe(16_000);
      expect(diff.lines[0].oldLineTotal).toBe(140_000);
      expect(diff.lines[0].newLineTotal).toBe(160_000);
      expect(diff.lines[0].diff).toBe(20_000);
      expect(diff.totalDiff).toBe(20_000);
    });

    it("executes the full scenario steps 5, 6, and 7 from UI_spec.md", () => {
      // Шаг 4: Рассчитать цену -> 886 000, себестоимость 726 250, маржа ≈ 18,03%
      const step4Outcome = calculateOrderLive({
        order: baseOrder,
        items: baseItems,
        lines: baseLines,
        adjustments: [],
        globalParams: DEFAULT_PARAMETERS,
        mode: "quote",
      });
      expect(step4Outcome.ok).toBe(true);
      if (!step4Outcome.ok) throw new Error(step4Outcome.error);
      expect(step4Outcome.result.priceTotal).toBe(886_000);
      expect(step4Outcome.result.costTotal).toBe(726_250);
      expect(step4Outcome.result.marginPct).toBeCloseTo(0.1803, 3);

      // Шаг 5: Сохранить расчёт -> версия 1 появилась в истории
      const version1Payload = prepareCalculationSnapshot({
        order: baseOrder,
        items: baseItems,
        lines: baseLines,
        adjustments: [],
        globalParams: DEFAULT_PARAMETERS,
        mode: "quote",
        outcome: step4Outcome,
      });

      const calculationHistory: OrderCalculation[] = [
        {
          id: "calc-ver-1",
          order_id: baseOrder.id,
          version: 1,
          mode: version1Payload.mode,
          params_snapshot: version1Payload.params_snapshot,
          input_snapshot: version1Payload.input_snapshot,
          result: version1Payload.result,
          cost_total: version1Payload.cost_total,
          price_total: version1Payload.price_total,
          margin_pct: version1Payload.margin_pct,
          is_contract_baseline: false,
          created_at: "2026-10-06T10:05:00Z",
        },
      ];

      expect(calculationHistory).toHaveLength(1);
      expect(calculationHistory[0].version).toBe(1);
      expect(calculationHistory[0].price_total).toBe(886_000);

      // Шаг 6: Изменить цену ЛДСП в справочнике
      // Сохранённая версия 1 и позиции заказа не изменились, в заказе появилась пометка
      const updatedCatalog = new Map<string, PriceItem>([
        [
          "price-ldsp",
          {
            id: "price-ldsp",
            category: "materials",
            name: "ЛДСП белый стандарт",
            unit: "лист",
            price: 18_000, // В справочнике цена выросла до 18 000
            supplier: null,
            waste_applicable: false,
            waste_kind: null,
            billable_qty_rounding: "none",
            counts_for_technolog: true,
            note: null,
            active: true,
            updated_at: "2026-10-06T10:10:00Z",
          },
        ],
      ]);

      // 6.1: Сохранённая версия 1 НЕ изменилась
      const ver1Input = calculationHistory[0].input_snapshot as {
        lines: Array<{ id: string; unit_price: number }>;
      };
      const savedLdspLine = ver1Input.lines.find((l) => l.id === "l-ldsp");
      expect(savedLdspLine?.unit_price).toBe(14_000);
      expect(calculationHistory[0].price_total).toBe(886_000);

      // 6.2: Позиция в заказе также сохраняет свой снимок (14 000)
      const currentLdspLine = baseLines.find((l) => l.id === "l-ldsp");
      expect(currentLdspLine?.unit_price).toBe(14_000);

      // 6.3: В заказе появляется пометка об изменении цены в справочнике
      const diffStep6 = computePriceUpdatesDiff(baseLines, updatedCatalog);
      expect(diffStep6.lines).toHaveLength(1);
      expect(diffStep6.lines[0].name).toBe("ЛДСП белый стандарт");
      expect(diffStep6.lines[0].oldUnitPrice).toBe(14_000);
      expect(diffStep6.lines[0].newUnitPrice).toBe(18_000);
      expect(diffStep6.totalDiff).toBe(40_000); // 10 листов * 4000 = 40 000 ₸

      // Шаг 7: Режим «Проверить договор» с договором 850 000:
      // маржа ≈ 15,34%, предупреждение, что договор ниже минимальной цены 886 000
      const orderWithContract: Order = {
        ...baseOrder,
        contract_price: 850_000,
      };

      const step7Outcome = calculateOrderLive({
        order: orderWithContract,
        items: baseItems,
        lines: baseLines,
        adjustments: [],
        globalParams: DEFAULT_PARAMETERS,
        mode: "check_contract",
      });

      expect(step7Outcome.ok).toBe(true);
      if (!step7Outcome.ok) throw new Error(step7Outcome.error);
      expect(step7Outcome.result.priceTotal).toBe(850_000);
      expect(step7Outcome.result.costTotal).toBe(719_590);
      expect(step7Outcome.result.margin).toBe(130_410);
      expect(step7Outcome.result.marginPct).toBeCloseTo(0.1534, 3);
      expect(step7Outcome.result.warnings).toEqual([
        "договор ниже минимальной цены 886 000",
      ]);

      // Сохраняем версию 2 (по договору) и помечаем как договорной baseline
      const version2Payload = prepareCalculationSnapshot({
        order: orderWithContract,
        items: baseItems,
        lines: baseLines,
        adjustments: [],
        globalParams: DEFAULT_PARAMETERS,
        mode: "check_contract",
        outcome: step7Outcome,
        isContractBaseline: true,
      });

      const calculationVersion2: OrderCalculation = {
        id: "calc-ver-2",
        order_id: orderWithContract.id,
        version: 2,
        mode: version2Payload.mode,
        params_snapshot: version2Payload.params_snapshot,
        input_snapshot: version2Payload.input_snapshot,
        result: version2Payload.result,
        cost_total: version2Payload.cost_total,
        price_total: version2Payload.price_total,
        margin_pct: version2Payload.margin_pct,
        is_contract_baseline: true,
        created_at: "2026-10-06T10:15:00Z",
      };

      calculationHistory.unshift(calculationVersion2);

      const orderWithCalcs: OrderWithCalculations = {
        ...orderWithContract,
        calculations: calculationHistory,
      };

      const latest = getLatestCalculation(orderWithCalcs);
      expect(latest?.version).toBe(2);
      expect(latest?.mode).toBe("check_contract");
      expect(latest?.price_total).toBe(850_000);
      expect(latest?.margin_pct).toBeCloseTo(0.1534, 3);
    });

    it("chooses contract baseline calculation for Plan/Fact when available, or falls back to latest version (Step A5)", () => {
      // 1. Пустой список расчётов
      expect(getPlanCalculation([])).toBeNull();
      expect(getPlanCalculation(null)).toBeNull();

      // 2. Нет договорной версии: выбирается последняя по номеру
      const calcsWithoutBaseline = [
        { version: 1, cost_total: 600_000, is_contract_baseline: false },
        { version: 2, cost_total: 650_000, is_contract_baseline: false },
      ];
      const planNoBaseline = getPlanCalculation(calcsWithoutBaseline);
      expect(planNoBaseline?.version).toBe(2);
      expect(planNoBaseline?.cost_total).toBe(650_000);

      // 3. Версия 1 отмечена как договорная (is_contract_baseline = true), а версия 2 — новая рабочая
      // План/Факт должен строго использовать договорную версию 1
      const calcsWithBaseline = [
        { version: 1, cost_total: 600_000, is_contract_baseline: true },
        { version: 2, cost_total: 650_000, is_contract_baseline: false },
        { version: 3, cost_total: 700_000, is_contract_baseline: false },
      ];
      const planWithBaseline = getPlanCalculation(calcsWithBaseline);
      expect(planWithBaseline?.version).toBe(1);
      expect(planWithBaseline?.cost_total).toBe(600_000);
      expect(planWithBaseline?.is_contract_baseline).toBe(true);

      // 4. Договорная версия переключена на версию 3
      const calcsUpdatedBaseline = [
        { version: 1, cost_total: 600_000, is_contract_baseline: false },
        { version: 2, cost_total: 650_000, is_contract_baseline: false },
        { version: 3, cost_total: 700_000, is_contract_baseline: true },
      ];
      const planUpdated = getPlanCalculation(calcsUpdatedBaseline);
      expect(planUpdated?.version).toBe(3);
      expect(planUpdated?.cost_total).toBe(700_000);
    });

    it("orders with a saved calculation version preserve their displayed totals when global parameters change (Step A6, Q2)", () => {
      const order: Order = {
        id: "ord-saved-1",
        name: "Кухня МДФ",
        client_label: "Иван",
        status: "quoted",
        contract_price: null,
        settings: {},
        note: null,
        created_at: "2026-10-01T10:00:00Z",
        updated_at: "2026-10-01T10:00:00Z",
      };

      const savedCalc: OrderCalculation = {
        id: "calc-fixed-1",
        order_id: "ord-saved-1",
        version: 1,
        mode: "quote",
        params_snapshot: { target_margin_pct: 0.18 },
        input_snapshot: {},
        result: {
          priceTotal: 861_000,
          costTotal: 706_025,
          margin: 154_975,
          marginPct: 0.18,
          fixedCost: 200_000,
          minPriceForTargetMargin: 861_000,
          categoryTotals: {
            materials: 100_000,
            workshop: 50_000,
            facades: 150_000,
            hardware: 40_000,
            transport: 25_000,
            labor: 80_000,
            assembly: 124_845,
            technolog: 34_440,
            other: 0,
            adjustments: 0,
          },
          assembly: 124_845,
          technolog: 34_440,
          riskReserve: 14_000,
          warnings: [],
          lineCalculations: [],
        },
        cost_total: 706_025,
        price_total: 861_000,
        margin_pct: 0.18,
        is_contract_baseline: false,
        created_at: "2026-10-01T10:30:00Z",
      };

      // Предположим, текущие глобальные параметры изменились: маржа стала 25%
      // В результате liveOutcome пересчитает цену на существенно большую сумму
      const liveOutcomeAfterGlobalParamChange: any = {
        ok: true,
        mode: "quote",
        result: {
          priceTotal: 980_000,
          costTotal: 706_025,
          margin: 273_975,
          marginPct: 0.25,
          fixedCost: 200_000,
          minPriceForTargetMargin: 980_000,
          categoryTotals: { ...savedCalc.result.categoryTotals },
          assembly: 124_845,
          technolog: 34_440,
          riskReserve: 14_000,
          warnings: [],
          lineCalculations: [],
        },
      };

      // 1. По умолчанию для заказа с сохранённой версией:
      // Отображаются данные сохранённой версии (861 000 ₸, 18%), а не результат живого пересчёта (980 000 ₸)
      const displayDefault = resolveOrderDisplayCalculation({
        order,
        calculations: [savedCalc],
        liveOutcome: liveOutcomeAfterGlobalParamChange,
        showLivePreview: false,
      });

      expect(displayDefault).not.toBeNull();
      expect(displayDefault?.source).toBe("saved");
      expect(displayDefault?.version).toBe(1);
      expect(displayDefault?.priceTotal).toBe(861_000);
      expect(displayDefault?.costTotal).toBe(706_025);
      expect(displayDefault?.marginPct).toBe(0.18);

      // 2. Пользователь явно нажимает кнопку «Пересчитать по актуальным параметрам» (showLivePreview = true)
      // Отображается превью живого расчёта
      const displayPreview = resolveOrderDisplayCalculation({
        order,
        calculations: [savedCalc],
        liveOutcome: liveOutcomeAfterGlobalParamChange,
        showLivePreview: true,
      });

      expect(displayPreview).not.toBeNull();
      expect(displayPreview?.source).toBe("live");
      expect(displayPreview?.priceTotal).toBe(980_000);
      expect(displayPreview?.marginPct).toBe(0.25);

      // 3. Для нового заказа без сохранённых версий (calculations: []) отображается живой расчёт
      const displayNewOrder = resolveOrderDisplayCalculation({
        order,
        calculations: [],
        liveOutcome: liveOutcomeAfterGlobalParamChange,
        showLivePreview: false,
      });

      expect(displayNewOrder?.source).toBe("live");
      expect(displayNewOrder?.priceTotal).toBe(980_000);
    });
  });
});


