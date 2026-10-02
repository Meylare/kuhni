# ТЗ: бэкенд калькулятора стоимости мебели (v1)

Документ для AI-агента-разработчика. Владелец проекта — начинающий программист, код сам не пишет. Агент пишет, владелец проверяет результат и принимает решения по бизнес-логике.

## 0. Правила работы агента

1. Работать маленькими шагами в порядке раздела 9. После каждого шага: коротко объяснить, что сделано, как проверить, и ждать подтверждения.
2. Бизнес-формулы и числа не придумывать. Всё, что помечено **ПОДТВЕРДИТЬ**, спросить у владельца. Если чего-то не хватает, спросить, а не угадывать.
3. Всё в Git, коммит после каждого рабочего шага. Схема базы только через файлы миграций (`supabase/migrations`), не кликами в панели.
4. Секреты (ключи Supabase, особенно `service_role`) только в `.env`, который в `.gitignore`. Никогда не коммитить и не печатать в чат.
5. Функция расчёта — одна, чистая (без обращений к базе), с тестами. И приложение, и API агентов используют именно её.
6. Деньги — тенге (KZT), целые числа. Количества — `numeric(12,3)`.

## 1. Контекст

Студия мебели (кухни, шкафы), Казахстан. Нужен инструмент: ввести заказ (изделия, материалы, фурнитура, работы), получить себестоимость и цену, сохранить расчёт и фактические расходы для анализа и корректировки цен. Работает с телефона и ПК, единая база цен, доступ для AI-агентов (например, выгрузка в бухгалтерию). Хостинг и база бесплатные: **Supabase (free plan)**.

Принципиальные решения (уже приняты):

- Цена считается **снизу вверх** по актуальным прайсам, а не подгоняется под историю.
- Потери и переделки **не входят** в цену. Они хранятся отдельно (`actual_expenses.is_rework`). Опционально есть небольшой резерв на риск (`risk_reserve_pct`, по умолчанию 0).
- Цены в позициях заказа **копируются на момент расчёта** (снимок). Смена прайса не меняет старые заказы.
- Личные траты владельца в данные проектов не попадают.

Категории затрат (подписи в интерфейсе): Материалы, Цех, Фурнитура, Транспорт, Работа, Остальное.

## 2. Стек

- Supabase: Postgres, Auth, REST API, Row Level Security.
- Расчёт: TypeScript-модуль `packages/calc` (чистая функция) + тесты (Vitest). Позже тот же модуль подключается в Edge Function для агентов.
- Репозиторий: Git, структура `supabase/migrations`, `supabase/seed`, `packages/calc`, `scripts`.

## 3. Стартовые данные (seed)

Все цены в тенге. Значения даны владельцем.

### 3.1 Материалы (категория `materials`)

| Название | Ед. | Цена | Заметка |
|---|---|---|---|
| ЛДСП белый стандарт | лист | 14 000 | корпуса |
| ЛДСП цветной базовый | лист | 20 000 | корпуса |
| ЛДСП EGGER для фасадов (недорогие декоры) | лист | 30 000 | |
| ЛДСП EGGER для фасадов (дорогие декоры) | лист | 45 000 | |
| МДФ плёнка, Модерн 16 мм | м2 | 20 000 | waste_applicable |
| МДФ плёнка, Фрезеровка 18 мм | м2 | 26 000 | waste_applicable |
| МДФ плёнка, сложная фрезеровка | м2 | 30 000 | waste_applicable |
| МДФ в краске, Модерн | м2 | 30 000 | waste_applicable |
| МДФ в краске, Фрезеровка | м2 | 38 000 | waste_applicable |
| Присадка МДФ | м2 | 2 000 | категория `workshop` |
| Кромка дешёвая | м | 70 | waste_applicable |
| Кромка EGGER | м | 160 | waste_applicable |
| ДВП (ХДФ) | лист | 7 000 | |

### 3.2 Цех (категория `workshop`)

