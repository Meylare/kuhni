import type {
  ActualExpense,
  BillableQtyRounding,
  Order,
  OrderAdjustment,
  OrderCalculation,
  OrderItem,
  OrderLine,
  Payment,
  PriceCategory,
  PriceItem,
  PriceUnit,
  ProductTemplateWithLines,
} from "../types/database";
import type { ParametersMap } from "./parameters";
import { DEFAULT_PARAMETERS } from "./parameters";

function makeRealSeedItem(
  id: string,
  category: PriceCategory,
  name: string,
  unit: PriceUnit,
  price: number,
  options?: {
    supplier?: string | null;
    waste_applicable?: boolean;
    waste_kind?: "edge" | null;
    billable_qty_rounding?: BillableQtyRounding;
    counts_for_technolog?: boolean;
    note?: string | null;
  },
): PriceItem {
  return {
    id,
    category,
    name,
    unit,
    price,
    supplier: options?.supplier ?? null,
    waste_applicable: options?.waste_applicable ?? false,
    waste_kind: options?.waste_kind ?? null,
    billable_qty_rounding: options?.billable_qty_rounding ?? "none",
    counts_for_technolog: options?.counts_for_technolog ?? false,
    note: options?.note ?? null,
    active: true,
    updated_at: "2026-10-12T18:00:00Z",
  };
}

/**
 * Полный реальный прайс-лист из supabase/seed/001_initial_price_list_and_parameters.sql
 * и миграции 017_seed_additional_price_items.sql.
 */
