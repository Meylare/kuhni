-- Test for apply_price_updates_to_order RPC function (Step B2)
do $$
declare
  test_order_id uuid;
  test_line_1_id uuid;
  test_line_2_id uuid;
  v_updated_count integer;
  v_p1 numeric;
  v_p2 numeric;
  v_err_caught boolean := false;
begin
  -- Создаём тестовый заказ
  insert into public.orders (name, status)
  values ('__test_price_updates_order__', 'draft')
  returning id into test_order_id;

  -- Создаём две позиции заказа
  insert into public.order_lines (order_id, category, name, unit, qty, unit_price)
  values
    (test_order_id, 'materials', 'Тест ЛДСП 1', 'лист', 2, 10000)
  returning id into test_line_1_id;

  insert into public.order_lines (order_id, category, name, unit, qty, unit_price)
  values
    (test_order_id, 'materials', 'Тест ЛДСП 2', 'лист', 3, 20000)
  returning id into test_line_2_id;

  -- 1. Успешное массовое обновление цен
  select public.apply_price_updates_to_order(
    test_order_id,
    jsonb_build_array(
      jsonb_build_object('line_id', test_line_1_id, 'unit_price', 12000),
      jsonb_build_object('line_id', test_line_2_id, 'unit_price', 25000)
    )
  ) into v_updated_count;

  if v_updated_count <> 2 then
    raise exception 'Expected 2 updated lines, got %', v_updated_count;
  end if;

  select unit_price into v_p1 from public.order_lines where id = test_line_1_id;
  select unit_price into v_p2 from public.order_lines where id = test_line_2_id;

  if v_p1 <> 12000 or v_p2 <> 25000 then
    raise exception 'Prices were not updated properly: p1=%, p2=%', v_p1, v_p2;
  end if;

  -- 2. Ошибка при обновлении несуществующей строки (должен произойти откат)
  v_err_caught := false;
  begin
    perform public.apply_price_updates_to_order(
      test_order_id,
      jsonb_build_array(
        jsonb_build_object('line_id', gen_random_uuid(), 'unit_price', 99999)
      )
    );
  exception when others then
    v_err_caught := true;
  end;

  if not v_err_caught then
    raise exception 'apply_price_updates_to_order should reject nonexistent line';
  end if;

  -- 3. Step A8: проверка отклонения устаревших алиасов (lineId, newUnitPrice)
  v_err_caught := false;
  begin
    perform public.apply_price_updates_to_order(
      test_order_id,
      jsonb_build_array(
        jsonb_build_object('lineId', test_line_1_id, 'newUnitPrice', 99999)
      )
    );
  exception when others then
    v_err_caught := true;
  end;

  if not v_err_caught then
    raise exception 'apply_price_updates_to_order must reject legacy keys (lineId/newUnitPrice)';
  end if;

  -- Очистка тестовых данных
  delete from public.orders where id = test_order_id;
end;
$$;
