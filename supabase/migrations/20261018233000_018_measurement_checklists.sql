-- Migration 018: Measurement checklists (templates and per-order instances)
-- Adds checklist_templates, checklist_template_items, order_checklists, order_checklist_items
-- Seeds the default "Единый чек-лист замера мебельного объекта" (5 blocks, 18 items)

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  block_number int not null check (block_number > 0),
  block_title text not null,
  block_subtitle text,
  item_code text not null,
  title text not null,
  description text not null,
  sort_order int not null,
  unique (template_id, item_code)
);

create table if not exists public.order_checklists (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  template_code text not null default 'measurement',
  title text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, template_code)
);

create table if not exists public.order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.order_checklists(id) on delete cascade,
  block_number int not null check (block_number > 0),
  block_title text not null,
  block_subtitle text,
  item_code text not null,
  title text not null,
  description text not null,
  sort_order int not null,
  is_checked boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  unique (checklist_id, item_code)
);

-- Indexes on foreign keys
create index if not exists idx_checklist_template_items_template_id
  on public.checklist_template_items(template_id);
create index if not exists idx_order_checklists_order_id
  on public.order_checklists(order_id);
create index if not exists idx_order_checklist_items_checklist_id
  on public.order_checklist_items(checklist_id);

-- Triggers for updated_at
drop trigger if exists set_checklist_templates_updated_at on public.checklist_templates;
create trigger set_checklist_templates_updated_at
  before update on public.checklist_templates
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_order_checklists_updated_at on public.order_checklists;
create trigger set_order_checklists_updated_at
  before update on public.order_checklists
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_order_checklist_items_updated_at on public.order_checklist_items;
create trigger set_order_checklist_items_updated_at
  before update on public.order_checklist_items
  for each row
  execute function public.set_updated_at();

-- Row Level Security (owner_full_access)
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.order_checklists enable row level security;
alter table public.order_checklist_items enable row level security;

drop policy if exists owner_full_access on public.checklist_templates;
create policy owner_full_access on public.checklist_templates
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists owner_full_access on public.checklist_template_items;
create policy owner_full_access on public.checklist_template_items
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists owner_full_access on public.order_checklists;
create policy owner_full_access on public.order_checklists
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists owner_full_access on public.order_checklist_items;
create policy owner_full_access on public.order_checklist_items
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Seed default template: "Единый чек-лист замера мебельного объекта"
do $$
declare
  v_template_id uuid;