export const DEMO_PRICE_ITEMS: PriceItem[] = [
  // Материалы (materials)
  makeRealSeedItem("seed-mat-1", "materials", "ЛДСП белый стандарт", "лист", 14000, {
    counts_for_technolog: true,
    note: "корпуса",
  }),
  makeRealSeedItem("seed-mat-2", "materials", "ЛДСП цветной базовый", "лист", 20000, {
    counts_for_technolog: true,
    note: "корпуса",
  }),
  makeRealSeedItem("seed-mat-3", "materials", "ЛДСП EGGER для фасадов (недорогие декоры)", "лист", 30000, {
    supplier: "EGGER",
    counts_for_technolog: true,
  }),
  makeRealSeedItem("seed-mat-4", "materials", "ЛДСП EGGER для фасадов (дорогие декоры)", "лист", 45000, {
    supplier: "EGGER",
    counts_for_technolog: true,
  }),
  makeRealSeedItem("seed-mat-5", "materials", "Кромка дешёвая", "м", 70, {
    waste_applicable: true,
    waste_kind: "edge",
  }),
  makeRealSeedItem("seed-mat-6", "materials", "Кромка EGGER", "м", 160, {
    supplier: "EGGER",
    waste_applicable: true,
    waste_kind: "edge",
  }),
  makeRealSeedItem("seed-mat-7", "materials", "ДВП (ХДФ)", "лист", 7000),
  makeRealSeedItem("seed-mat-8", "materials", "Столешница EGGER/F&S 4м", "шт", 70000, {
    supplier: "EGGER",
    note: "Столешница 4 метра",
  }),
  makeRealSeedItem("seed-mat-9", "materials", "Столешница EGGER/F&S 3м", "шт", 46000, {
    supplier: "EGGER",
    note: "Столешница 3 метра",
  }),
  makeRealSeedItem("seed-mat-10", "materials", "Столешница стандарт 3м", "шт", 30000, {
    note: "Столешница стандартная 3 метра",
  }),

  // Фасады (facades)
  makeRealSeedItem("seed-fac-1", "facades", "Витрина алюминиевый профиль", "м2", 55000, {
    note: "Алюминиевый фасад-витрина",
  }),
  makeRealSeedItem("seed-fac-2", "facades", "МДФ плёнка, Фрезеровка 18 мм", "м2", 26000, {
    billable_qty_rounding: "ceil_to_unit",
  }),
  makeRealSeedItem("seed-fac-3", "facades", "МДФ плёнка, сложная фрезеровка", "м2", 30000, {
    billable_qty_rounding: "ceil_to_unit",
  }),
  makeRealSeedItem("seed-fac-4", "facades", "МДФ в краске, Модерн", "м2", 30000, {
    billable_qty_rounding: "ceil_to_unit",
  }),
  makeRealSeedItem("seed-fac-5", "facades", "МДФ в краске, Фрезеровка", "м2", 38000, {
    billable_qty_rounding: "ceil_to_unit",
  }),
  makeRealSeedItem("seed-fac-6", "facades", "Присадка МДФ", "м2", 2000, {
    billable_qty_rounding: "ceil_to_unit",
  }),

  // Цех (workshop)
  makeRealSeedItem("seed-ws-1", "workshop", "Распил EGGER", "лист", 2200, {
    supplier: "EGGER",
  }),
  makeRealSeedItem("seed-ws-2", "workshop", "Распил обычный ЛДСП", "лист", 2000),
  makeRealSeedItem("seed-ws-3", "workshop", "Присадка ЛДСП", "лист", 6000),
  makeRealSeedItem("seed-ws-4", "workshop", "Закатка кромки стандарт", "м", 200),
  makeRealSeedItem("seed-ws-5", "workshop", "Закатка кромки 40 мм", "м", 300),
  makeRealSeedItem("seed-ws-6", "workshop", "Распил ДВП", "лист", 1000),
  makeRealSeedItem("seed-ws-7", "workshop", "Распил столешницы", "лист", 2000),
  makeRealSeedItem("seed-ws-8", "workshop", "Закатка столешницы", "лист", 1000),
  makeRealSeedItem("seed-ws-9", "workshop", "Закатка криволинейных деталей (узкая)", "деталь", 1000),
  makeRealSeedItem("seed-ws-10", "workshop", "Закатка криволинейных деталей (широкая)", "деталь", 1300),
  makeRealSeedItem("seed-ws-11", "workshop", "Склейка деталей", "деталь", 1000),
  makeRealSeedItem("seed-ws-12", "workshop", "Доставка до цеха", "проект", 3000),
  makeRealSeedItem("seed-ws-13", "workshop", "Упаковка", "шт", 2000, {
    note: "В v1 вводится вручную; подсказка по умолчанию 12.",
  }),

  // Фурнитура (hardware)
  makeRealSeedItem("seed-hw-1", "hardware", "Петли EH7", "шт", 350),
  makeRealSeedItem("seed-hw-2", "hardware", "Петли GTV", "шт", 750, {
    supplier: "GTV",
  }),
  makeRealSeedItem("seed-hw-3", "hardware", "Тандем полного выдвижения 500", "шт", 6500, {
    supplier: "Blum",
  }),
  makeRealSeedItem("seed-hw-4", "hardware", "Ручки", "шт", 1500, {
    note: "Ручки мебельные",
  }),
  makeRealSeedItem("seed-hw-5", "hardware", "Профиль Gola 3м", "шт", 25000, {
    note: "Профиль Gola длина 3м",
  }),
  makeRealSeedItem("seed-hw-6", "hardware", "Сушка стандарт 600 мм", "шт", 5000, {
    note: "Сушка стандарт для модуля 600 мм",
  }),
  makeRealSeedItem("seed-hw-7", "hardware", "Сушка стандарт 900 мм", "шт", 10000, {
    note: "Сушка стандарт для модуля 900 мм",
  }),
  makeRealSeedItem("seed-hw-8", "hardware", "Сушка нижнего монтажа 600 мм", "шт", 45000, {
    note: "Сушка выдвижная / нижнего монтажа 600 мм",
  }),

  // Работа и подключение (labor / transport)
  makeRealSeedItem("seed-lb-1", "labor", "Подключение мойки", "шт", 15000),
  makeRealSeedItem("seed-lb-2", "labor", "Подключение стиральной машины", "шт", 5000),
  makeRealSeedItem("seed-lb-3", "labor", "Электрика: подсветка", "точка", 15000, {
    note: "от, по договорённости",
  }),
  makeRealSeedItem("seed-lb-4", "labor", "Подключение варочной поверхности", "шт", 10000),
  makeRealSeedItem("seed-tr-1", "transport", "Доставка на объект", "проект", 15000),
];

