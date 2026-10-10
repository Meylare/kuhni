# ТЗ: бэкенд калькулятора стоимости мебели (v1)

Документ для AI-агента-разработчика. Владелец проекта — начинающий программист, код сам не пишет. Агент пишет, владелец проверяет результат и принимает решения по бизнес-логике.

## 0. Правила работы агента

1. Работать маленькими шагами в порядке раздела 9. После каждого шага: коротко объяснить, что сделано, как проверить, и ждать подтверждения.
2. Бизнес-формулы и числа не придумывать. Всё, что помечено **ПОДТВЕРДИТЬ**, спросить у владельца. Если чего-то не хватает, спросить, а не угадывать.
3. Всё в Git, коммит после каждого рабочего шага. Схема базы только через файлы миграций (`supabase/migrations`), не кликами в панели.
4. Секреты (ключи Supabase, особенно `service_role`) только в `.env`, который в `.gitignore`. Никогда не коммитить и не печатать в чат.
5. Функция расчёта — одна, чистая (без обращений к базе), с тестами. И приложение, и API агентов используют именно её.
6. Деньги — тенге (KZT), целые числа. Количества — `numeric(12,3)`, кроме погонных метров: `numeric(8,2)` (точность до сантиметра).

## 1. Контекст

Студия мебели (кухни, шкафы), Казахстан. Нужен инструмент: ввести заказ (изделия, материалы, фурнитура, работы), получить себестоимость и цену, сохранить расчёт и фактические расходы для анализа и корректировки цен. Работает с телефона и ПК, единая база цен, доступ для AI-агентов (например, выгрузка в бухгалтерию). Хостинг и база бесплатные: **Supabase (free plan)**.

Принципиальные решения (уже приняты):

- Цена считается **снизу вверх** по актуальным прайсам, а не подгоняется под историю.
- Потери и переделки **не входят** в цену. Они хранятся отдельно (`actual_expenses.is_rework`). Опционально есть небольшой резерв на риск (`risk_reserve_pct`, по умолчанию 0).
- При добавлении позиции из прайса цена, отход и правило округления **копируются в `order_lines`**. При фиксации расчёта сохраняется полный снимок входных данных. Смена прайса не меняет старые заказы и версии расчётов.
- Личные траты владельца в данные проектов не попадают.

Категории затрат (подписи в интерфейсе): Материалы, Цех, Фасады МДФ, Фурнитура, Транспорт, Работа, Остальное, Корректировки.

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
| Кромка дешёвая | м | 70 | waste_applicable |
| Кромка EGGER | м | 160 | waste_applicable |
| ДВП (ХДФ) | лист | 7 000 | |

Кромке применяется плановый отход 10%. Для остальных материалов из этого раздела отход не применяется.

### 3.2 Фасады МДФ (категория `facades`)

| Название | Ед. | Цена | Правило расчёта |
|---|---|---|---|
| МДФ плёнка, Модерн 16 мм | м2 | 20 000 | отход 0%; оплачиваемые м2 округлять вверх до целого |
| МДФ плёнка, Фрезеровка 18 мм | м2 | 26 000 | отход 0%; оплачиваемые м2 округлять вверх до целого |
| МДФ плёнка, сложная фрезеровка | м2 | 30 000 | отход 0%; оплачиваемые м2 округлять вверх до целого |
| МДФ в краске, Модерн | м2 | 30 000 | отход 0%; оплачиваемые м2 округлять вверх до целого |
| МДФ в краске, Фрезеровка | м2 | 38 000 | отход 0%; оплачиваемые м2 округлять вверх до целого |
| Присадка МДФ | м2 | 2 000 | отход 0%; оплачиваемые м2 округлять вверх до целого |

Фасады и присадка МДФ оплачиваются цеху отдельными счетами, поэтому выделены в самостоятельную категорию для аналитики.

### 3.3 Цех (категория `workshop`)

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

### 3.4 Фурнитура (категория `hardware`)

| Название | Ед. | Цена |
|---|---|---|
| Петли EH7 | шт | 350 |
| Петли GTV | шт | 750 |
| Тандем полного выдвижения 500 | шт | 6 500 |

Фурнитуры много («мелочи»). В v1 остальное вводится как ручная позиция заказа (`is_manual`), справочник пополняется позже через интерфейс.

### 3.5 Работы (категория `labor`)

| Название | Ед. | Цена | Заметка |
|---|---|---|---|
| Подключение мойки | шт | 15 000 | |
| Подключение стиральной машины | шт | 5 000 | |
| Электрика: подсветка | точка | 15 000 | «от», по договорённости |
| Подключение варочной поверхности | шт | 10 000 | |

Сборка и технолог — это параметры (раздел 4), а не позиции справочника.

Транспорт: в v1 ручными позициями (по факту разный).

