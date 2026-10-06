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

export type OrderStatus =
  | "draft"
  | "quoted"
  | "approved"
  | "in_production"
  | "done"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "quoted",
  "approved",
  "in_production",
  "done",
  "cancelled",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Черновик",
  quoted: "Оценён",
  approved: "Согласован",
  in_production: "В производстве",
  done: "Выполнен",
  cancelled: "Отменён",
};

export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  draft: {
    bg: "bg-stone-100",
    text: "text-stone-700",
    border: "border-stone-300",
    dot: "bg-stone-400",
  },
  quoted: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  in_production: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  done: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  cancelled: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

export type OrderItemKind = "kitchen" | "wardrobe" | "other";

export const ORDER_ITEM_KINDS: OrderItemKind[] = [
  "kitchen",
  "wardrobe",
  "other",
];

export const ORDER_ITEM_KIND_LABELS: Record<OrderItemKind, string> = {
  kitchen: "Кухня",
  wardrobe: "Шкаф",
  other: "Другое",
};

export interface Order {
  id: string;
  name: string;
  client_label: string | null;
  status: OrderStatus;
  contract_price: number | null;
  settings: Record<string, unknown>;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderCalculationSummary {
  id: string;
  version: number;
  mode: "quote" | "check_contract";
  price_total: number;
  cost_total: number;
  margin_pct: number | null;
  created_at: string;
}

export interface OrderWithCalculations extends Order {
  calculations?: OrderCalculationSummary[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  kind: OrderItemKind;
  title: string;
  description: string | null;
  linear_meters: number | null;
  dims: Record<string, unknown>;
}

export interface OrderLine {
  id: string;
  order_id: string;
  order_item_id: string | null;
  price_item_id: string | null;
  category: PriceCategory;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  waste_pct: number;
  billable_qty_rounding: BillableQtyRounding;
  counts_for_technolog: boolean;
  is_manual: boolean;
  comment: string | null;
}

export interface OrderAdjustment {
  id: string;
  order_id: string;
  kind: "cost" | "price";
  category: "adjustments";
  label: string;
  amount: number;
  comment: string | null;
}

export interface OrderCalculation {
  id: string;
  order_id: string;
  version: number;
  mode: "quote" | "check_contract";
  params_snapshot: Record<string, unknown>;
  input_snapshot: Record<string, unknown>;
  result: Record<string, unknown>;
  cost_total: number;
  price_total: number;
  margin_pct: number | null;
  is_contract_baseline: boolean;
  created_at: string;
}
