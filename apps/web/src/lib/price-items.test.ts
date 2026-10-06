import { describe, expect, it } from "vitest";

import type { PriceItem } from "../types/database";
import {
  filterPriceItems,
  parsePrice,
  validatePriceItem,
} from "./price-items";

describe("parsePrice", () => {
  it("разбирает целые положительные числа и строки с пробелами", () => {
    expect(parsePrice(14000)).toBe(14000);
    expect(parsePrice("14000")).toBe(14000);
    expect(parsePrice(" 14 000 ")).toBe(14000);
    expect(parsePrice("886 000 ₸")).toBe(886000);
    expect(parsePrice(0)).toBe(0);
    expect(parsePrice("0")).toBe(0);
  });

  it("отклоняет нечисловые, отрицательные и дробные значения", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice(-100)).toBeNull();
    expect(parsePrice("-500")).toBeNull();
    expect(parsePrice(14.5)).toBeNull();
    expect(parsePrice("14.5")).toBeNull();
  });
});

describe("validatePriceItem", () => {
  it("валидирует корректную позицию", () => {
    const res = validatePriceItem({
      name: "ЛДСП белый стандарт",
      category: "materials",
      unit: "лист",
      price: 14000,
      waste_applicable: false,
      waste_kind: null,
      billable_qty_rounding: "none",
      counts_for_technolog: true,
    });
    expect(res.isValid).toBe(true);
  });

  it("проверяет соответствие отхода и waste_kind", () => {
    const invalidWithWaste = validatePriceItem({
      name: "Кромка",
      category: "materials",
      unit: "м",
      price: 160,
      waste_applicable: true,
      waste_kind: null, // Ошибка: должен быть edge
      billable_qty_rounding: "none",
      counts_for_technolog: false,
    });
    expect(invalidWithWaste.isValid).toBe(false);

    const validWithWaste = validatePriceItem({
      name: "Кромка",
      category: "materials",
      unit: "м",
      price: 160,
      waste_applicable: true,
      waste_kind: "edge",
      billable_qty_rounding: "none",
      counts_for_technolog: false,
    });
    expect(validWithWaste.isValid).toBe(true);
  });

  it("отклоняет пустое название и отрицательную цену", () => {
    expect(
      validatePriceItem({
        name: "   ",
        category: "materials",
        unit: "лист",
        price: 1000,
        waste_applicable: false,
        waste_kind: null,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
      }).isValid,
    ).toBe(false);

    expect(
      validatePriceItem({
        name: "Тест",
        category: "materials",
        unit: "лист",
        price: -5,
        waste_applicable: false,
        waste_kind: null,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
      }).isValid,
    ).toBe(false);
  });
});

describe("filterPriceItems", () => {
  const items: PriceItem[] = [
    {
      id: "1",
      name: "ЛДСП белый",
      category: "materials",
      unit: "лист",
      price: 14000,
      supplier: "Крона",
      waste_applicable: false,
      waste_kind: null,
      billable_qty_rounding: "none",
      counts_for_technolog: true,
      note: "корпуса",
      active: true,
      updated_at: "2026-10-03",
    },
    {
      id: "2",
      name: "Распил обычный",
      category: "workshop",
      unit: "лист",
      price: 2000,
      supplier: null,
      waste_applicable: false,
      waste_kind: null,
      billable_qty_rounding: "none",
      counts_for_technolog: false,
      note: null,
      active: true,
      updated_at: "2026-10-03",
    },
    {
      id: "3",
      name: "Старая петля",
      category: "hardware",
      unit: "шт",
      price: 300,
      supplier: null,
      waste_applicable: false,
      waste_kind: null,
      billable_qty_rounding: "none",
      counts_for_technolog: false,
      note: null,
      active: false,
      updated_at: "2026-10-03",
    },
  ];

  it("фильтрует по категории и поисковой строке", () => {
    expect(filterPriceItems(items, "лдсп", "all", false)).toHaveLength(1);
    expect(filterPriceItems(items, "", "workshop", false)).toHaveLength(1);
    expect(filterPriceItems(items, "", "all", false)).toHaveLength(2); // Без архивных
    expect(filterPriceItems(items, "", "all", true)).toHaveLength(3); // С архивными
  });
});
