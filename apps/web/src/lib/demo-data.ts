import type {
  ActualExpense,
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

function makePriceItem(
  id: string,
  category: PriceCategory,
  name: string,
  unit: PriceUnit,
  price: number,
): PriceItem {
  return {
    id,
    category,
    name,
    unit,
    price,
    supplier: null,
    waste_applicable: false,
    waste_kind: null,
    billable_qty_rounding: "none",
    counts_for_technolog: false,
    note: null,
    active: true,
    updated_at: "2026-01-10T08:00:00Z",
  };
}

export const DEMO_PRICE_ITEMS: PriceItem[] = [
  // Корпусные материалы
  makePriceItem("demo-mat-1", "materials", "ЛДСП Egger 18мм (Белый платиновый)", "лист", 24500),
  makePriceItem("demo-mat-2", "materials", "ЛДСП Egger 18мм (Дуб Галифакс табак)", "лист", 32000),
  makePriceItem("demo-mat-3", "materials", "ЛДСП Kronospan 16мм (Серый шелк)", "лист", 18500),
  makePriceItem("demo-mat-4", "materials", "ХДФ 3мм белый (задняя стенка)", "лист", 4200),
  makePriceItem("demo-mat-5", "materials", "Кромка ABS 2.0мм с поклейкой", "м", 650),

  // Фасады
  makePriceItem("demo-fac-1", "facades", "МДФ Эмаль матовая с фрезеровкой", "м2", 52000),
  makePriceItem("demo-fac-2", "facades", "МДФ Панель AGT Supramat (Шелк)", "м2", 38000),
  makePriceItem("demo-fac-3", "facades", "Витрина в черном алюм. профиле со стеклом", "м2", 64000),

  // Столешницы
  makePriceItem("demo-top-1", "materials", "Столешница Egger 38мм влагостойкая (3050 мм)", "шт", 58000),
  makePriceItem("demo-top-2", "materials", "Столешница Кварцевый агломерат (Grandex)", "м", 115000),

  // Фурнитура
  makePriceItem("demo-hw-1", "hardware", "Петля Blum Clip Top Blumotion 110° с доводчиком", "шт", 2400),
  makePriceItem("demo-hw-2", "hardware", "Выдвижной ящик Blum Legrabox M (500мм)", "шт", 32000),
  makePriceItem("demo-hw-3", "hardware", "Направляющие скрытого монтажа Boyard (450мм)", "шт", 6800),
  makePriceItem("demo-hw-4", "hardware", "Подъемник складной Blum Aventos HF", "шт", 78000),
  makePriceItem("demo-hw-5", "hardware", "Сушка для посуды в верхний модуль 800мм (Inox)", "шт", 14500),
  makePriceItem("demo-hw-6", "hardware", "Ручка профиль Gola черная (L=3000)", "шт", 12000),
  makePriceItem("demo-hw-7", "hardware", "LED-подсветка врезная с БП и датчиком", "шт", 28000),

  // Цех и распил
  makePriceItem("demo-ws-1", "workshop", "Распил и кромление плиты (комплексный пакет)", "лист", 9500),
  makePriceItem("demo-ws-2", "workshop", "Фрезеровка пазов под подсветку и профиль", "м", 1200),

  // Транспорт и монтаж
  makePriceItem("demo-tr-1", "transport", "Доставка и подъем на этаж (город)", "проект", 25000),
  makePriceItem("demo-lb-1", "labor", "Монтаж кухни (бригада под ключ)", "м", 18000),
];

export const DEMO_TEMPLATES: ProductTemplateWithLines[] = [
  {
    id: "demo-tpl-1",
    name: "Кухня базовая со скрытыми ручками (3.0 м.п.)",
    description: "Стандартный набор: корпус ЛДСП, фасады AGT, петли и ящики Blum, столешница, монтаж",
    lines: [
      { template_id: "demo-tpl-1", price_item_id: "demo-mat-1", qty: 4, note: "Корпус" },
      { template_id: "demo-tpl-1", price_item_id: "demo-mat-2", qty: 2.5, note: "Фасады" },
      { template_id: "demo-tpl-1", price_item_id: "demo-hw-1", qty: 16, note: "Петли Blum" },
      { template_id: "demo-tpl-1", price_item_id: "demo-hw-2", qty: 4, note: "Ящики Blum Legrabox" },
      { template_id: "demo-tpl-1", price_item_id: "demo-top-1", qty: 1, note: "Столешница влагостойкая" },
      { template_id: "demo-tpl-1", price_item_id: "demo-ws-1", qty: 6.5, note: "Распил и кромление" },
      { template_id: "demo-tpl-1", price_item_id: "demo-tr-1", qty: 1, note: "Доставка" },
      { template_id: "demo-tpl-1", price_item_id: "demo-lb-1", qty: 3, note: "Монтаж кухни" },
    ],
  },
  {
    id: "demo-tpl-2",
    name: "Шкаф распашной до потолка (2.4 м.п.)",
    description: "Корпус ЛДСП Egger, фасады МДФ эмаль, петли Blum, ящики Boyard",
    lines: [
      { template_id: "demo-tpl-2", price_item_id: "demo-mat-1", qty: 3.5, note: "Корпус" },
      { template_id: "demo-tpl-2", price_item_id: "demo-mat-3", qty: 2, note: "Фасады МДФ" },
      { template_id: "demo-tpl-2", price_item_id: "demo-hw-1", qty: 12, note: "Петли Blum" },
      { template_id: "demo-tpl-2", price_item_id: "demo-hw-3", qty: 3, note: "Ящики Boyard" },
      { template_id: "demo-tpl-2", price_item_id: "demo-ws-1", qty: 5.5, note: "Распил" },
      { template_id: "demo-tpl-2", price_item_id: "demo-tr-1", qty: 1, note: "Доставка" },
      { template_id: "demo-tpl-2", price_item_id: "demo-lb-1", qty: 2.4, note: "Монтаж" },
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

const STORAGE_KEY = "kuhni_demo_state_v1";

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
      note: "Кухня в современном стиле. Фасады мат эмаль, столешница кварц, остров 1.8м.",
      settings: {
        target_margin_pct: 0.3,
        assembly_mode: "per_meter",
      },
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: o2Id,
      name: "Шкаф-купе в прихожую • ЖК BI City Tokyo",
      client_label: "Даулет Смагулов",
      status: "approved",
      contract_price: 920000,
      note: "Шкаф-купе 3 двери, зеркало графит, профиль Modus черная шагрень.",
      settings: {
        target_margin_pct: 0.28,
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
      note: "Фасады AGT Supramat, фурнитура Blum. В работе в цеху.",
      settings: {
        target_margin_pct: 0.28,
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
      note: "Большая гардеробная со стеклянными фасадами и подсветкой. Заказ сдан.",
      settings: {
        target_margin_pct: 0.32,
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
        description: "Двусторонний, глубокие ящики Blum с органайзерами",
      },
    ],
    [o2Id]: [
      {
        id: item2Id,
        order_id: o2Id,
        title: "Шкаф-купе 3-дверный",
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
        price_item_id: "demo-mat-1",
        name: "ЛДСП Egger 18мм (Белый платиновый)",
        unit: "лист",
        qty: 5,
        unit_price: 24500,
        waste_pct: 10,
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
        price_item_id: "demo-mat-2",
        name: "ЛДСП Egger 18мм (Дуб Галифакс табак)",
        unit: "лист",
        qty: 3,
        unit_price: 32000,
        waste_pct: 10,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "Открытые ниши и декоративные боковины",
      },
      {
        id: "l1-3",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "facades",
        price_item_id: "demo-fac-1",
        name: "МДФ Эмаль матовая с фрезеровкой",
        unit: "м2",
        qty: 7.2,
        unit_price: 52000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Цвет RAL 9003 матовый",
      },
      {
        id: "l1-4",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "hardware",
        price_item_id: "demo-hw-1",
        name: "Петля Blum Clip Top Blumotion 110° с доводчиком",
        unit: "шт",
        qty: 16,
        unit_price: 2400,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Петли на распашные фасады",
      },
      {
        id: "l1-5",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "hardware",
        price_item_id: "demo-hw-2",
        name: "Выдвижной ящик Blum Legrabox M (500мм)",
        unit: "шт",
        qty: 4,
        unit_price: 32000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Нижние выдвижные базы",
      },
      {
        id: "l1-6",
        order_id: o1Id,
        order_item_id: item1Id,
        category: "hardware",
        price_item_id: "demo-hw-4",
        name: "Подъемник складной Blum Aventos HF",
        unit: "шт",
        qty: 2,
        unit_price: 78000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Верхние шкафы над мойкой",
      },
      {
        id: "l1-7",
        order_id: o1Id,
        order_item_id: item1IslandId,
        category: "materials",
        price_item_id: "demo-mat-2",
        name: "ЛДСП Egger 18мм (Дуб Галифакс табак)",
        unit: "лист",
        qty: 2.5,
        unit_price: 32000,
        waste_pct: 10,
        billable_qty_rounding: "none",
        counts_for_technolog: true,
        is_manual: false,
        comment: "Корпус и боковые опоры острова",
      },
      {
        id: "l1-8",
        order_id: o1Id,
        order_item_id: item1IslandId,
        category: "hardware",
        price_item_id: "demo-hw-2",
        name: "Выдвижной ящик Blum Legrabox M (500мм)",
        unit: "шт",
        qty: 4,
        unit_price: 32000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Ящики острова",
      },
      {
        id: "l1-9",
        order_id: o1Id,
        order_item_id: null,
        category: "workshop",
        price_item_id: "demo-ws-1",
        name: "Распил и кромление плиты (комплексный пакет)",
        unit: "лист",
        qty: 10.5,
        unit_price: 9500,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Раскрой на форматно-раскроечном станке",
      },
      {
        id: "l1-10",
        order_id: o1Id,
        order_item_id: null,
        category: "transport",
        price_item_id: "demo-tr-1",
        name: "Доставка и подъем на этаж (город)",
        unit: "проект",
        qty: 1,
        unit_price: 25000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: "l1-11",
        order_id: o1Id,
        order_item_id: null,
        category: "labor",
        price_item_id: "demo-lb-1",
        name: "Монтаж кухни (бригада под ключ)",
        unit: "м",
        qty: 5.4,
        unit_price: 18000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Монтаж гарнитура 3.6м + остров 1.8м",
      },
    ],
    [o2Id]: [
      {
        id: "l2-1",
        order_id: o2Id,
        order_item_id: item2Id,
        category: "materials",
        price_item_id: "demo-mat-1",
        name: "ЛДСП Egger 18мм (Белый платиновый)",
        unit: "лист",
        qty: 4,
        unit_price: 24500,
        waste_pct: 10,
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
        price_item_id: "demo-fac-3",
        name: "Витрина в черном алюм. профиле со стеклом",
        unit: "м2",
        qty: 6.2,
        unit_price: 64000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "3 раздвижные двери",
      },
      {
        id: "l2-3",
        order_id: o2Id,
        order_item_id: item2Id,
        category: "hardware",
        price_item_id: "demo-hw-3",
        name: "Направляющие скрытого монтажа Boyard (450мм)",
        unit: "шт",
        qty: 4,
        unit_price: 6800,
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
        price_item_id: "demo-ws-1",
        name: "Распил и кромление плиты (комплексный пакет)",
        unit: "лист",
        qty: 4,
        unit_price: 9500,
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
        category: "transport",
        price_item_id: "demo-tr-1",
        name: "Доставка и подъем на этаж (город)",
        unit: "проект",
        qty: 1,
        unit_price: 25000,
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
    [o1Id]: [
      {
        id: "adj-1",
        order_id: o1Id,
        kind: "price",
        category: "adjustments",
        label: "Скидка комплекс",
        amount: -50000,
        comment: "Скидка при заказе кухни и острова",
      },
    ],
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
        name: "ТОО LamArty (ЛДСП и кромка)",
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
        name: "Цех фасадов AGT",
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
        name: "Фирма Blum-Казахстан",
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

export function isDemoModeActive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("kuhni_demo_mode_enabled") === "true";
}

export function setDemoModeActive(active: boolean): void {
  if (typeof window === "undefined") return;
  if (active) {
    localStorage.setItem("kuhni_demo_mode_enabled", "true");
  } else {
    localStorage.removeItem("kuhni_demo_mode_enabled");
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
      target_margin_pct: 0.28,
      assembly_mode: "per_meter",
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
        price_item_id: "demo-mat-1",
        name: "ЛДСП Egger 18мм (Белый платиновый)",
        unit: "лист",
        qty: 4,
        unit_price: 24500,
        waste_pct: 10,
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
        price_item_id: "demo-fac-2",
        name: "МДФ Панель AGT Supramat (Шелк)",
        unit: "м2",
        qty: 4.5,
        unit_price: 38000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Фасады",
      },
      {
        id: `demo-line-${Date.now()}-3`,
        order_id: orderId,
        order_item_id: itemId,
        category: "materials",
        price_item_id: "demo-top-1",
        name: "Столешница Egger 38мм влагостойкая (3050 мм)",
        unit: "шт",
        qty: 1,
        unit_price: 58000,
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
        price_item_id: "demo-hw-1",
        name: "Петля Blum Clip Top Blumotion 110° с доводчиком",
        unit: "шт",
        qty: 12,
        unit_price: 2400,
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
        price_item_id: "demo-hw-3",
        name: "Направляющие скрытого монтажа Boyard (450мм)",
        unit: "шт",
        qty: 3,
        unit_price: 6800,
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
        price_item_id: "demo-ws-1",
        name: "Распил и кромление плиты (комплексный пакет)",
        unit: "лист",
        qty: 5,
        unit_price: 9500,
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
        category: "transport",
        price_item_id: "demo-tr-1",
        name: "Доставка и подъем на этаж (город)",
        unit: "проект",
        qty: 1,
        unit_price: 25000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "",
      },
      {
        id: `demo-line-${Date.now()}-8`,
        order_id: orderId,
        order_item_id: null,
        category: "labor",
        price_item_id: "demo-lb-1",
        name: "Монтаж кухни (бригада под ключ)",
        unit: "м",
        qty: 3.2,
        unit_price: 18000,
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
        price_item_id: "demo-mat-1",
        name: "ЛДСП Egger 18мм (Белый платиновый)",
        unit: "лист",
        qty: 4,
        unit_price: 24500,
        waste_pct: 10,
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
        price_item_id: "demo-fac-3",
        name: "Витрина в черном алюм. профиле со стеклом",
        unit: "м2",
        qty: 4.2,
        unit_price: 64000,
        waste_pct: 0,
        billable_qty_rounding: "none",
        counts_for_technolog: false,
        is_manual: false,
        comment: "Двери купе",
      },
      {
        id: `demo-line-${Date.now()}-3`,
        order_id: orderId,
        order_item_id: itemId,
        category: "hardware",
        price_item_id: "demo-hw-3",
        name: "Направляющие скрытого монтажа Boyard (450мм)",
        unit: "шт",
        qty: 4,
        unit_price: 6800,
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
