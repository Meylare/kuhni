import type {
  ChecklistTemplateItem,
  OrderChecklist,
  OrderChecklistItem,
} from "../types/database";
import { isDemoModeActive } from "./demo-data";
import { getSupabase } from "./supabase";

export const MEASUREMENT_CHECKLIST_CODE = "measurement";
export const MEASUREMENT_CHECKLIST_TITLE =
  "Единый чек-лист замера мебельного объекта";

export const MEASUREMENT_CHECKLIST_ITEMS: Omit<
  ChecklistTemplateItem,
  "id" | "template_id"
>[] = [
  // БЛОК 1
  {
    block_number: 1,
    block_title: "БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ",
    block_subtitle: "Где всегда ломаются кухни и шкафы",
    item_code: "1.1",
    title: "Ширина и глубина в 3 уровнях",
    description:
      "По полу (0 мм), по уровню столешницы/пояса (900 мм), по верху шкафов (2400–2600 мм). Стены всегда завалены — в расчёт берётся наименьший размер",
    sort_order: 1,
  },
  {
    block_number: 1,
    block_title: "БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ",
    block_subtitle: "Где всегда ломаются кухни и шкафы",
    item_code: "1.2",
    title: "Высота потолка в 3 точках",
    description:
      "Слева, центр, справа (полы и натяжные потолки дают перепад до 20–30 мм)",
    sort_order: 2,
  },
  {
    block_number: 1,
    block_title: "БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ",
    block_subtitle: "Где всегда ломаются кухни и шкафы",
    item_code: "1.3",
    title: "Углы (90°)",
    description:
      "Замерить лазером, угломером или угольником. Если угол развёрнутый (92°) или острый (88°) — зафиксировать ДО раскроя и заложить фальш-планки/запас",
    sort_order: 3,
  },
  {
    block_number: 1,
    block_title: "БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ",
    block_subtitle: "Где всегда ломаются кухни и шкафы",
    item_code: "1.4",
    title: "Завал стен и основания",
    description:
      "Проверить вертикаль уровнем/лазером, отметить материал стен (бетон, кирпич, газоблок, ГКЛ + закладные) и потолка (монолит, ГКЛ, натяжной — опуск и закладной брус)",
    sort_order: 4,
  },

  // БЛОК 2
  {
    block_number: 2,
    block_title: "БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ",
    block_subtitle: "Привязки X, Y, Z от базового угла и чистового пола",
    item_code: "2.1",
    title: "Вода и канализация",
    description:
      "Расстояние от угла до центра труб (мм), высота выводов от чистового пола и диаметр труб",
    sort_order: 5,
  },
  {
    block_number: 2,
    block_title: "БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ",
    block_subtitle: "Привязки X, Y, Z от базового угла и чистового пола",
    item_code: "2.2",
    title: "Вентканал",
    description:
      "Расстояние от угла, высота от пола, диаметр отверстия (хватит ли места для венткороба над верхними шкафами)",
    sort_order: 6,
  },
  {
    block_number: 2,
    block_title: "БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ",
    block_subtitle: "Привязки X, Y, Z от базового угла и чистового пола",
    item_code: "2.3",
    title: "Розетки и кабели",
    description:
      "Привязки розеток для вытяжки, духовки, варочной, ПММ, холодильника, СВЧ, стиральной машины и рабочей зоны",
    sort_order: 7,
  },
  {
    block_number: 2,
    block_title: "БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ",
    block_subtitle: "Привязки X, Y, Z от базового угла и чистового пола",
    item_code: "2.4",
    title: "Главное правило глубины",
    description:
      "Проверить, что розетки НЕ находятся строго за посудомойкой или встроенной духовкой (иначе техника не встанет по глубине)",
    sort_order: 8,
  },
  {
    block_number: 2,
    block_title: "БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ",
    block_subtitle: "Привязки X, Y, Z от базового угла и чистового пола",
    item_code: "2.5",
    title: "Препятствия для открывания",
    description:
      "Замерить батареи/радиаторы, вылет подоконника, наличники дверей (не будет ли ящик биться при выдвижении), газовые трубы, счётчики, короба ГКЛ, люки и тёплый пол",
    sort_order: 9,
  },

  // БЛОК 3
  {
    block_number: 3,
    block_title:
      "БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА",
    block_subtitle: "Расстановка, открывание, декоры и свет",
    item_code: "3.1",
    title: "Расстановка и высота столешницы",
    description:
      "Согласовать границы мебели по рулетке/разметке, проходы и высоту столешницы под рост клиента (860 или 900 мм)",
    sort_order: 10,
  },
  {
    block_number: 3,
    block_title:
      "БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА",
    block_subtitle: "Расстановка, открывание, декоры и свет",
    item_code: "3.2",
    title: "Секции, открывание и техника",
    description:
      "Проверить стороны открывания каждого фасада/ящика (нет ли удара о стены, радиатор, подоконник, ручки), записать точные габариты/модели техники и доборы/фальш-планки",
    sort_order: 11,
  },
  {
    block_number: 3,
    block_title:
      "БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА",
    block_subtitle: "Расстановка, открывание, декоры и свет",
    item_code: "3.3",
    title: "Материалы и фурнитура",
    description:
      "Утвердить корпус (ЛДСП Egger / Lamarty, видимые боковины), фасады (МДФ краска/эмаль, плёнка, акрил, шпон), столешницу/фартук и открывание (Blum / Boyard: ручки, профиль Gola или Tip-On)",
    sort_order: 12,
  },
  {
    block_number: 3,
    block_title:
      "БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА",
    block_subtitle: "Расстановка, открывание, декоры и свет",
    item_code: "3.4",
    title: "Подсветка и питание",
    description:
      "Согласовать зоны света (рабочая зона, витрины, Gola, цоколь), профиль (врезной/накладной), температуру (3000K / 4000K / холодный), датчик включения, вывод 220V и доступное место под блок питания",
    sort_order: 13,
  },

  // БЛОК 4
  {
    block_number: 4,
    block_title: "БЛОК 4. ЛОГИСТИКА ЗАНОСА",
    block_subtitle: "О чём забывают 90% новичков",
    item_code: "4.1",
    title: "Грузовой лифт",
    description:
      "Замерить высоту и ширину проёма, глубину и диагональ кабины (войдёт ли цельная столешница 3 м или пенал 2.7 м)",
    sort_order: 14,
  },
  {
    block_number: 4,
    block_title: "БЛОК 4. ЛОГИСТИКА ЗАНОСА",
    block_subtitle: "О чём забывают 90% новичков",
    item_code: "4.2",
    title: "Лестничный марш и двери",
    description:
      "Если лифта нет или он узкий — замерить ширину маршей, разворотных площадок и дверей (если не входит — заложить деление деталей на части в проекте) + уточнить парковку и часы тишины в ЖК",
    sort_order: 15,
  },

  // БЛОК 5
  {
    block_number: 5,
    block_title: "БЛОК 5. АУДИТ ФАЙЛА ЗАМЕРА И ФИКСАЦИЯ С КЛИЕНТОМ",
    block_subtitle: "Твой юридический бронежилет",
    item_code: "5.1",
    title: "Перепроверка замеров и самого файла замера",
    description:
      "Открыть файл замера на объекте, сверить сходимость всех цепочек размеров с общей длиной стен, убедиться, что нет пустых полей и размеров «на память», прикрепить фото/видео",
    sort_order: 16,
  },
  {
    block_number: 5,
    block_title: "БЛОК 5. АУДИТ ФАЙЛА ЗАМЕРА И ФИКСАЦИЯ С КЛИЕНТОМ",
    block_subtitle: "Твой юридический бронежилет",
    item_code: "5.2",
    title: "Круговое видео 360° (Акт осмотра объекта)",
    description:
      "Снять при входе панораму и все дефекты ремонта (трещины на плитке, сколы на ламинате/паркете, царапины на обоях и дверях), чтобы после сборки не предъявили чужие повреждения",
    sort_order: 17,
  },
  {
    block_number: 5,
    block_title: "БЛОК 5. АУДИТ ФАЙЛА ЗАМЕРА И ФИКСАЦИЯ С КЛИЕНТОМ",
    block_subtitle: "Твой юридический бронежилет",
    item_code: "5.3",
    title: "Лист согласования (Подпись клиента на месте)",
    description:
      "Отрисовать в блокноте эскиз от руки, прописать открывание (ручки / Gola / Tip-On), высоту столешницы (860/900 мм), подсветку, материалы фасадов и корпуса, взять подпись: «Эскиз и комплектация согласованы. Дата, подпись»",
    sort_order: 18,
  },
];

