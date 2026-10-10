-- Test for Step A5 (FIX_SPEC_2.md): Вставка версии с сильно отрицательной маржей
do $$
declare
  test_order_id uuid;
  test_calc_id uuid;
  v_saved_margin numeric;
begin
  -- 1. Создаём заказ
  insert into public.orders (name, status)
  values ('__test_margin_overflow_order__', 'draft')
  returning id into test_order_id;

  -- 2. Вставляем версию расчёта с margin_pct = -999.185 (-99918.5%)
  -- При numeric(6,4) это вызывало ошибку "numeric field overflow"
  insert into public.calculations (
    order_id,
    version,
    mode,
    params_snapshot,
    input_snapshot,
    result,
    cost_total,
    price_total,
    margin_pct
  )
  values (
    test_order_id,
    1,
    'check_contract',
    '{}'::jsonb,
    '{}'::jsonb,
    '{"marginPct": -999.185}'::jsonb,
    1000000,
    1000,
    -999.1850
  )
  returning id into test_calc_id;

  -- 3. Проверяем сохранённое значение
  select margin_pct into v_saved_margin
  from public.calculations
  where id = test_calc_id;

  if v_saved_margin <> -999.1850 then
    raise exception 'Expected margin_pct = -999.1850, got %', v_saved_margin;
  end if;

  -- 4. Очищаем тестовые данные
  delete from public.orders where id = test_order_id;
end;
$$;