| Название | Ед. | Цена |
|---|---|---|
| Распил EGGER | лист | 2 200 |
| Распил обычный ЛДСП | лист | 2 000 |
| Присадка ЛДСП | лист | 6 000 |
| Закатка кромки стандарт | м | 200 |
| Закатка кромки 40 мм | м | 300 |
| Распил ДВП | лист | 1 000 |
| Распил столешницы | лист | 2 000 |
| Закатка столешницы | лист | 1 000 |
| Закатка криволинейных деталей (узкая) | деталь | 1 000 |
| Закатка криволинейных деталей (широкая) | деталь | 1 300 |
| Склейка деталей | деталь | 1 000 |
| Доставка до цеха | проект | 3 000 |
| Упаковка | шт | 2 000 |

Упаковка: количество упаковок зависит от числа деталей, обычно 10-15 на проект (**ПОДТВЕРДИТЬ**). В v1 вводится вручную, по умолчанию подсказка 12.

### 3.3 Фурнитура (категория `hardware`)

| Название | Ед. | Цена |
|---|---|---|
| Петли EH7 | шт | 350 |
| Петли GTV | шт | 750 |
| Тандем полного выдвижения 500 | шт | 6 500 |

Фурнитуры много («мелочи»). В v1 остальное вводится как ручная позиция заказа (`is_manual`), справочник пополняется позже через интерфейс.

### 3.4 Работы (категория `labor`)

| Название | Ед. | Цена | Заметка |
|---|---|---|---|
| Подключение мойки | шт | 15 000 | |
| Подключение стиральной машины | шт | 5 000 | **ПОДТВЕРДИТЬ** (в исходных данных «5000тыс») |
| Электрика: подсветка | точка | 15 000 | «от», по договорённости |
| Подключение варочной поверхности | шт | 10 000 | |

Сборка и технолог — это параметры (раздел 4), а не позиции справочника.

Транспорт: в v1 ручными позициями (по факту разный).

## 4. Параметры (таблица `parameters`)

Редактируются в интерфейсе. Часть значений можно переопределить для конкретного заказа (`orders.settings`).

| key | значение по умолчанию | пояснение |
|---|---|---|
| `target_margin_pct` | 0.18 | доля маржи в цене. **ПОДТВЕРДИТЬ.** По прошлым проектам бюджет затрат ≈ 79-83% договора |
| `assembly_mode` | `percent` | `percent` или `per_meter` |
| `assembly_pct` | 0.145 | сборка, доля от цены (по опыту 14-15%) |
| `assembly_per_meter_kitchen` | 35 000 | сборка кухни за погонный метр |
| `assembly_per_wardrobe` | 25 000 | сборка шкафа (**ПОДТВЕРДИТЬ**: за шкаф или за метр) |
| `technolog_mode` | `percent` | `percent` или `per_sheet` |
| `technolog_pct` | 0.04 | технолог (Базис), доля от цены |
| `technolog_per_sheet` | 4 000 | технолог за лист в проекте. **ПОДТВЕРДИТЬ** (в исходных данных «4000тыс») |
| `waste_mdf_pct` | 0.10 | отход для позиций с `waste_applicable`. **ПОДТВЕРДИТЬ** |
| `waste_edge_pct` | 0.10 | отход кромки. **ПОДТВЕРДИТЬ** |
| `risk_reserve_pct` | 0 | резерв на риск, доля от цены |
| `price_rounding` | 1 000 | округление цены до ближайшей тысячи |

Для режима `per_sheet` листы технолога считаются по позициям, где у справочника `counts_for_technolog = true` (ЛДСП и МДФ в листах/м2 — **ПОДТВЕРДИТЬ**, что именно считается «листом в проекте»).

## 5. Схема базы (черновик, агент уточняет)

