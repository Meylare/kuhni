export type PriceCategory =
  | "materials"
  | "workshop"
  | "facades"
  | "hardware"
  | "transport"
  | "labor"
  | "other";

export const CATEGORY_LABELS: Record<PriceCategory, string> = {
  materials: "Материалы",
  facades: "Фасады",
  workshop: "Цех",
  hardware: "Фурнитура",
  transport: "Транспорт",
  labor: "Работа",
  other: "Остальное",
};

export const ALL_CATEGORIES: PriceCategory[] = [
  "materials",
  "facades",
  "workshop",
  "hardware",
  "transport",
  "labor",
  "other",
];

export type PriceUnit =
  | "лист"
  | "м2"
  | "м"
  | "шт"
  | "деталь"
  | "точка"
  | "проект";

export const PRICE_UNITS: PriceUnit[] = [
  "лист",
  "м2",
  "м",
  "шт",
  "деталь",
  "точка",
  "проект",
];

export type BillableQtyRounding = "none" | "ceil_to_unit";

export interface PriceItem {
  id: string;
  category: PriceCategory;
  name: string;
  unit: PriceUnit;
  price: number;
  supplier: string | null;
  waste_applicable: boolean;
  waste_kind: "edge" | null;
  billable_qty_rounding: BillableQtyRounding;
  counts_for_technolog: boolean;
  note: string | null;
  active: boolean;
  updated_at: string;
}

export interface PriceHistoryItem {
  id: number;
  price_item_id: string;
  old_price: number | null;
  new_price: number;
  changed_at: string;
  changed_by: string | null;
}

export interface ParameterItem {
  key: string;
  value_num: number | null;
  value_text: string | null;
  description: string | null;
  updated_at: string;
}