export interface ChecklistBlockGroup {
  blockNumber: number;
  blockTitle: string;
  blockSubtitle: string | null;
  items: OrderChecklistItem[];
  checkedCount: number;
  totalCount: number;
  isBlockComplete: boolean;
}

export interface ChecklistProgress {
  total: number;
  checked: number;
  notesCount: number;
  percent: number;
  isAllChecked: boolean;
}

export function createInitialOrderChecklist(orderId: string): OrderChecklist {
  const now = new Date().toISOString();
  const checklistId = `chk-${orderId}`;
  const items: OrderChecklistItem[] = MEASUREMENT_CHECKLIST_ITEMS.map((tmpl) => ({
    id: `${checklistId}-${tmpl.item_code}`,
    checklist_id: checklistId,
    block_number: tmpl.block_number,
    block_title: tmpl.block_title,
    block_subtitle: tmpl.block_subtitle,
    item_code: tmpl.item_code,
    title: tmpl.title,
    description: tmpl.description,
    sort_order: tmpl.sort_order,
    is_checked: false,
    note: null,
    updated_at: now,
  }));

  return {
    id: checklistId,
    order_id: orderId,
    template_code: MEASUREMENT_CHECKLIST_CODE,
    title: MEASUREMENT_CHECKLIST_TITLE,
    status: "in_progress",
    completed_at: null,
    created_at: now,
    updated_at: now,
    items,
  };
}