export const DEMO_TEMPLATES: ProductTemplateWithLines[] = [
  {
    id: "demo-tpl-1",
    name: "Кухня стандарт с профилем Gola (3.0 м.п.)",
    description: "Корпус ЛДСП белый стандарт, фасады МДФ в краске Модерн, столешница EGGER 3м, Gola, тандемы",
    lines: [
      { template_id: "demo-tpl-1", price_item_id: "seed-mat-1", qty: 5, note: "Корпус ЛДСП" },
      { template_id: "demo-tpl-1", price_item_id: "seed-mat-7", qty: 2, note: "ДВП (ХДФ)" },
      { template_id: "demo-tpl-1", price_item_id: "seed-mat-6", qty: 90, note: "Кромка EGGER" },
      { template_id: "demo-tpl-1", price_item_id: "seed-fac-4", qty: 5.5, note: "Фасады МДФ в краске Модерн" },
      { template_id: "demo-tpl-1", price_item_id: "seed-mat-9", qty: 1, note: "Столешница EGGER/F&S 3м" },
      { template_id: "demo-tpl-1", price_item_id: "seed-hw-2", qty: 16, note: "Петли GTV" },
      { template_id: "demo-tpl-1", price_item_id: "seed-hw-3", qty: 4, note: "Тандем полного выдвижения 500" },
      { template_id: "demo-tpl-1", price_item_id: "seed-hw-5", qty: 2, note: "Профиль Gola 3м" },
      { template_id: "demo-tpl-1", price_item_id: "seed-hw-6", qty: 1, note: "Сушка стандарт 600 мм" },
      { template_id: "demo-tpl-1", price_item_id: "seed-ws-2", qty: 5, note: "Распил обычный ЛДСП" },
      { template_id: "demo-tpl-1", price_item_id: "seed-ws-3", qty: 5, note: "Присадка ЛДСП" },
      { template_id: "demo-tpl-1", price_item_id: "seed-ws-4", qty: 90, note: "Закатка кромки стандарт" },
      { template_id: "demo-tpl-1", price_item_id: "seed-ws-13", qty: 12, note: "Упаковка" },
    ],
  },
  {
    id: "demo-tpl-2",
    name: "Шкаф распашной до потолка (2.4 м.п.)",
    description: "Корпус ЛДСП белый стандарт, фасады МДФ плёнка фрезеровка 18 мм, петли GTV, тандемы",
    lines: [
      { template_id: "demo-tpl-2", price_item_id: "seed-mat-1", qty: 4, note: "Корпус" },
      { template_id: "demo-tpl-2", price_item_id: "seed-mat-7", qty: 2, note: "ДВП" },
      { template_id: "demo-tpl-2", price_item_id: "seed-fac-2", qty: 6, note: "Фасады МДФ плёнка" },
      { template_id: "demo-tpl-2", price_item_id: "seed-hw-2", qty: 16, note: "Петли GTV" },
      { template_id: "demo-tpl-2", price_item_id: "seed-hw-3", qty: 3, note: "Тандем полного выдвижения 500" },
      { template_id: "demo-tpl-2", price_item_id: "seed-hw-4", qty: 4, note: "Ручки" },
      { template_id: "demo-tpl-2", price_item_id: "seed-ws-2", qty: 4, note: "Распил обычный ЛДСП" },
      { template_id: "demo-tpl-2", price_item_id: "seed-ws-3", qty: 4, note: "Присадка ЛДСП" },
    ],
  },
];

export interface DemoState {
  orders: Order[];
  items: Record<string, OrderItem[]>;
  lines: Record<string, OrderLine[]>;
  adjustments: Record<string, OrderAdjustment[]>;
  calculations: Record<string, OrderCalculation[]>;
  expenses: Record<string, ActualExpense[]>;
  payments: Record<string, Payment[]>;
  priceItems: PriceItem[];
  parameters: ParametersMap;
  templates: ProductTemplateWithLines[];
}

const STORAGE_KEY = "kuhni_demo_state_v2";