## 4. Параметры (таблица `parameters`)

Редактируются в интерфейсе. Часть значений можно переопределить для конкретного заказа (`orders.settings`).

| key | значение по умолчанию | пояснение |
|---|---|---|
| `target_margin_pct` | 0.18 | доля маржи в цене. По прошлым проектам бюджет затрат ≈ 79-83% договора |
| `assembly_mode` | `percent` | `percent` или `per_meter` |
| `assembly_pct` | 0.145 | сборка, доля от цены (по опыту 14-15%) |
| `assembly_per_meter_kitchen` | 35 000 | сборка кухни за погонный метр |
| `assembly_per_meter_wardrobe` | 25 000 | сборка шкафа за погонный метр |
| `technolog_mode` | `percent` | `percent` или `per_sheet` |
| `technolog_pct` | 0.04 | технолог (Базис), доля от цены |
| `technolog_per_sheet` | 4 000 | технолог за лист ЛДСП в проекте |
| `waste_edge_pct` | 0.10 | отход кромки |
| `risk_reserve_pct` | 0 | резерв на риск, доля от цены |
| `price_rounding` | 1 000 | округление цены до ближайшей тысячи |

Для режима `per_sheet` листы технолога считаются по позициям, где у справочника `counts_for_technolog = true`. На старте это только ЛДСП; МДФ и ДВП (ХДФ) не учитываются.

## 5. Схема базы (черновик, агент уточняет)