```sql
create table price_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('materials','workshop','hardware','transport','labor','other')),
  name text not null unique,
  unit text not null check (unit in ('лист','м2','м','шт','деталь','точка','проект')),
  price numeric(12,0) not null check (price >= 0),
  supplier text,
  waste_applicable boolean not null default false,
  waste_kind text check (waste_kind in ('mdf','edge')),
  counts_for_technolog boolean not null default false,
  note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table price_history (
  id bigint generated always as identity primary key,
  price_item_id uuid not null references price_items(id),
  old_price numeric(12,0),
  new_price numeric(12,0) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);
-- триггер: при insert/update price_items.price писать строку в price_history

create table parameters (
  key text primary key,
  value_num numeric,
  value_text text,
  description text,
  updated_at timestamptz not null default now()
);

create table product_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);
create table product_template_lines (
  template_id uuid references product_templates(id) on delete cascade,
  price_item_id uuid references price_items(id),
  qty numeric(12,3) not null,
  note text,
  primary key (template_id, price_item_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_label text,
  status text not null default 'draft'
    check (status in ('draft','quoted','approved','in_production','done','cancelled')),
  contract_price numeric(12,0),
  settings jsonb not null default '{}',   -- переопределение параметров для заказа
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (            -- изделия внутри заказа
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null check (kind in ('kitchen','wardrobe','other')),
  title text not null,
  description text,
  linear_meters numeric(8,2),         -- для сборки за метр и будущей аналитики
  dims jsonb not null default '{}'
);

create table order_lines (            -- позиции расчёта
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  price_item_id uuid references price_items(id),      -- null для ручных позиций
  category text not null check (category in ('materials','workshop','hardware','transport','labor','other')),
  name text not null,
  unit text not null,
  qty numeric(12,3) not null check (qty >= 0),
  unit_price numeric(12,0) not null,                  -- СНИМОК цены на момент расчёта
  waste_pct numeric(5,4),                             -- null = взять из параметров по waste_kind
  is_manual boolean not null default false,
  comment text
);

create table adjustments (            -- ручные корректировки заказа
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null check (kind in ('cost','price')),  -- cost: в себестоимость, price: в итоговую цену
  category text check (category in ('materials','workshop','hardware','transport','labor','other')),
  label text not null,
  amount numeric(12,0) not null,                         -- может быть отрицательным (скидка)
  comment text
);

create table calculations (           -- версии расчёта
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  version int not null,
  mode text not null check (mode in ('quote','check_contract')),
  params_snapshot jsonb not null,
  result jsonb not null,
  cost_total numeric(12,0) not null,
  price_total numeric(12,0) not null,
  margin_pct numeric(6,4),
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create table actual_expenses (        -- факт; личные траты сюда не вносятся
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in ('materials','workshop','hardware','transport','labor','other')),
  name text not null,
  amount numeric(12,0) not null,
  is_rework boolean not null default false,
  rework_reason text,
  note text
);

create table payments (               -- поступления от клиента
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  paid_at date not null default current_date,
  amount numeric(12,0) not null,
  note text
);

create table app_users (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('owner','staff','agent_readonly'))
);
```

Чек-листы (шаблоны, экземпляры по заказу, статус утверждения) — отдельный этап, в v1 не делаем, но схема не должна мешать их добавить.

### Доступ и безопасность

- RLS включена на всех таблицах. Полный доступ — роль `owner`.
- Агенты не ходят в таблицы напрямую. Для них создаётся представление `v_accounting_export` (заказ, статус, договор, сумма поступлений, расходы по категориям, сумма переделок, итог) и отдельная роль `agent_readonly` с доступом только к нему.
- Регистрация новых пользователей отключена, вход только для владельца.

## 6. Правила расчёта

Вход: заказ, его позиции (`order_lines`), корректировки, параметры (с учётом `orders.settings`), режим.

**Обозначения:** m = `target_margin_pct`, a = `assembly_pct`, t = `technolog_pct`, r = `risk_reserve_pct`.

