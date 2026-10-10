import { describe, expect, it } from "vitest";
import type {
  OrderLine,
  PriceItem,
  ProductTemplateLine,
} from "../types/database";
import type { ParametersMap } from "./parameters";
import {
  applyTemplateToOrderLines,
  groupOrderLinesForTemplate,
} from "./templates";

describe("templates lib", () => {
  const dummyParams: ParametersMap = {
    target_margin_pct: 0.18,
    technolog_pct: 0.04,
    technolog_mode: "percent",
    technolog_per_sheet: 4000,
    assembly_pct: 0.145,
    assembly_mode: "percent",
    assembly_per_meter_kitchen: 35000,
    assembly_per_meter_wardrobe: 25000,
    risk_reserve_pct: 0.03,
    waste_edge_pct: 0.10,
    price_rounding: 1000,
  };

  const dummyPriceItem1: PriceItem = {
    id: "pi-1",
    name: "Петля Blum Clip-top",
    category: "hardware",
    unit: "шт",
    price: 1200,
    supplier: null,
    waste_applicable: false,
    waste_kind: null,
    billable_qty_rounding: "none",
    counts_for_technolog: false,
    note: null,
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  };

  const dummyPriceItem2: PriceItem = {
    id: "pi-2",
    name: "ЛДСП Egger 18мм",
    category: "materials",
    unit: "лист",
    price: 18500,
    supplier: null,
    waste_applicable: false,
    waste_kind: null,
    billable_qty_rounding: "ceil_to_unit",
    counts_for_technolog: true,
    note: null,
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  };

  const dummyInactivePriceItem: PriceItem = {
    id: "pi-3",
    name: "Старая ручка скоба",
    category: "hardware",
    unit: "шт",
    price: 500,
    supplier: null,
    waste_applicable: false,
    waste_kind: null,
    billable_qty_rounding: "none",
    counts_for_technolog: false,
    note: null,
    active: false, // inactive!
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("groupOrderLinesForTemplate groups lines by price_item_id and skips manual lines", () => {
    const lines: OrderLine[] = [
      {
        id: "l-1",
        order_id: "ord-1",
        order_item_id: "it-1",
        price_item_id: "pi-1",
        name: "Петля Blum Clip-top",
        category: "hardware",
        unit: "шт",
        qty: 10,
        unit_price: 1200,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-2",
        order_id: "ord-1",
        order_item_id: "it-2",
        price_item_id: "pi-1", // same price item in another product item
        name: "Петля Blum Clip-top",
        category: "hardware",
        unit: "шт",
        qty: 6,
        unit_price: 1200,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
      {
        id: "l-3",
        order_id: "ord-1",
        order_item_id: "it-1",
        price_item_id: null, // manual line!
        name: "Доставка до подъезда",
        category: "transport",
        unit: "проект",
        qty: 1,
        unit_price: 15000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: true,
        comment: null,
      },
    ];

    const res = groupOrderLinesForTemplate(lines);

    expect(res.templateLines.length).toBe(1);
    expect(res.templateLines[0].price_item_id).toBe("pi-1");
    expect(res.templateLines[0].qty).toBe(16); // 10 + 6
    expect(res.manualLinesCount).toBe(1);
    expect(res.skippedManualNames).toEqual(["Доставка до подъезда"]);
  });

  it("applyTemplateToOrderLines applies active items, skips inactive items, and merges quantities", () => {
    const priceMap = new Map<string, PriceItem>([
      ["pi-1", dummyPriceItem1],
      ["pi-2", dummyPriceItem2],
      ["pi-3", dummyInactivePriceItem],
    ]);

    const templateLines: ProductTemplateLine[] = [
      { template_id: "t-1", price_item_id: "pi-1", qty: 4, note: null },
      { template_id: "t-1", price_item_id: "pi-2", qty: 2, note: null },
      { template_id: "t-1", price_item_id: "pi-3", qty: 8, note: null }, // inactive!
    ];

    // Существующая строка: pi-1 уже есть в целевом изделии с количеством 2
    const currentLines: OrderLine[] = [
      {
        id: "cur-1",
        order_id: "ord-1",
        order_item_id: "it-target",
        price_item_id: "pi-1",
        name: "Петля Blum Clip-top",
        category: "hardware",
        unit: "шт",
        qty: 2,
        unit_price: 1200,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: null,
      },
    ];

    const res = applyTemplateToOrderLines({
      templateLines,
      currentLines,
      priceItemsById: priceMap,
      orderId: "ord-1",
      orderItemId: "it-target",
      globalParams: dummyParams,
    });

    expect(res.appliedCount).toBe(2);
    expect(res.skippedInactiveCount).toBe(1);
    expect(res.skippedNames).toEqual(["Старая ручка скоба"]);

    // Итого 2 строки: pi-1 объединена (2 + 4 = 6), pi-2 добавлена (2)
    expect(res.nextLines.length).toBe(2);
    const line1 = res.nextLines.find((l) => l.price_item_id === "pi-1");
    expect(line1?.qty).toBe(6);
    const line2 = res.nextLines.find((l) => l.price_item_id === "pi-2");
    expect(line2?.qty).toBe(2);
  });
});