export function computeChecklistProgress(
  checklist: OrderChecklist | null,
): ChecklistProgress {
  if (!checklist || checklist.items.length === 0) {
    return {
      total: MEASUREMENT_CHECKLIST_ITEMS.length,
      checked: 0,
      notesCount: 0,
      percent: 0,
      isAllChecked: false,
    };
  }
  const total = checklist.items.length;
  const checked = checklist.items.filter((i) => i.is_checked).length;
  const notesCount = checklist.items.filter(
    (i) => i.note && i.note.trim().length > 0,
  ).length;
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

  return {
    total,
    checked,
    notesCount,
    percent,
    isAllChecked: total > 0 && checked === total,
  };
}

export function groupChecklistItemsByBlock(
  items: OrderChecklistItem[],
): ChecklistBlockGroup[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const map = new Map<number, ChecklistBlockGroup>();

  for (const item of sorted) {
    let group = map.get(item.block_number);
    if (!group) {
      group = {
        blockNumber: item.block_number,
        blockTitle: item.block_title,
        blockSubtitle: item.block_subtitle,
        items: [],
        checkedCount: 0,
        totalCount: 0,
        isBlockComplete: false,
      };
      map.set(item.block_number, group);
    }
    group.items.push(item);
    group.totalCount += 1;
    if (item.is_checked) {
      group.checkedCount += 1;
    }
    group.isBlockComplete =
      group.totalCount > 0 && group.checkedCount === group.totalCount;
  }

  return Array.from(map.values()).sort((a, b) => a.blockNumber - b.blockNumber);
}

export function toggleChecklistItem(
  checklist: OrderChecklist,
  itemCode: string,
  forceChecked?: boolean,
): OrderChecklist {
  const now = new Date().toISOString();
  const nextItems = checklist.items.map((item) => {
    if (item.item_code !== itemCode) return item;
    const nextVal =
      typeof forceChecked === "boolean" ? forceChecked : !item.is_checked;
    return {
      ...item,
      is_checked: nextVal,
      updated_at: now,
    };
  });

  const allChecked =
    nextItems.length > 0 && nextItems.every((item) => item.is_checked);

  return {
    ...checklist,
    status: allChecked ? "completed" : "in_progress",
    completed_at: allChecked ? now : null,
    updated_at: now,
    items: nextItems,
  };
}

export function updateChecklistItemNote(
  checklist: OrderChecklist,
  itemCode: string,
  note: string,
): OrderChecklist {
  const now = new Date().toISOString();
  const trimmed = note.trim();
  const normalizedNote = trimmed.length > 0 ? trimmed : null;

  const nextItems = checklist.items.map((item) => {
    if (item.item_code !== itemCode) return item;
    return {
      ...item,
      note: normalizedNote,
      updated_at: now,
    };
  });

  return {
    ...checklist,
    updated_at: now,
    items: nextItems,
  };
}

