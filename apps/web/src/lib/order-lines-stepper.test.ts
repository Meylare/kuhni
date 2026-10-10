import { describe, expect, it } from "vitest";
import type { OrderLine, PriceItem } from "../types/database";
import {
  getRecentPriceItems,
  getStepIncrement,
  mergeOrAddPriceItem,
  roundQuantity,
  updateLineQuantity,
} from "./order-lines-stepper";
import type { ParametersMap } from "./parameters";

describe("order-lines-stepper", () => {
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
    waste_edge_pct: 0.15,
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
    name: "Кромка ПВХ 2мм",
    category: "materials",
    unit: "м",
    price: 350,
    supplier: null,
    waste_applicable: true,
    waste_kind: "edge",
    billable_qty_rounding: "none",
    counts_for_technolog: false,
    note: null,
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  };

  const dummyLine1: OrderLine = {
    id: "line-1",
    order_id: "ord-1",
    order_item_id: "item-kitchen",
    price_item_id: "pi-1",
    name: "Петля Blum Clip-top",
    category: "hardware",
    unit: "шт",
    qty: 4,
    unit_price: 1200,
    waste_pct: 0,
    billable_qty_rounding: "none",
    counts_for_technolog: false,
    is_manual: false,
    comment: "петли с доводчиком",
  };

  it("roundQuantity rounds to 3 decimal places and protects against floating point error", () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
    expect(roundQuantity(1.23456)).toBe(1.235);
    expect(roundQuantity(NaN)).toBe(0);
    expect(roundQuantity(-5)).toBe(-5);
  });

  it("getStepIncrement returns 1 by default", () => {
    expect(getStepIncrement("шт")).toBe(1);
    expect(getStepIncrement("лист")).toBe(1);
    expect(getStepIncrement("м")).toBe(1);
  });

  it("mergeOrAddPriceItem merges quantity when same price item in same order item exists", () => {
    const lines = [dummyLine1];
    const res = mergeOrAddPriceItem(lines, {
      priceItem: dummyPriceItem1,
      orderItemId: "item-kitchen",
      orderId: "ord-1",
      deltaQty: 2,
      globalParams: dummyParams,
    });

    expect(res.action).toBe("updated");
    expect(res.lines.length).toBe(1);
    expect(res.affectedLine.qty).toBe(6);
    // Existing comment & properties must be preserved
    expect(res.affectedLine.comment).toBe("петли с доводчиком");
  });

  it("mergeOrAddPriceItem adds new line when item exists in a different order_item", () => {
    const lines = [dummyLine1];
    const res = mergeOrAddPriceItem(lines, {
      priceItem: dummyPriceItem1,
      orderItemId: "item-wardrobe", // different item
      orderId: "ord-1",
      deltaQty: 2,
      globalParams: dummyParams,
    });

    expect(res.action).toBe("added");
    expect(res.lines.length).toBe(2);
    expect(res.affectedLine.order_item_id).toBe("item-wardrobe");
    expect(res.affectedLine.qty).toBe(2);
  });

  it("mergeOrAddPriceItem adds new line with default waste for edge material", () => {
    const lines = [dummyLine1];
    const res = mergeOrAddPriceItem(lines, {
      priceItem: dummyPriceItem2,
      orderItemId: "item-kitchen",
      orderId: "ord-1",
      deltaQty: 3,
      globalParams: dummyParams,
    });

    expect(res.action).toBe("added");
    expect(res.lines.length).toBe(2);
    expect(res.affectedLine.name).toBe("Кромка ПВХ 2мм");
    expect(res.affectedLine.waste_pct).toBe(0.15); // waste_edge_pct
    expect(res.affectedLine.billable_qty_rounding).toBe("none");
  });

  it("updateLineQuantity updates quantity when newQty > 0", () => {
    const lines = [dummyLine1];
    const res = updateLineQuantity(lines, "line-1", 10);
    expect(res.action).toBe("updated");
    expect(res.lines[0].qty).toBe(10);
  });

  it("updateLineQuantity deletes line when newQty <= 0", () => {
    const lines = [dummyLine1];
    const res = updateLineQuantity(lines, "line-1", 0);
    expect(res.action).toBe("deleted");
    expect(res.lines.length).toBe(0);
    expect(res.affectedLine?.id).toBe("line-1");
  });

  it("getRecentPriceItems returns popular price items sorted by usage count", () => {
    const history: OrderLine[] = [
      { ...dummyLine1, price_item_id: "pi-1" },
      { ...dummyLine1, price_item_id: "pi-2" },
      { ...dummyLine1, price_item_id: "pi-2" },
      { ...dummyLine1, price_item_id: "pi-2" },
    ];
    const map = new Map<string, PriceItem>([
      ["pi-1", dummyPriceItem1],
      ["pi-2", dummyPriceItem2],
    ]);

    const recent = getRecentPriceItems(history, map, 2);
    expect(recent.length).toBe(2);
    // pi-2 used 3 times, pi-1 used 1 time
    expect(recent[0].id).toBe("pi-2");
    expect(recent[1].id).toBe("pi-1");
  });
});