begin
  insert into public.checklist_templates (code, title, description, active)
  values (
    'measurement',
    'Единый чек-лист замера мебельного объекта',
    'Пошаговая сверка геометрии, инженерных коммуникаций, комплектации, логистики и акта осмотра на замере у клиента.',
    true
  )
  on conflict (code) do update set
    title = excluded.title,
    description = excluded.description,
    active = excluded.active,
    updated_at = now()
  returning id into v_template_id;

  insert into public.checklist_template_items (
    template_id,
    block_number,
    block_title,
    block_subtitle,
    item_code,
    title,
    description,
    sort_order
  )
  values
    -- БЛОК 1
    (
      v_template_id,
      1,
      'БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ',
      'Где всегда ломаются кухни и шкафы',
      '1.1',
      'Ширина и глубина в 3 уровнях',
      'По полу (0 мм), по уровню столешницы/пояса (900 мм), по верху шкафов (2400–2600 мм). Стены всегда завалены — в расчёт берётся наименьший размер',
      1
    ),
    (
      v_template_id,
      1,
      'БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ',
      'Где всегда ломаются кухни и шкафы',
      '1.2',
      'Высота потолка в 3 точках',
      'Слева, центр, справа (полы и натяжные потолки дают перепад до 20–30 мм)',
      2
    ),
    (
      v_template_id,
      1,
      'БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ',
      'Где всегда ломаются кухни и шкафы',
      '1.3',
      'Углы (90°)',
      'Замерить лазером, угломером или угольником. Если угол развёрнутый (92°) или острый (88°) — зафиксировать ДО раскроя и заложить фальш-планки/запас',
      3
    ),
    (
      v_template_id,
      1,
      'БЛОК 1. ГЕОМЕТРИЯ СТЕН И ОСНОВАНИЙ',
      'Где всегда ломаются кухни и шкафы',
      '1.4',
      'Завал стен и основания',
      'Проверить вертикаль уровнем/лазером, отметить материал стен (бетон, кирпич, газоблок, ГКЛ + закладные) и потолка (монолит, ГКЛ, натяжной — опуск и закладной брус)',
      4
    ),

    -- БЛОК 2
    (
      v_template_id,
      2,
      'БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ',
      'Привязки X, Y, Z от базового угла и чистового пола',
      '2.1',
      'Вода и канализация',
      'Расстояние от угла до центра труб (мм), высота выводов от чистового пола и диаметр труб',
      5
    ),
    (
      v_template_id,
      2,
      'БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ',
      'Привязки X, Y, Z от базового угла и чистового пола',
      '2.2',
      'Вентканал',
      'Расстояние от угла, высота от пола, диаметр отверстия (хватит ли места для венткороба над верхними шкафами)',
      6
    ),
    (
      v_template_id,
      2,
      'БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ',
      'Привязки X, Y, Z от базового угла и чистового пола',
      '2.3',
      'Розетки и кабели',
      'Привязки розеток для вытяжки, духовки, варочной, ПММ, холодильника, СВЧ, стиральной машины и рабочей зоны',
      7
    ),
    (
      v_template_id,
      2,
      'БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ',
      'Привязки X, Y, Z от базового угла и чистового пола',
      '2.4',
      'Главное правило глубины',
      'Проверить, что розетки НЕ находятся строго за посудомойкой или встроенной духовкой (иначе техника не встанет по глубине)',
      8
    ),
    (
      v_template_id,
      2,
      'БЛОК 2. ИНЖЕНЕРКА И ПРЕПЯТСТВИЯ',
      'Привязки X, Y, Z от базового угла и чистового пола',
      '2.5',
      'Препятствия для открывания',
      'Замерить батареи/радиаторы, вылет подоконника, наличники дверей (не будет ли ящик биться при выдвижении), газовые трубы, счётчики, короба ГКЛ, люки и тёплый пол',
      9
    ),

    -- БЛОК 3
    (
      v_template_id,
      3,
      'БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА',
      'Расстановка, открывание, декоры и свет',
      '3.1',
      'Расстановка и высота столешницы',
      'Согласовать границы мебели по рулетке/разметке, проходы и высоту столешницы под рост клиента (860 или 900 мм)',
      10
    ),
    (
      v_template_id,
      3,
      'БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА',
      'Расстановка, открывание, декоры и свет',
      '3.2',
      'Секции, открывание и техника',
      'Проверить стороны открывания каждого фасада/ящика (нет ли удара о стены, радиатор, подоконник, ручки), записать точные габариты/модели техники и доборы/фальш-планки',
      11
    ),
    (
      v_template_id,
      3,
      'БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА',
      'Расстановка, открывание, декоры и свет',
      '3.3',
      'Материалы и фурнитура',
      'Утвердить корпус (ЛДСП Egger / Lamarty, видимые боковины), фасады (МДФ краска/эмаль, плёнка, акрил, шпон), столешницу/фартук и открывание (Blum / Boyard: ручки, профиль Gola или Tip-On)',
      12
    ),
    (
      v_template_id,
      3,
      'БЛОК 3. СОГЛАСОВАНИЕ С КЛИЕНТОМ НА МЕСТЕ: РАССТАНОВКА, МАТЕРИАЛЫ, ПОДСВЕТКА',
      'Расстановка, открывание, декоры и свет',
      '3.4',
      'Подсветка и питание',
      'Согласовать зоны света (рабочая зона, витрины, Gola, цоколь), профиль (врезной/накладной), температуру (3000K / 4000K / холодный), датчик включения, вывод 220V и доступное место под блок питания',
      13
    ),

    -- БЛОК 4
    (
      v_template_id,
      4,
      'БЛОК 4. ЛОГИСТИКА ЗАНОСА',
      'О чём забывают 90% новичков',
      '4.1',
      'Грузовой лифт',
      'Замерить высоту и ширину проёма, глубину и диагональ кабины (войдёт ли цельная столешница 3 м или пенал 2.7 м)',
      14
    ),
    (
      v_template_id,
      4,
      'БЛОК 4. ЛОГИСТИКА ЗАНОСА',
      'О чём забывают 90% новичков',
      '4.2',
      'Лестничный марш и двери',
      'Если лифта нет или он узкий — замерить ширину маршей, разворотных площадок и дверей (если не входит — заложить деление деталей на части в проекте) + уточнить парковку и часы тишины в ЖК',
      15
    ),

    -- БЛОК 5
    (
      v_template_id,
      5,
      'БЛОК 5. АУДИТ ФАЙЛА ЗАМЕРА И ФИКСАЦИЯ С КЛИЕНТОМ',
      'Твой юридический бронежилет',
      '5.1',
      'Перепроверка замеров и самого файла замера',
      'Открыть файл замера на объекте, сверить сходимость всех цепочек размеров с общей длиной стен, убедиться, что нет пустых полей и размеров «на память», прикрепить фото/видео',
      16
    ),
    (
      v_template_id,
      5,
      'БЛОК 5. АУДИТ ФАЙЛА ЗАМЕРА И ФИКСАЦИЯ С КЛИЕНТОМ',
      'Твой юридический бронежилет',
      '5.2',
      'Круговое видео 360° (Акт осмотра объекта)',
      'Снять при входе панораму и все дефекты ремонта (трещины на плитке, сколы на ламинате/паркете, царапины на обоях и дверях), чтобы после сборки не предъявили чужие повреждения',
      17
    ),
    (
      v_template_id,
      5,
      'БЛОК 5. АУДИТ ФАЙЛА ЗАМЕРА И ФИКСАЦИЯ С КЛИЕНТОМ',
      'Твой юридический бронежилет',
      '5.3',
      'Лист согласования (Подпись клиента на месте)',
      'Отрисовать в блокноте эскиз от руки, прописать открывание (ручки / Gola / Tip-On), высоту столешницы (860/900 мм), подсветку, материалы фасадов и корпуса, взять подпись: «Эскиз и комплектация согласованы. Дата, подпись»',
      18
    )
  on conflict (template_id, item_code) do update set
    block_number = excluded.block_number,
    block_title = excluded.block_title,
    block_subtitle = excluded.block_subtitle,
    title = excluded.title,
    description = excluded.description,
    sort_order = excluded.sort_order;
end;
$$;