```sql
create table price_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('materials','workshop','facades','hardware','transport','labor','other')),
  name text not null unique,
  unit text not null check (unit in ('лист','м2','м','шт','деталь','точка','проект')),
  price numeric(12,0) not null check (price >= 0),
  supplier text,
  waste_applicable boolean not null default false,
  waste_kind text check (waste_kind in ('edge')),
  billable_qty_rounding text not null default 'none'
    check (billable_qty_rounding in ('none','ceil_to_unit')),
  counts_for_technolog boolean not null default false,
  note text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (
    (waste_applicable = true and waste_kind = 'edge')
    or (waste_applicable = false and waste_kind is null)
  )
);
-- Для фасадов МДФ billable_qty_rounding = 'ceil_to_unit'; для остальных стартовых позиций — 'none'.

create table price_history (
  id bigint generated always as identity primary key,
  price_item_id uuid not null references price_items(id),
  old_price numeric(12,0),
  new_price numeric(12,0) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);
-- триггер: при insert и при фактическом изменении price_items.price писать строку в price_history

create table parameters (
  key text primary key,
  value_num numeric,
  value_text text,
  description text,
  updated_at timestamptz not null default now(),
  check ((value_num is null) <> (value_text is null))
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
  dims jsonb not null default '{}',
  unique (id, order_id)
);

create table order_lines (            -- позиции расчёта: изделия или весь заказ
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid,
  price_item_id uuid references price_items(id),      -- null для ручных позиций
  category text not null check (category in ('materials','workshop','facades','hardware','transport','labor','other')),
  name text not null,
  unit text not null,
  qty numeric(12,3) not null check (qty >= 0),
  unit_price numeric(12,0) not null,                  -- СНИМОК цены на момент расчёта
  waste_pct numeric(5,4) not null default 0 check (waste_pct >= 0), -- СНИМОК отхода
  billable_qty_rounding text not null default 'none'
    check (billable_qty_rounding in ('none','ceil_to_unit')),       -- СНИМОК округления количества
  is_manual boolean not null default false,
  comment text,
  foreign key (order_item_id, order_id)
    references order_items (id, order_id) on delete cascade
);

create table adjustments (            -- ручные корректировки заказа
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null check (kind in ('cost','price')),  -- cost: в себестоимость, price: в итоговую цену
  category text not null default 'adjustments' check (category = 'adjustments'),
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
  input_snapshot jsonb not null,       -- позиции, корректировки и договорная цена на момент фиксации
  result jsonb not null,
  cost_total numeric(12,0) not null,
  price_total numeric(12,0) not null,
  margin_pct numeric(6,4),
  is_contract_baseline boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, version)
);
-- Частичный уникальный индекс: не более одной версии is_contract_baseline = true для заказа.

create table actual_expenses (        -- факт; личные траты сюда не вносятся
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in ('materials','workshop','facades','hardware','transport','labor','other')),
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

Триггер до обновления устанавливает `updated_at = now()` для `price_items`, `parameters` и `orders`.

Чек-листы (шаблоны, экземпляры по заказу, статус утверждения) — отдельный этап, в v1 не делаем, но схема не должна мешать их добавить.

### Доступ и безопасность

- RLS включена на всех таблицах. Полный доступ — роль `owner`.
- Внешний доступ AI-агентов пока не реализуется: способ аутентификации и выдачи данных требует отдельного решения владельца. Представление `v_accounting_export` планируется для выгрузки: заказ, статус, договор, сумма поступлений, расходы по категориям, сумма переделок, итог.
- Регистрация новых пользователей отключена, вход только для владельца.

## 6. Правила расчёта

Вход: заказ, его позиции (`order_lines`), корректировки, параметры (с учётом `orders.settings`), режим.

**Обозначения:** m = `target_margin_pct`, a = `assembly_pct`, t = `technolog_pct`, r = `risk_reserve_pct`.

1. **Стоимость позиции.** `qty_with_waste = qty × (1 + waste_pct)`, где `waste_pct` уже скопирован в `order_lines` при добавлении позиции. Затем применяется снимок правила `billable_qty_rounding`: для `ceil_to_unit` оплачиваемое количество = `ceil(qty_with_waste)`, для `none` оно равно `qty_with_waste`. Стоимость позиции = `ceil(оплачиваемое количество × unit_price)` в тенге. Таким образом, фасады МДФ площадью 6.6 м2 оплачиваются как 7 м2; итог любой позиции округляется вверх до целого тенге.
2. **Суммы по категориям** (materials, workshop, facades, hardware, transport, labor, other) = сумма стоимостей позиций. Корректировки `kind = cost` образуют отдельную категорию `adjustments` и входят в общую себестоимость.
3. **Сборка и технолог:**
   - режим `percent`: входят в знаменатель как a и t (зависят от цены);
   - режим `per_meter`: сборка = Σ(`linear_meters` кухонь × `assembly_per_meter_kitchen`) + Σ(`linear_meters` шкафов × `assembly_per_meter_wardrobe`), добавляется к фиксированным затратам;
   - режим `per_sheet`: технолог = (число листов по позициям с `counts_for_technolog`) × `technolog_per_sheet`, добавляется к фиксированным затратам.
4. **C_fixed** = сумма по категориям (включая фиксированные работы и фиксированные сборку/технолога).
5. **Режим `quote` (расчёт цены):**
   - `denominator = 1 - m - a_eff - t_eff - r`, где a_eff и t_eff равны a и t только в режиме `percent`, иначе 0;
   - если `denominator <= 0`, вернуть ошибку «параметры не оставляют доли цены для фиксированных затрат»;
   - `P_raw = C_fixed / denominator`; `P_base = округление P_raw до price_rounding` (half up);
   - `price_total = P_base + сумма корректировок kind = price`;
   - процентные статьи считаются от `price_total`: сборка = a_eff × `price_total`, технолог = t_eff × `price_total`, резерв = r × `price_total`;
   - `cost_total = C_fixed + сборка + технолог + резерв`; `margin = price_total - cost_total`, `margin_pct = margin / price_total`.
6. **Режим `check_contract`:** `price_total = orders.contract_price` — это итоговая цена подписанного договора, уже учитывающая договорные скидки и надбавки. Процентные статьи считаются от `price_total`; дополнительные корректировки `kind = price` в этом режиме не прибавляются повторно. Результат содержит тот же набор полей, `min_price_for_target_margin` (значение `P_base` из режима `quote`) и предупреждение, если договор ниже него.
7. **Не входит в расчёт:** переделки, брак, личные траты.
8. **Выход:** JSON: затраты по категориям, процентные статьи, `cost_total`, `price_total`, `margin`, `margin_pct`, `min_price_for_target_margin`, `warnings[]`.

При нажатии «Зафиксировать расчёт» создаётся новая неизменяемая версия в `calculations`: `params_snapshot` содержит фактически использованные параметры, а `input_snapshot` — позиции, их снимки цены, отхода и округления, корректировки и договорную цену. Заказ остаётся редактируемым; повторная фиксация создаёт следующую версию. Одну версию можно отметить как расчёт подписанного договора (`is_contract_baseline = true`).

## 7. Эталонный пример для тестов

Иллюстративный заказ (числа подобраны для проверки логики, это не реальный заказ; позже заменить реальным).

Позиции:

| Категория | Позиция | Кол-во | Цена | Отход |
|---|---|---|---|---|
| materials | ЛДСП белый стандарт | 10 листов | 14 000 | нет |
| materials | Кромка дешёвая | 120 м | 70 | 10% |
| facades | МДФ плёнка, Фрезеровка 18 мм | 6 м2 | 26 000 | нет; оплачивается 6 м2 |
| materials | ДВП | 2 листа | 7 000 | нет |
| workshop | Распил обычный ЛДСП | 10 листов | 2 000 | нет |
| workshop | Присадка ЛДСП | 10 листов | 6 000 | нет |
| workshop | Закатка кромки стандарт | 120 м | 200 | нет |
| workshop | Распил ДВП | 2 листа | 1 000 | нет |
| facades | Присадка МДФ | 6 м2 | 2 000 | нет; оплачивается 6 м2 |
| workshop | Доставка до цеха | 1 | 3 000 | нет |
| workshop | Упаковка | 12 шт | 2 000 | нет |
| hardware | Тандем полного выдвижения 500 | 5 шт | 6 500 | нет |
| hardware | Петли GTV | 20 шт | 750 | нет |
| transport | Транспорт (ручная позиция) | 1 | 20 000 | нет |
| labor | Подключение мойки | 1 | 15 000 | нет |

Кухня: 3 погонных метра. Параметры по умолчанию из раздела 4.

Ожидаемые результаты:

- Материалы 163 240; Фасады МДФ 168 000; Цех 133 000; Фурнитура 47 500; Транспорт 20 000; Работа (фиксированная) 15 000; **C_fixed = 546 740**.
- **Тест A** (`quote`, сборка и технолог в процентах): P_raw ≈ 861 008, **цена 862 000**, сборка 124 990, технолог 34 480, **себестоимость 706 210**, маржа 155 790, **margin_pct ≈ 18,07%**.
- **Тест B** (`check_contract`, договор 850 000): себестоимость 703 990, маржа 146 010, margin_pct ≈ 17,18%, предупреждение «договор ниже минимальной цены 862 000».
- **Тест C** (`quote`, `assembly_mode = per_meter`, технолог в процентах): сборка 3 × 35 000 = 105 000 в фиксированных затратах, C_fixed = 651 740, **цена 836 000**, себестоимость 685 180, margin_pct ≈ 18,04%.

## 8. Тесты

1. Модульные тесты расчёта: примеры A, B, C из раздела 7.
2. Границы: нулевые количества, знаменатель ≤ 0 (ошибка), отрицательная корректировка (скидка), позиция с переопределённым отходом, фасад 6.6 м2, оплачиваемый как 7 м2.
3. Снимок: изменить цену, настройку отхода или округления в `price_items` после сохранения расчёта; старый заказ и расчёт не меняются.
4. История цен: изменение цены создаёт строку в `price_history`.
5. Безопасность: анонимный запрос не читает ни одной таблицы; до выбора способа внешнего доступа `v_accounting_export` доступно только владельцу.
6. Импорт: после загрузки прайса число позиций в `price_items` совпадает с разделом 3.
7. Импорт исторических проектов отложен. Когда он понадобится, исходником будет экспорт Google Sheets в CSV или Excel; суммы расходов сверяются с источником, личные траты исключаются, расхождения показываются владельцу без подгонки.

Когда начнётся импорт истории, проверка «расчёт против истории» будет только по агрегатам: категориям и доле затрат от договора ≈ 79-83%. Детальных спецификаций по старым проектам нет.

## 9. Шаги и критерии готовности

| № | Шаг | Готово, когда |
|---|---|---|
| 0 | Репозиторий, Supabase-проект, Supabase CLI, `.env`, `.gitignore` | `supabase start` или подключение к облачному проекту работает, секреты не в Git |
| 1 | Миграция 001: схема из раздела 5 | миграции применяются с нуля без ошибок, таблицы видны в панели |
| 2 | Seed: прайс (раздел 3) и параметры (раздел 4) | число строк совпадает, у параметров стоят значения по умолчанию; фасады МДФ имеют округление до целого м2 вверх |
| 3 | Триггер истории цен | тест 4 проходит |
| 4 | Модуль расчёта `packages/calc` с тестами | тесты A, B, C и граничные проходят |
| 5 | Фиксация расчёта: копирование свойств позиции в `order_lines`, запись полной версии в `calculations` | тест «снимок» проходит; старая версия воспроизводится после изменений заказа |
| 6 | RLS, роли, представление `v_accounting_export` | анонимный запрос ничего не читает; полномочия `staff` и внешних агентов определены владельцем |
| 7 | Импорт исторических проектов | отложен до решения владельца и выгрузки Google Sheets |
| 8 | Скрипт резервной копии базы (раз в неделю) и инструкция восстановления | дамп создаётся и успешно восстанавливается в тестовый проект |

Интерфейс (телефон/ПК), чек-листы и доступ агентов с записью — отдельные ТЗ после шага 8.

## 10. Открытые вопросы к владельцу

1. Какой способ доступа нужен внешним AI-агентам: пока только выгрузка владельцу, отдельные учётные записи Supabase Auth или защищённая Edge Function, отдающая только `v_accounting_export`? Рекомендуемый вариант — Edge Function: внешний агент не получает прямой доступ к базе, а `service_role` остаётся только в серверном окружении.
2. Какие права нужны роли `staff`: просмотр, создание и изменение заказов, редактирование прайса, просмотр фактических расходов?
3. Столешницы, ручки, подсветку и мелочи фурнитуры вносить в справочник сейчас или пока добавлять в заказ вручную?
