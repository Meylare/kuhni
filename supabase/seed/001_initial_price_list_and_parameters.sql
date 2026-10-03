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
  ('materials', 'ЛДСП белый стандарт', 'лист', 14000, false, null, 'none', true, 'корпуса'),
  ('materials', 'ЛДСП цветной базовый', 'лист', 20000, false, null, 'none', true, 'корпуса'),
  ('materials', 'ЛДСП EGGER для фасадов (недорогие декоры)', 'лист', 30000, false, null, 'none', true, null),
  ('materials', 'ЛДСП EGGER для фасадов (дорогие декоры)', 'лист', 45000, false, null, 'none', true, null),
  ('materials', 'Кромка дешёвая', 'м', 70, true, 'edge', 'none', false, null),
  ('materials', 'Кромка EGGER', 'м', 160, true, 'edge', 'none', false, null),
  ('materials', 'ДВП (ХДФ)', 'лист', 7000, false, null, 'none', false, null),

  ('facades', 'МДФ плёнка, Модерн 16 мм', 'м2', 20000, false, null, 'ceil_to_unit', false, null),
  ('facades', 'МДФ плёнка, Фрезеровка 18 мм', 'м2', 26000, false, null, 'ceil_to_unit', false, null),
  ('facades', 'МДФ плёнка, сложная фрезеровка', 'м2', 30000, false, null, 'ceil_to_unit', false, null),
  ('facades', 'МДФ в краске, Модерн', 'м2', 30000, false, null, 'ceil_to_unit', false, null),
  ('facades', 'МДФ в краске, Фрезеровка', 'м2', 38000, false, null, 'ceil_to_unit', false, null),
  ('facades', 'Присадка МДФ', 'м2', 2000, false, null, 'ceil_to_unit', false, null),

  ('workshop', 'Распил EGGER', 'лист', 2200, false, null, 'none', false, null),
  ('workshop', 'Распил обычный ЛДСП', 'лист', 2000, false, null, 'none', false, null),
  ('workshop', 'Присадка ЛДСП', 'лист', 6000, false, null, 'none', false, null),
  ('workshop', 'Закатка кромки стандарт', 'м', 200, false, null, 'none', false, null),
  ('workshop', 'Закатка кромки 40 мм', 'м', 300, false, null, 'none', false, null),
  ('workshop', 'Распил ДВП', 'лист', 1000, false, null, 'none', false, null),
  ('workshop', 'Распил столешницы', 'лист', 2000, false, null, 'none', false, null),
  ('workshop', 'Закатка столешницы', 'лист', 1000, false, null, 'none', false, null),
  ('workshop', 'Закатка криволинейных деталей (узкая)', 'деталь', 1000, false, null, 'none', false, null),
  ('workshop', 'Закатка криволинейных деталей (широкая)', 'деталь', 1300, false, null, 'none', false, null),
  ('workshop', 'Склейка деталей', 'деталь', 1000, false, null, 'none', false, null),
  ('workshop', 'Доставка до цеха', 'проект', 3000, false, null, 'none', false, null),
  ('workshop', 'Упаковка', 'шт', 2000, false, null, 'none', false, 'В v1 вводится вручную; подсказка по умолчанию 12.'),

  ('hardware', 'Петли EH7', 'шт', 350, false, null, 'none', false, null),
  ('hardware', 'Петли GTV', 'шт', 750, false, null, 'none', false, null),
  ('hardware', 'Тандем полного выдвижения 500', 'шт', 6500, false, null, 'none', false, null),

  ('labor', 'Подключение мойки', 'шт', 15000, false, null, 'none', false, null),
  ('labor', 'Подключение стиральной машины', 'шт', 5000, false, null, 'none', false, null),
  ('labor', 'Электрика: подсветка', 'точка', 15000, false, null, 'none', false, 'от, по договорённости'),
  ('labor', 'Подключение варочной поверхности', 'шт', 10000, false, null, 'none', false, null);

insert into public.parameters (key, value_num, value_text, description)
values
  ('target_margin_pct', 0.18, null, 'Доля маржи в цене.'),
  ('assembly_mode', null, 'percent', 'percent или per_meter.'),
  ('assembly_pct', 0.145, null, 'Сборка, доля от цены.'),
  ('assembly_per_meter_kitchen', 35000, null, 'Сборка кухни за погонный метр.'),
  ('assembly_per_meter_wardrobe', 25000, null, 'Сборка шкафа за погонный метр.'),
  ('technolog_mode', null, 'percent', 'percent или per_sheet.'),
  ('technolog_pct', 0.04, null, 'Технолог (Базис), доля от цены.'),
  ('technolog_per_sheet', 4000, null, 'Технолог за лист ЛДСП в проекте.'),
  ('waste_edge_pct', 0.10, null, 'Плановый отход кромки.'),
  ('risk_reserve_pct', 0, null, 'Резерв на риск, доля от цены.'),
  ('price_rounding', 1000, null, 'Округление цены до ближайшей тысячи.');