export function formatMeasurementChecklistReport(
  orderName: string,
  clientLabel: string | null,
  checklist: OrderChecklist,
): string {
  const progress = computeChecklistProgress(checklist);
  const blocks = groupChecklistItemsByBlock(checklist.items);

  const lines: string[] = [];
  lines.push(`📏 ЧЕК-ЛИСТ ЗАМЕРА: ${orderName}`);
  if (clientLabel) {
    lines.push(`👤 Клиент: ${clientLabel}`);
  }
  lines.push(
    `✅ Проверено: ${progress.checked} / ${progress.total} (${progress.percent}%)`,
  );
  lines.push("");

  for (const block of blocks) {
    lines.push(`${block.blockTitle} (${block.checkedCount}/${block.totalCount})`);
    for (const item of block.items) {
      const mark = item.is_checked ? "☑" : "☐";
      lines.push(`  ${mark} ${item.item_code}. ${item.title}`);
      if (item.note && item.note.trim()) {
        lines.push(`     📝 ${item.note.trim()}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

// ============================================================================
// Локальное хранилище + синхронизация с Supabase
// ============================================================================

function getLocalChecklistKey(orderId: string): string {
  return `kuhni_measurement_checklist_v1_${orderId}`;
}

export function readChecklistFromLocal(orderId: string): OrderChecklist | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getLocalChecklistKey(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderChecklist;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeChecklistToLocal(checklist: OrderChecklist): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      getLocalChecklistKey(checklist.order_id),
      JSON.stringify(checklist),
    );
  } catch {
    // ignore storage quota errors
  }
}

export async function loadOrderChecklist(
  orderId: string,
): Promise<OrderChecklist> {
  const local = readChecklistFromLocal(orderId);
  const fallback = local ?? createInitialOrderChecklist(orderId);

  if (isDemoModeActive()) {
    writeChecklistToLocal(fallback);
    return fallback;
  }

  try {
    const supabase = getSupabase();
    const { data: existingHeader, error: headerErr } = await supabase
      .from("order_checklists")
      .select("*")
      .eq("order_id", orderId)
      .eq("template_code", MEASUREMENT_CHECKLIST_CODE)
      .maybeSingle();

    // Если миграция 018 ещё не применена к облаку или нет сети — используем локальную копию
    if (headerErr) {
      writeChecklistToLocal(fallback);
      return fallback;
    }

    if (existingHeader) {
      const { data: dbItems, error: itemsErr } = await supabase
        .from("order_checklist_items")
        .select("*")
        .eq("checklist_id", existingHeader.id)
        .order("sort_order", { ascending: true });

      if (!itemsErr && dbItems && dbItems.length > 0) {
        const loaded: OrderChecklist = {
          id: existingHeader.id,
          order_id: existingHeader.order_id,
          template_code: existingHeader.template_code,
          title: existingHeader.title,
          status: existingHeader.status,
          completed_at: existingHeader.completed_at,
          created_at: existingHeader.created_at,
          updated_at: existingHeader.updated_at,
          items: dbItems as OrderChecklistItem[],
        };
        writeChecklistToLocal(loaded);
        return loaded;
      }
    }

    // Если в базе ещё нет записи для этого заказа — создаём её из шаблона (или локальной копии)
    const { data: createdHeader, error: insertHeaderErr } = await supabase
      .from("order_checklists")
      .insert({
        order_id: orderId,
        template_code: MEASUREMENT_CHECKLIST_CODE,
        title: fallback.title,
        status: fallback.status,
        completed_at: fallback.completed_at,
      })
      .select("*")
      .single();

    if (insertHeaderErr || !createdHeader) {
      writeChecklistToLocal(fallback);
      return fallback;
    }

    const itemsPayload = fallback.items.map((it) => ({
      checklist_id: createdHeader.id,
      block_number: it.block_number,
      block_title: it.block_title,
      block_subtitle: it.block_subtitle,
      item_code: it.item_code,
      title: it.title,
      description: it.description,
      sort_order: it.sort_order,
      is_checked: it.is_checked,
      note: it.note,
    }));

    const { data: insertedItems, error: insertItemsErr } = await supabase
      .from("order_checklist_items")
      .insert(itemsPayload)
      .select("*");

    if (insertItemsErr || !insertedItems) {
      writeChecklistToLocal(fallback);
      return fallback;
    }

    const synced: OrderChecklist = {
      id: createdHeader.id,
      order_id: createdHeader.order_id,
      template_code: createdHeader.template_code,
      title: createdHeader.title,
      status: createdHeader.status,
      completed_at: createdHeader.completed_at,
      created_at: createdHeader.created_at,
      updated_at: createdHeader.updated_at,
      items: (insertedItems as OrderChecklistItem[]).sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    };
    writeChecklistToLocal(synced);
    return synced;
  } catch {
    writeChecklistToLocal(fallback);
    return fallback;
  }
}

export async function syncChecklistItemToDb(
  checklist: OrderChecklist,
  itemCode: string,
): Promise<void> {
  writeChecklistToLocal(checklist);
  if (isDemoModeActive()) return;

  const targetItem = checklist.items.find((i) => i.item_code === itemCode);
  if (!targetItem) return;

  try {
    const supabase = getSupabase();
    if (!checklist.id.startsWith("chk-")) {
      await supabase
        .from("order_checklist_items")
        .update({
          is_checked: targetItem.is_checked,
          note: targetItem.note,
        })
        .eq("checklist_id", checklist.id)
        .eq("item_code", itemCode);

      await supabase
        .from("order_checklists")
        .update({
          status: checklist.status,
          completed_at: checklist.completed_at,
        })
        .eq("id", checklist.id);
    }
  } catch {
    // Локальная копия уже сохранена
  }
}
