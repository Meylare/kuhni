-- Migration 017: Seed additional price items requested by owner (Step B6)
-- Facade vitrina, countertops (EGGER/F&S, standard), handles & Gola, dish racks

insert into public.price_items (
  category,
  name,
  unit,
  price,
  waste_applicable,
  waste_kind,
  billable_qty_rounding,
  counts_for_technolog,
  note
)
values
  -- Фасады
  ('facades', 'Витрина алюминиевый профиль', 'м2', 55000, false, null, 'none', false, 'Алюминиевый фасад-витрина'),

  -- Столешницы
  ('materials', 'Столешница EGGER/F&S 4м', 'шт', 70000, false, null, 'none', false, 'Столешница 4 метра'),
  ('materials', 'Столешница EGGER/F&S 3м', 'шт', 46000, false, null, 'none', false, 'Столешница 3 метра'),
  ('materials', 'Столешница стандарт 3м', 'шт', 30000, false, null, 'none', false, 'Столешница стандартная 3 метра'),

  -- Ручки и профиль
  ('hardware', 'Ручки', 'шт', 1500, false, null, 'none', false, 'Ручки мебельные'),
  ('hardware', 'Профиль Gola 3м', 'шт', 25000, false, null, 'none', false, 'Профиль Gola длина 3м'),

  -- Сушки для посуды
  ('hardware', 'Сушка стандарт 600 мм', 'шт', 5000, false, null, 'none', false, 'Сушка стандарт для модуля 600 мм'),
  ('hardware', 'Сушка стандарт 900 мм', 'шт', 10000, false, null, 'none', false, 'Сушка стандарт для модуля 900 мм'),
  ('hardware', 'Сушка нижнего монтажа 600 мм', 'шт', 45000, false, null, 'none', false, 'Сушка выдвижная / нижнего монтажа 600 мм')
on conflict (name) do update set
  category = excluded.category,
  unit = excluded.unit,
  price = excluded.price,
  waste_applicable = excluded.waste_applicable,
  waste_kind = excluded.waste_kind,
  billable_qty_rounding = excluded.billable_qty_rounding,
  counts_for_technolog = excluded.counts_for_technolog,
  note = excluded.note,
  updated_at = now();