1. **Стоимость позиции** = `qty × (1 + waste) × unit_price`, где waste берётся из `waste_pct` позиции или, если он пуст и у позиции `waste_applicable`, из `waste_mdf_pct` / `waste_edge_pct` по `waste_kind`; иначе 0.
2. **Суммы по категориям** (materials, workshop, hardware, transport, labor, other) = сумма стоимостей позиций + корректировки `kind = cost` этой категории.
3. **Сборка и технолог:**
   - режим `percent`: входят в знаменатель как a и t (зависят от цены);
   - режим `per_meter`: сборка = Σ(`linear_meters` кухонь × `assembly_per_meter_kitchen`) + (число шкафов × `assembly_per_wardrobe`), добавляется к фиксированным затратам;
   - режим `per_sheet`: технолог = (число листов по позициям с `counts_for_technolog`) × `technolog_per_sheet`, добавляется к фиксированным затратам.
4. **C_fixed** = сумма по категориям (включая фиксированные работы и фиксированные сборку/технолога).
5. **Режим `quote` (расчёт цены):**
   - `denominator = 1 - m - a_eff - t_eff - r`, где a_eff и t_eff равны a и t только в режиме `percent`, иначе 0;
   - если `denominator < 0.05`, вернуть ошибку «параметры дают некорректную цену»;
   - `P_raw = C_fixed / denominator`; `P = округление P_raw до price_rounding` (half up);
   - затем пересчитать процентные статьи от P: сборка = a_eff × P, технолог = t_eff × P, резерв = r × P;
   - `cost_total = C_fixed + сборка + технолог + резерв`; корректировки `kind = price` прибавляются к P после округления;
   - `margin = P - cost_total`, `margin_pct = margin / P`.
6. **Режим `check_contract`:** P = `orders.contract_price`; процентные статьи считаются от этого P; результат тот же набор полей, плюс `min_price_for_target_margin` (значение P из режима `quote`) и предупреждение, если договор ниже него.
7. **Не входит в расчёт:** переделки, брак, личные траты.
8. **Выход:** JSON: затраты по категориям, процентные статьи, `cost_total`, `price_total`, `margin`, `margin_pct`, `min_price_for_target_margin`, `warnings[]`.

При сохранении расчёта: записать строку в `calculations` (новая версия), `params_snapshot` = фактически использованные параметры, цены позиций уже скопированы в `order_lines.unit_price`.

## 7. Эталонный пример для тестов

Иллюстративный заказ (числа подобраны для проверки логики, это не реальный заказ; позже заменить реальным).

Позиции:

| Категория | Позиция | Кол-во | Цена | Отход |
|---|---|---|---|---|
| materials | ЛДСП белый стандарт | 10 листов | 14 000 | нет |
| materials | Кромка дешёвая | 120 м | 70 | 10% |
| materials | МДФ плёнка, Фрезеровка 18 мм | 6 м2 | 26 000 | 10% |
| materials | ДВП | 2 листа | 7 000 | нет |
| workshop | Распил обычный ЛДСП | 10 листов | 2 000 | нет |
| workshop | Присадка ЛДСП | 10 листов | 6 000 | нет |
| workshop | Закатка кромки стандарт | 120 м | 200 | нет |
| workshop | Распил ДВП | 2 листа | 1 000 | нет |
| workshop | Присадка МДФ | 6 м2 | 2 000 | нет |
| workshop | Доставка до цеха | 1 | 3 000 | нет |
| workshop | Упаковка | 12 шт | 2 000 | нет |
| hardware | Тандем полного выдвижения 500 | 5 шт | 6 500 | нет |
| hardware | Петли GTV | 20 шт | 750 | нет |
| transport | Транспорт (ручная позиция) | 1 | 20 000 | нет |
| labor | Подключение мойки | 1 | 15 000 | нет |

Кухня: 3 погонных метра. Параметры по умолчанию из раздела 4.

Ожидаемые результаты:

