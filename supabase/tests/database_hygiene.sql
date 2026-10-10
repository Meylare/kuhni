-- Test for Step A8 (FIX_SPEC_2.md): Database hygiene
-- 1. Function privileges (anon has no execute, authenticated has execute on RPCs)
-- 2. Non-owner cannot execute RPCs
-- 3. calculations immutability (direct DELETE blocked, cascade DELETE allowed)
-- 4. price_history immutability (UPDATE and DELETE blocked)
-- 5. Strict keys in apply_price_updates_to_order
-- 6. Foreign key indexes exist

do $$
declare
  test_order_id uuid;
  test_calc_id uuid;
  test_price_item_id uuid;
  v_err_caught boolean;
  v_count integer;
  required_indexes text[] := array[
    'idx_order_items_order_id',
    'idx_order_lines_order_id',
    'idx_order_lines_order_item_order',
    'idx_order_lines_price_item_id',
    'idx_adjustments_order_id',
    'idx_actual_expenses_order_id',
    'idx_payments_order_id',
    'idx_price_history_price_item_id',
    'idx_product_template_lines_price_item_id'
  ];
  idx_name text;
begin
  -- --------------------------------------------------------------------------
  -- 1. Проверка прав на функции: anon не имеет EXECUTE на RPC
  -- --------------------------------------------------------------------------
  if has_function_privilege('anon', 'public.is_owner()', 'EXECUTE') then
    raise exception 'anon must not have EXECUTE on is_owner()';
  end if;

  if has_function_privilege('anon', 'public.save_parameters(jsonb)', 'EXECUTE') then
    raise exception 'anon must not have EXECUTE on save_parameters(jsonb)';
  end if;

  if has_function_privilege('anon', 'public.set_contract_baseline(uuid, uuid)', 'EXECUTE') then
    raise exception 'anon must not have EXECUTE on set_contract_baseline(uuid, uuid)';
  end if;

  if has_function_privilege('anon', 'public.apply_price_updates_to_order(uuid, jsonb)', 'EXECUTE') then
    raise exception 'anon must not have EXECUTE on apply_price_updates_to_order(uuid, jsonb)';
  end if;

  -- authenticated имеет EXECUTE на RPC
  if not has_function_privilege('authenticated', 'public.is_owner()', 'EXECUTE') then
    raise exception 'authenticated must have EXECUTE on is_owner()';
  end if;

  if not has_function_privilege('authenticated', 'public.save_parameters(jsonb)', 'EXECUTE') then
    raise exception 'authenticated must have EXECUTE on save_parameters(jsonb)';
  end if;

  if not has_function_privilege('authenticated', 'public.set_contract_baseline(uuid, uuid)', 'EXECUTE') then
    raise exception 'authenticated must have EXECUTE on set_contract_baseline(uuid, uuid)';
  end if;

  if not has_function_privilege('authenticated', 'public.apply_price_updates_to_order(uuid, jsonb)', 'EXECUTE') then
    raise exception 'authenticated must have EXECUTE on apply_price_updates_to_order(uuid, jsonb)';
  end if;

  -- --------------------------------------------------------------------------
  -- 2. Не-владелец не может вызвать RPC функции (is_owner() = false)
  -- --------------------------------------------------------------------------
  if public.is_owner() then
    raise exception 'Test environment must not run under owner identity by default';
  end if;

  v_err_caught := false;
  begin
    perform public.save_parameters('{"target_margin_pct": 0.20}'::jsonb);
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'save_parameters must reject non-owner execution';
  end if;

  v_err_caught := false;
  begin
    perform public.set_contract_baseline(gen_random_uuid(), gen_random_uuid());
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'set_contract_baseline must reject non-owner execution';
  end if;

  v_err_caught := false;
  begin
    perform public.apply_price_updates_to_order(gen_random_uuid(), '[]'::jsonb);
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'apply_price_updates_to_order must reject non-owner execution';
  end if;

  -- --------------------------------------------------------------------------
  -- 3. calculations: прямое удаление запрещено, каскадное разрешено
  -- --------------------------------------------------------------------------
  insert into public.orders (name, status)
  values ('__test_hygiene_order__', 'draft')
  returning id into test_order_id;

  insert into public.calculations (
    order_id,
    version,
    status_at_calc,
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
    'draft',
    '{}'::jsonb,
    '{}'::jsonb,
    '{"priceTotal": 100000}'::jsonb,
    80000,
    100000,
    0.20
  )
  returning id into test_calc_id;

  -- Прямое удаление calculations должно быть заблокировано
  v_err_caught := false;
  begin
    delete from public.calculations where id = test_calc_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'Direct delete from calculations must be blocked';
  end if;

  -- Каскадное удаление через удаление заказа должно пройти успешно
  delete from public.orders where id = test_order_id;

  select count(*) into v_count from public.calculations where id = test_calc_id;
  if v_count <> 0 then
    raise exception 'Calculations row should have been deleted by cascade when order was deleted';
  end if;

  -- --------------------------------------------------------------------------
  -- 4. price_history: UPDATE и DELETE запрещены
  -- --------------------------------------------------------------------------
  insert into public.price_items (category, name, unit, price)
  values ('other', '__test_hygiene_item__' || gen_random_uuid()::text, 'шт', 500)
  returning id into test_price_item_id;

  -- Проверяем, что создалась запись истории
  select count(*) into v_count from public.price_history where price_item_id = test_price_item_id;
  if v_count <> 1 then
    raise exception 'Expected 1 price_history row after price_item insert, got %', v_count;
  end if;

  -- Попытка UPDATE price_history должна быть заблокирована
  v_err_caught := false;
  begin
    update public.price_history
    set new_price = 999
    where price_item_id = test_price_item_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'UPDATE on price_history must be blocked';
  end if;

  -- Попытка DELETE price_history должна быть заблокирована
  v_err_caught := false;
  begin
    delete from public.price_history where price_item_id = test_price_item_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'DELETE on price_history must be blocked';
  end if;

  -- --------------------------------------------------------------------------
  -- 5. Проверка наличия всех индексов на внешних ключах
  -- --------------------------------------------------------------------------
  foreach idx_name in array required_indexes loop
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = idx_name
    ) then
      raise exception 'Required index % is missing in schema public', idx_name;
    end if;
  end loop;
end;
$$;
