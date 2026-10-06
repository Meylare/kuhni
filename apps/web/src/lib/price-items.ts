import {
  ALL_CATEGORIES,
  PRICE_UNITS,
  type PriceCategory,
  type PriceItem,
  type PriceUnit,
} from "../types/database";

export function parsePrice(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0 || Math.floor(input) !== input) {
      return null;
    }
    return input;
  }

  const cleaned = input.replace(/\s+/g, "").replace(/₸/g, "").trim();
  if (cleaned === "") {
    return null;
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || Math.floor(num) !== num) {
    return null;
  }

  return num;
}

export interface PriceItemInput {
  name: string;
  category: PriceCategory;
  unit: PriceUnit;
  price: number;
  supplier?: string | null;
  waste_applicable: boolean;
  waste_kind: "edge" | null;
  billable_qty_rounding: "none" | "ceil_to_unit";
  counts_for_technolog: boolean;
  note?: string | null;
  active?: boolean;
}

export function validatePriceItem(item: PriceItemInput): {
  isValid: boolean;
  error?: string;
} {
  const trimmedName = item.name.trim();
  if (!trimmedName) {
    return { isValid: false, error: "Название позиции не может быть пустым." };
  }

  if (!ALL_CATEGORIES.includes(item.category)) {
    return { isValid: false, error: "Указана недопустимая категория." };
  }

  if (!PRICE_UNITS.includes(item.unit)) {
    return { isValid: false, error: "Указана недопустимая единица измерения." };
  }

  const parsed = parsePrice(item.price);
  if (parsed === null) {
    return {
      isValid: false,
      error: "Цена должна быть целым неотрицательным числом в тенге (KZT).",
    };
  }

  if (item.waste_applicable && item.waste_kind !== "edge") {
    return {
      isValid: false,
      error: "При включённом отходе тип отхода должен быть 'edge' (кромка).",
    };
  }

  if (!item.waste_applicable && item.waste_kind !== null) {
    return {
      isValid: false,
      error: "При выключенном отходе тип отхода должен отсутствовать.",
    };
  }

  return { isValid: true };
}

export function filterPriceItems(
  items: readonly PriceItem[],
  query: string,
  selectedCategory: PriceCategory | "all",
  showArchived: boolean,
): PriceItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    if (!showArchived && !item.active) {
      return false;
    }

    if (selectedCategory !== "all" && item.category !== selectedCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const nameMatch = item.name.toLowerCase().includes(normalizedQuery);
    const supplierMatch = item.supplier?.toLowerCase().includes(normalizedQuery);
    const noteMatch = item.note?.toLowerCase().includes(normalizedQuery);

    return Boolean(nameMatch || supplierMatch || noteMatch);
  });
}