- Материалы 334 840; Цех 145 000; Фурнитура 47 500; Транспорт 20 000; Работа (фиксированная) 15 000; **C_fixed = 562 340**.
- **Тест A** (`quote`, сборка и технолог в процентах): P_raw ≈ 885 575, **цена 886 000**, сборка 128 470, технолог 35 440, **себестоимость 726 250**, маржа 159 750, **margin_pct ≈ 18,03%**.
- **Тест B** (`check_contract`, договор 850 000): себестоимость 719 590, маржа 130 410, margin_pct ≈ 15,34%, предупреждение «договор ниже минимальной цены 886 000».
- **Тест C** (`quote`, `assembly_mode = per_meter`, технолог в процентах): сборка 3 × 35 000 = 105 000 в фиксированных затратах, C_fixed = 667 340, **цена 856 000**, себестоимость 701 580, margin_pct ≈ 18,04%.

## 8. Тесты

1. Модульные тесты расчёта: примеры A, B, C из раздела 7.
2. Границы: нулевые количества, знаменатель ≤ 0,05 (ошибка), отрицательная корректировка (скидка), позиция с переопределённым отходом.
3. Снимок: изменить цену в `price_items` после сохранения расчёта; старый заказ и расчёт не меняются.
4. История цен: изменение цены создаёт строку в `price_history`.
5. Безопасность: анонимный запрос не читает ни одной таблицы; `agent_readonly` читает только `v_accounting_export`.
6. Импорт: после загрузки прайса число позиций в `price_items` совпадает с разделом 3.
7. Импорт исторических проектов: суммы расходов совпадают с источником (данные из очищенной таблицы, личные траты исключены). Ориентиры из дашборда: Улы Дала 10 — 368 835; Омарова 12 — 711 830; Асфандиярова 10 — 1 154 575. Расхождения показывать владельцу, не подгонять. Известное расхождение: Кошкарбаева 54а — дашборд 2 386 738, таблица 2 327 848.

Проверка «расчёт против истории» в v1 только по агрегатам (категории, доля затрат от договора ≈ 79-83%): детальных спецификаций по старым проектам нет.

## 9. Шаги и критерии готовности

| № | Шаг | Готово, когда |
|---|---|---|
| 0 | Репозиторий, Supabase-проект, Supabase CLI, `.env`, `.gitignore` | `supabase start` или подключение к облачному проекту работает, секреты не в Git |
| 1 | Миграция 001: схема из раздела 5 | миграции применяются с нуля без ошибок, таблицы видны в панели |
| 2 | Seed: прайс (раздел 3) и параметры (раздел 4) | число строк совпадает, у параметров стоят значения по умолчанию |
| 3 | Триггер истории цен | тест 4 проходит |
| 4 | Модуль расчёта `packages/calc` с тестами | тесты A, B, C и граничные проходят |
| 5 | Сохранение расчёта: копирование цен в `order_lines`, запись в `calculations` | тест «снимок» проходит |
| 6 | RLS, роли, представление `v_accounting_export` | тест безопасности проходит |
| 7 | Импорт исторических проектов | суммы сверены с разделом 8, п. 7 |
| 8 | Скрипт резервной копии базы (раз в неделю) и инструкция восстановления | дамп создаётся и успешно восстанавливается в тестовый проект |

Интерфейс (телефон/ПК), чек-листы и доступ агентов с записью — отдельные ТЗ после шага 8.

## 10. Открытые вопросы к владельцу

1. «Технолог 4000тыс за лист» и «стиралка 5000тыс»: это 4 000 и 5 000 тенге?
2. Сборка шкафа 25 000: за шкаф или за погонный метр?
3. Целевая маржа 18% от цены — подходит? Проценты сборки (14,5%) и технолога (4%) оставляем по умолчанию?
4. Отход МДФ и кромки: 10% подходит?
5. Что считать «листом в проекте» для технолога (только ЛДСП или также МДФ)?
6. Где хранить столешницу, ручки, подсветку и мелочи фурнитуры: добавить в справочник сейчас или вводить вручную?