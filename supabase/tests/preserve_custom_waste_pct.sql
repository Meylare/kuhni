-- Test for preserving custom waste_pct on order_lines insert (Step B3)
do $$
declare
  test_order_id uuid;
  edge_price_item_id uuid;
  test_line_1_id uuid;
  test_line_2_id uuid;
  test_line_manual_id uuid;
  v_waste_1 numeric;
  v_waste_2 numeric;
  v_waste_manual numeric;
  v_global_edge_waste numeric;
begin
  -- Получаем глобальный отход кромки
  select value_num into v_global_edge_waste
  from public.parameters
  where key = 'waste_edge_pct';

  if v_global_edge_waste is null then
    v_global_edge_waste := 0.10;
  end if;

  -- Находим позицию кромки (waste_applicable = true)
  select id into edge_price_item_id
  from public.price_items
  where waste_applicable = true
  limit 1;

  if edge_price_item_id is null then
    raise exception 'Edge price item not found';
  end if;

  -- Создаём тестовый заказ
  insert into public.orders (name, status)
  values ('__test_custom_waste_order__', 'draft')
  returning id into test_order_id;

  -- 1. Вставка позиции из прайса с явно указанным отходом 15% (0.15)
  insert into public.order_lines (
    order_id,
    price_item_id,
    qty,
    waste_pct
  )
  values (
    test_order_id,
    edge_price_item_id,
    10,
    0.15
  )
  returning id, waste_pct into test_line_1_id, v_waste_1;

  if v_waste_1 <> 0.15 then
    raise exception 'Test 1 failed: Expected custom waste_pct 0.15, got %', v_waste_1;
  end if;

  -- 2. Вставка позиции из прайса без указания waste_pct (null), должна подставиться глобальная кромка (0.10)
  insert into public.order_lines (
    order_id,
    price_item_id,
    qty,
    waste_pct
  )
  values (
    test_order_id,
    edge_price_item_id,
    10,
    null
  )
  returning id, waste_pct into test_line_2_id, v_waste_2;

  if v_waste_2 <> v_global_edge_waste then
    raise exception 'Test 2 failed: Expected default global waste_pct %, got %', v_global_edge_waste, v_waste_2;
  end if;

  -- 3. Вставка ручной позиции с null waste_pct, должна стать 0
  insert into public.order_lines (
    order_id,
    category,
    name,
    unit,
    qty,
    unit_price,
    waste_pct
  )
  values (
    test_order_id,
    'transport',
    'Тест доставка',
    'проект',
    1,
    5000,
    null
  )
  returning id, waste_pct into test_line_manual_id, v_waste_manual;

  if v_waste_manual <> 0 then
    raise exception 'Test 3 failed: Expected manual line waste_pct 0, got %', v_waste_manual;
  end if;

  -- Очистка
  delete from public.orders where id = test_order_id;
end;
$$;