export function getInitialDemoState(): DemoState {
  const o1Id = "demo-ord-1";
  const o2Id = "demo-ord-2";
  const o3Id = "demo-ord-3";
  const o4Id = "demo-ord-4";

  const item1Id = "demo-item-1-kitchen";
  const item1IslandId = "demo-item-1-island";
  const item2Id = "demo-item-2-wardrobe";
  const item3Id = "demo-item-3-kitchen";
  const item4Id = "demo-item-4-wardrobe";

  const orders: Order[] = [
    {
      id: o1Id,
      name: "Кухня угловая с островом • ЖК Highvill Gold",
      client_label: "Айгерим Касымова",
      status: "draft",
      contract_price: null,
      note: "Кухня в современном стиле. Фасады МДФ в краске, столешница EGGER 4м, остров 1.8м.",
      settings: {
        target_margin_pct: 0.18,
        assembly_mode: "percent",
      },
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: o2Id,
      name: "Шкаф в прихожую • ЖК BI City Tokyo",
      client_label: "Даулет Смагулов",
      status: "approved",
      contract_price: 920000,
      note: "Шкаф с алюминиевыми витринами, тандемы полного выдвижения.",
      settings: {
        target_margin_pct: 0.18,
      },
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: o3Id,
      name: "Кухня прямая 3.6м • ЖК Комфорт Town",
      client_label: "Марат Ахметов",
      status: "in_production",
      contract_price: 1480000,
      note: "Фасады МДФ в краске, профиль Gola. В работе в цеху.",
      settings: {
        target_margin_pct: 0.18,
      },
      created_at: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: o4Id,
      name: "Гардеробная комната • пр. Достык",
      client_label: "Елена Воронова",
      status: "done",
      contract_price: 1850000,
      note: "Большая гардеробная с витринами и подсветкой. Заказ сдан.",
      settings: {
        target_margin_pct: 0.18,
      },
      created_at: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const items: Record<string, OrderItem[]> = {
    [o1Id]: [
      {
        id: item1Id,
        order_id: o1Id,
        title: "Основной гарнитур (угловой)",
        kind: "kitchen",
        linear_meters: 3.6,
        dims: { width: 3600, depth: 600, height: 2450 },
        description: "Пеналы под встроенную технику, верхние шкафы под потолок",
      },
      {
        id: item1IslandId,
        order_id: o1Id,
        title: "Кухонный остров с ящиками",
        kind: "kitchen",
        linear_meters: 1.8,
        dims: { width: 1800, depth: 900, height: 900 },
        description: "Двусторонний, выдвижные ящики",
      },
    ],
    [o2Id]: [
      {
        id: item2Id,
        order_id: o2Id,
        title: "Шкаф 3-секционный",
        kind: "wardrobe",
        linear_meters: 2.4,
        dims: { width: 2400, depth: 650, height: 2650 },
        description: "3 секции: штанги, полки, 4 выдвижных ящика",
      },
    ],
    [o3Id]: [
      {
        id: item3Id,
        order_id: o3Id,
        title: "Кухонный гарнитур прямой",
        kind: "kitchen",
        linear_meters: 3.6,
        dims: { width: 3600, depth: 600, height: 2500 },
        description: "Встроенный холодильник, посудомойка",
      },
    ],
    [o4Id]: [
      {
        id: item4Id,
        order_id: o4Id,
        title: "Гардеробная П-образная",
        kind: "wardrobe",
        linear_meters: 5.2,
        dims: { width: 2800, depth: 3100, height: 2600 },
        description: "Модульная система со светодиодной подсветкой",
      },
    ],
  };

  const lines: Record<string, OrderLine[]> = {
    [o1Id]: [
      {
        id: "l1-1",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "materials",
        price_item_id: "seed-mat-1",
        name: "ЛДСП белый стандарт",
        unit: "лист",
        qty: 6,
        unit_price: 14000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "На корпуса нижних и верхних шкафов",
      },
      {
        id: "l1-2",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "materials",
        price_item_id: "seed-mat-3",
        name: "ЛДСП EGGER для фасадов (недорогие декоры)",
        unit: "лист",
        qty: 3,
        unit_price: 30000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "Открытые ниши и боковины Egger",
      },
      {
        id: "l1-3",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "facades",
        price_item_id: "seed-fac-5",
        name: "МДФ в краске, Фрезеровка",
        unit: "м2",
        qty: 7,
        unit_price: 38000,
        waste_pct: 0,
        billable_qty_rounding: "ceil_to_unit",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Фасады эмаль с фрезеровкой",
      },
      {
        id: "l1-4",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "materials",
        price_item_id: "seed-mat-8",
        name: "Столешница EGGER/F&S 4м",
        unit: "шт",
        qty: 1,
        unit_price: 70000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Столешница 4 метра",
      },
      {
        id: "l1-5",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "hardware",
        price_item_id: "seed-hw-3",
        name: "Тандем полного выдвижения 500 (Blum)",
        unit: "шт",
        qty: 8,
        unit_price: 6500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Выдвижные ящики",
      },
      {
        id: "l1-6",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "hardware",
        price_item_id: "seed-hw-5",
        name: "Профиль Gola 3м",
        unit: "шт",
        qty: 2,
        unit_price: 25000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Профиль Gola",
      },
      {
        id: "l1-7",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "hardware",
        price_item_id: "seed-hw-8",
        name: "Сушка нижнего монтажа 600 мм",
        unit: "шт",
        qty: 1,
        unit_price: 45000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: "l1-8",
        order_id: o1Id,
        order_item_id: null,
        category: "workshop",
        price_item_id: "seed-ws-1",
        name: "Распил EGGER",
        unit: "лист",
        qty: 9,
        unit_price: 2200,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: "l1-9",
        order_id: o1Id,
        order_item_id: null,
        category: "workshop",
        price_item_id: "seed-ws-3",
        name: "Присадка ЛДСП",
        unit: "лист",
        qty: 9,
        unit_price: 6000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: "l1-10",
        order_id: o1Id,
        order_item_id: null,
        category: "labor",
        price_item_id: "seed-lb-1",
        name: "Подключение мойки",
        unit: "шт",
        qty: 1,
        unit_price: 15000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
    ],
    [o2Id]: [
      {
        id: "l2-1",
        order_id: o2Id,
        order_item_id: item2Id,
        category: "materials",
        price_item_id: "seed-mat-1",
        name: "ЛДСП белый стандарт",
        unit: "лист",
        qty: 5,
        unit_price: 14000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "Внутреннее наполнение и перегородки",
      },
      {
        id: "l2-2",
        order_id: o2Id,
        order_item_id: item2Id,
        category: "facades",
        price_item_id: "seed-fac-1",
        name: "Витрина алюминиевый профиль",
        unit: "м2",
        qty: 6,
        unit_price: 55000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Алюминиевые фасады-витрины",
      },
      {
        id: "l2-3",
        order_id: o2Id,
        order_item_id: item2Id,
        category: "hardware",
        price_item_id: "seed-hw-3",
        name: "Тандем полного выдвижения 500",
        unit: "шт",
        qty: 4,
        unit_price: 6500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Ящики",
      },
      {
        id: "l2-4",
        order_id: o2Id,
        order_item_id: null,
        category: "workshop",
        price_item_id: "seed-ws-2",
        name: "Распил обычный ЛДСП",
        unit: "лист",
        qty: 5,
        unit_price: 2000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: "l2-5",
        order_id: o2Id,
        order_item_id: null,
        category: "workshop",
        price_item_id: "seed-ws-3",
        name: "Присадка ЛДСП",
        unit: "лист",
        qty: 5,
        unit_price: 6000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
    ],
    [o3Id]: [],
    [o4Id]: [],
  };

  const adjustments: Record<string, OrderAdjustment[]> = {
    [o1Id]: [],
    [o2Id]: [],
    [o3Id]: [],
    [o4Id]: [],
  };

  const calculations: Record<string, OrderCalculation[]> = {
    [o1Id]: [],
    [o2Id]: [
      {
        id: "calc-2-v1",
        order_id: o2Id,
        version: 1,
        mode: "check_contract",
        params_snapshot: {},
        input_snapshot: {},
        result: {},
        price_total: 920000,
        cost_total: 624500,
        margin_pct: 0.321,
        is_contract_baseline: true,
        created_at: "2026-01-09T12:00:00Z",
      },
    ],
    [o3Id]: [
      {
        id: "calc-3-v1",
        order_id: o3Id,
        version: 1,
        mode: "check_contract",
        params_snapshot: {},
        input_snapshot: {},
        result: {},
        price_total: 1480000,
        cost_total: 1020000,
        margin_pct: 0.31,
        is_contract_baseline: true,
        created_at: "2026-01-07T14:00:00Z",
      },
    ],
    [o4Id]: [],
  };

  const expenses: Record<string, ActualExpense[]> = {
    [o3Id]: [
      {
        id: "exp-3-1",
        order_id: o3Id,
        category: "materials",
        name: "ЛДСП и кромка EGGER",
        amount: 320000,
        expense_date: "2026-01-08",
        is_rework: false,
        rework_reason: null,
        note: "Накладная #1428",
      },
      {
        id: "exp-3-2",
        order_id: o3Id,
        category: "facades",
        name: "Фасады МДФ в краске",
        amount: 280000,
        expense_date: "2026-01-09",
        is_rework: false,
        rework_reason: null,
        note: "Чек #884",
      },
      {
        id: "exp-3-3",
        order_id: o3Id,
        category: "hardware",
        name: "Фурнитура и профиль Gola",
        amount: 195000,
        expense_date: "2026-01-10",
        is_rework: false,
        rework_reason: null,
        note: "Счет #1109",
      },
    ],
    [o1Id]: [],
    [o2Id]: [],
    [o4Id]: [
      {
        id: "exp-4-1",
        order_id: o4Id,
        category: "materials",
        name: "Материалы гардеробной",
        amount: 450000,
        expense_date: "2026-01-03",
        is_rework: false,
        rework_reason: null,
        note: "Акт 55",
      },
    ],
  };

  const payments: Record<string, Payment[]> = {
    [o3Id]: [
      {
        id: "pay-3-1",
        order_id: o3Id,
        amount: 1000000,
        paid_at: "2026-01-07",
        note: "Аванс 70%",
      },
    ],
    [o2Id]: [
      {
        id: "pay-2-1",
        order_id: o2Id,
        amount: 600000,
        paid_at: "2026-01-09",
        note: "Предоплата по договору",
      },
    ],
    [o1Id]: [],
    [o4Id]: [
      {
        id: "pay-4-1",
        order_id: o4Id,
        amount: 1850000,
        paid_at: "2026-01-10",
        note: "Полный расчет 100%",
      },
    ],
  };

  return {
    orders,
    items,
    lines,
    adjustments,
    calculations,
    expenses,
    payments,
    priceItems: DEMO_PRICE_ITEMS,
    parameters: DEFAULT_PARAMETERS,
    templates: DEMO_TEMPLATES,
  };
}

export function loadDemoState(): DemoState {
  if (typeof window === "undefined") {
    return getInitialDemoState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialDemoState();
      saveDemoState(initial);
      return initial;
    }
    const state = JSON.parse(raw) as DemoState;
    if (!state.templates || state.templates.length === 0) {
      state.templates = DEMO_TEMPLATES;
    }
    if (!state.priceItems || state.priceItems.length < DEMO_PRICE_ITEMS.length) {
      state.priceItems = DEMO_PRICE_ITEMS;
    }
    return state;
  } catch (err) {
    console.warn("Failed to load demo state from localStorage, resetting", err);
    const initial = getInitialDemoState();
    saveDemoState(initial);
    return initial;
  }
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save demo state", err);
  }
}

export function resetDemoState(): DemoState {
  const initial = getInitialDemoState();
  saveDemoState(initial);
  return initial;
}

const DEMO_SESSION_KEY = "kuhni_demo_session_active";

export function isDemoModeActive(): boolean {
  if (typeof window === "undefined") return false;
  // Очищаем старый залипший ключ в localStorage, чтобы приложение по умолчанию работало с реальной БД
  if (localStorage.getItem("kuhni_demo_mode_enabled")) {
    localStorage.removeItem("kuhni_demo_mode_enabled");
  }
  return sessionStorage.getItem(DEMO_SESSION_KEY) === "true";
}

export function setDemoModeActive(active: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("kuhni_demo_mode_enabled");
  if (active) {
    sessionStorage.setItem(DEMO_SESSION_KEY, "true");
  } else {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  }
}

export function demoGetOrders(): (Order & { calculations: OrderCalculation[] })[] {
  const state = loadDemoState();
  return state.orders.map((ord) => ({
    ...ord,
    calculations: state.calculations[ord.id] || [],
  }));
}

export function demoGetOrder(id: string): Order | null {
  const state = loadDemoState();
  return state.orders.find((o) => o.id === id) || null;
}

export function demoSaveOrder(order: Order): void {
  const state = loadDemoState();
  const idx = state.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    state.orders[idx] = { ...order, updated_at: new Date().toISOString() };
  } else {
    state.orders.unshift(order);
  }
  saveDemoState(state);
}

export function demoCreateOrder(input: {
  name: string;
  client_name?: string | null;
  contract_price?: number | null;
  note?: string | null;
  preset?: "kitchen" | "wardrobe" | "empty";
}): Order {
  const state = loadDemoState();
  const newId = `demo-ord-${Date.now()}`;
  const newOrder: Order = {
    id: newId,
    name: input.name.trim(),
    client_label: input.client_name?.trim() || null,
    status: "draft",
    contract_price: input.contract_price ?? null,
    note: input.note?.trim() || null,
    settings: {
      target_margin_pct: 0.18,
      assembly_mode: "percent",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  state.orders.unshift(newOrder);
  state.items[newId] = [];
  state.lines[newId] = [];
  state.adjustments[newId] = [];
  state.calculations[newId] = [];
  state.expenses[newId] = [];
  state.payments[newId] = [];

  saveDemoState(state);

  if (input.preset === "kitchen" || input.preset === "wardrobe") {
    demoApplyPresetToOrder(newId, input.preset);
  }

  return newOrder;
}

export function demoApplyPresetToOrder(
  orderId: string,
  preset: "kitchen" | "wardrobe",
  targetItemId?: string,
): void {
  const state = loadDemoState();
  let itemId = targetItemId;

  if (!itemId) {
    itemId = `demo-item-${Date.now()}`;
    const newItem: OrderItem = {
      id: itemId,
      order_id: orderId,
      title: preset === "kitchen" ? "Кухонный гарнитур (типовой)" : "Шкаф-купе (типовой)",
      kind: preset === "kitchen" ? "kitchen" : "wardrobe",
      linear_meters: preset === "kitchen" ? 3.2 : 2.4,
      dims: preset === "kitchen" ? { width: 3200, depth: 600, height: 2400 } : { width: 2400, depth: 650, height: 2600 },
      description: "Автоматически сформированный комплект",
    };
    if (!state.items[orderId]) state.items[orderId] = [];
    state.items[orderId].push(newItem);
  }

  if (!state.lines[orderId]) state.lines[orderId] = [];

  if (preset === "kitchen") {
    const kitchenLines: OrderLine[] = [
      {
        id: `demo-line-${Date.now()}-1`,
        order_id: orderId,
        order_item_id: itemId,
        category: "materials",
        price_item_id: "seed-mat-1",
        name: "ЛДСП белый стандарт",
        unit: "лист",
        qty: 4,
        unit_price: 14000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "Корпуса",
      },
      {
        id: `demo-line-${Date.now()}-2`,
        order_id: orderId,
        order_item_id: itemId,
        category: "facades",
        price_item_id: "seed-fac-4",
        name: "МДФ в краске, Модерн",
        unit: "м2",
        qty: 5,
        unit_price: 30000,
        waste_pct: 0,
        billable_qty_rounding: "ceil_to_unit",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Фасады",
      },
      {
        id: `demo-line-${Date.now()}-3`,
        order_id: orderId,
        order_item_id: itemId,
        category: "materials",
        price_item_id: "seed-mat-9",
        name: "Столешница EGGER/F&S 3м",
        unit: "шт",
        qty: 1,
        unit_price: 46000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Основная рабочая зона",
      },
      {
        id: `demo-line-${Date.now()}-4`,
        order_id: orderId,
        order_item_id: itemId,
        category: "hardware",
        price_item_id: "seed-hw-2",
        name: "Петли GTV",
        unit: "шт",
        qty: 12,
        unit_price: 750,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: `demo-line-${Date.now()}-5`,
        order_id: orderId,
        order_item_id: itemId,
        category: "hardware",
        price_item_id: "seed-hw-3",
        name: "Тандем полного выдвижения 500",
        unit: "шт",
        qty: 3,
        unit_price: 6500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Выдвижные ящики",
      },
      {
        id: `demo-line-${Date.now()}-6`,
        order_id: orderId,
        order_item_id: null,
        category: "workshop",
        price_item_id: "seed-ws-2",
        name: "Распил обычный ЛДСП",
        unit: "лист",
        qty: 4,
        unit_price: 2000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: `demo-line-${Date.now()}-7`,
        order_id: orderId,
        order_item_id: null,
        category: "workshop",
        price_item_id: "seed-ws-3",
        name: "Присадка ЛДСП",
        unit: "лист",
        qty: 4,
        unit_price: 6000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
    ];
    state.lines[orderId].push(...kitchenLines);
  } else {
    const wardrobeLines: OrderLine[] = [
      {
        id: `demo-line-${Date.now()}-1`,
        order_id: orderId,
        order_item_id: itemId,
        category: "materials",
        price_item_id: "seed-mat-1",
        name: "ЛДСП белый стандарт",
        unit: "лист",
        qty: 4,
        unit_price: 14000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "Корпус и полки",
      },
      {
        id: `demo-line-${Date.now()}-2`,
        order_id: orderId,
        order_item_id: itemId,
        category: "facades",
        price_item_id: "seed-fac-1",
        name: "Витрина алюминиевый профиль",
        unit: "м2",
        qty: 4.5,
        unit_price: 55000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Двери витрины",
      },
      {
        id: `demo-line-${Date.now()}-3`,
        order_id: orderId,
        order_item_id: itemId,
        category: "hardware",
        price_item_id: "seed-hw-3",
        name: "Тандем полного выдвижения 500",
        unit: "шт",
        qty: 4,
        unit_price: 6500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Внутренние ящики",
      },
    ];
    state.lines[orderId].push(...wardrobeLines);
  }

  saveDemoState(state);
}

export function demoSaveLine(line: OrderLine): void {
  const state = loadDemoState();
  if (!state.lines[line.order_id]) state.lines[line.order_id] = [];
  const idx = state.lines[line.order_id].findIndex((l) => l.id === line.id);
  if (idx >= 0) {
    state.lines[line.order_id][idx] = line;
  } else {
    state.lines[line.order_id].push(line);
  }
  saveDemoState(state);
}

export function demoStepLineQty(orderId: string, lineId: string, delta: number): void {
  const state = loadDemoState();
  const orderLines = state.lines[orderId];
  if (!orderLines) return;
  const idx = orderLines.findIndex((l) => l.id === lineId);
  if (idx < 0) return;

  const current = orderLines[idx];
  const newQty = Math.max(0, Math.round((current.qty + delta) * 1000) / 1000);

  if (newQty <= 0) {
    state.lines[orderId] = orderLines.filter((l) => l.id !== lineId);
  } else {
    state.lines[orderId][idx] = { ...current, qty: newQty };
  }
  saveDemoState(state);
}

export function demoDeleteLine(orderId: string, lineId: string): void {
  const state = loadDemoState();
  if (!state.lines[orderId]) return;
  state.lines[orderId] = state.lines[orderId].filter((l) => l.id !== lineId);
  saveDemoState(state);
}

export function demoDuplicateLine(orderId: string, line: OrderLine): OrderLine {
  const state = loadDemoState();
  if (!state.lines[orderId]) state.lines[orderId] = [];
  const newLine: OrderLine = {
    ...line,
    id: `demo-line-${Date.now()}`,
    name: `${line.name} (копия)`,
  };
  state.lines[orderId].push(newLine);
  saveDemoState(state);
  return newLine;
}

export function demoSaveItem(item: OrderItem): void {
  const state = loadDemoState();
  if (!state.items[item.order_id]) state.items[item.order_id] = [];
  const idx = state.items[item.order_id].findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    state.items[item.order_id][idx] = item;
  } else {
    state.items[item.order_id].push(item);
  }
  saveDemoState(state);
}

export function demoDeleteItem(orderId: string, itemId: string): void {
  const state = loadDemoState();
  if (state.items[orderId]) {
    state.items[orderId] = state.items[orderId].filter((i) => i.id !== itemId);
  }
  if (state.lines[orderId]) {
    state.lines[orderId] = state.lines[orderId].map((l) =>
      l.order_item_id === itemId ? { ...l, order_item_id: null } : l,
    );
  }
  saveDemoState(state);
}

export function demoSaveAdjustment(adj: OrderAdjustment): void {
  const state = loadDemoState();
  if (!state.adjustments[adj.order_id]) state.adjustments[adj.order_id] = [];
  const idx = state.adjustments[adj.order_id].findIndex((a) => a.id === adj.id);
  if (idx >= 0) {
    state.adjustments[adj.order_id][idx] = adj;
  } else {
    state.adjustments[adj.order_id].push(adj);
  }
  saveDemoState(state);
}

export function demoDeleteAdjustment(orderId: string, adjId: string): void {
  const state = loadDemoState();
  if (!state.adjustments[orderId]) return;
  state.adjustments[orderId] = state.adjustments[orderId].filter((a) => a.id !== adjId);
  saveDemoState(state);
}

export function demoSaveCalculation(calc: OrderCalculation): void {
  const state = loadDemoState();
  if (!state.calculations[calc.order_id]) state.calculations[calc.order_id] = [];
  state.calculations[calc.order_id].unshift(calc);
  saveDemoState(state);
}

export function demoSetBaseline(orderId: string, calcId: string): void {
  const state = loadDemoState();
  if (!state.calculations[orderId]) return;
  state.calculations[orderId] = state.calculations[orderId].map((c) => ({
    ...c,
    is_contract_baseline: c.id === calcId,
  }));
  saveDemoState(state);
}

export function demoSaveExpense(exp: ActualExpense): void {
  const state = loadDemoState();
  if (!state.expenses[exp.order_id]) state.expenses[exp.order_id] = [];
  const idx = state.expenses[exp.order_id].findIndex((e) => e.id === exp.id);
  if (idx >= 0) {
    state.expenses[exp.order_id][idx] = exp;
  } else {
    state.expenses[exp.order_id].unshift(exp);
  }
  saveDemoState(state);
}

export function demoDeleteExpense(orderId: string, expId: string): void {
  const state = loadDemoState();
  if (!state.expenses[orderId]) return;
  state.expenses[orderId] = state.expenses[orderId].filter((e) => e.id !== expId);
  saveDemoState(state);
}

export function demoSavePayment(pay: Payment): void {
  const state = loadDemoState();
  if (!state.payments[pay.order_id]) state.payments[pay.order_id] = [];
  const idx = state.payments[pay.order_id].findIndex((p) => p.id === pay.id);
  if (idx >= 0) {
    state.payments[pay.order_id][idx] = pay;
  } else {
    state.payments[pay.order_id].unshift(pay);
  }
  saveDemoState(state);
}

export function demoDeletePayment(orderId: string, payId: string): void {
  const state = loadDemoState();
  if (!state.payments[orderId]) return;
  state.payments[orderId] = state.payments[orderId].filter((p) => p.id !== payId);
  saveDemoState(state);
}

export function demoSavePriceItem(item: PriceItem): void {
  const state = loadDemoState();
  const idx = state.priceItems.findIndex((p) => p.id === item.id);
  if (idx >= 0) {
    state.priceItems[idx] = item;
  } else {
    state.priceItems.unshift(item);
  }
  saveDemoState(state);
}

export function demoGetPriceItems(): PriceItem[] {
  const state = loadDemoState();
  return state.priceItems || [];
}

export function demoSaveParameters(params: ParametersMap): void {
  const state = loadDemoState();
  state.parameters = { ...params };
  saveDemoState(state);
}

export function demoGetTemplates(): ProductTemplateWithLines[] {
  const state = loadDemoState();
  return state.templates || [];
}

export function demoSaveTemplate(tpl: ProductTemplateWithLines): void {
  const state = loadDemoState();
  if (!state.templates) state.templates = [];
  const idx = state.templates.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) {
    state.templates[idx] = tpl;
  } else {
    state.templates.unshift(tpl);
  }
  saveDemoState(state);
}

export function demoDeleteTemplate(id: string): void {
  const state = loadDemoState();
  if (!state.templates) return;
  state.templates = state.templates.filter((t) => t.id !== id);
  saveDemoState(state);
}
