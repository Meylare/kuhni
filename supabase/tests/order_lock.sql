-- Test for Step A4: Блокировка заказа в базе данных
do $$
declare
  test_order_id uuid;
  test_item_id uuid;
  test_line_id uuid;
  test_adj_id uuid;
  test_expense_id uuid;
  test_payment_id uuid;
  v_err_caught boolean;
  v_count integer;
begin
  -- 1. Создаём заказ в статусе draft
  insert into public.orders (name, client_label, status, contract_price, settings)
  values ('__test_lock_order__', 'Клиент Тест', 'draft', 500000, '{"target_margin_pct": 0.20}'::jsonb)
  returning id into test_order_id;

  -- 2. В draft вставка позиций разрешена
  insert into public.order_items (order_id, kind, title)
  values (test_order_id, 'kitchen', 'Основная секция')
  returning id into test_item_id;

  insert into public.order_lines (order_id, order_item_id, category, name, unit, qty, unit_price)
  values (test_order_id, test_item_id, 'materials', 'ЛДСП Тест', 'лист', 2, 15000)
  returning id into test_line_id;

  insert into public.adjustments (order_id, kind, label, amount)
  values (test_order_id, 'price', 'Скидка на монтаж', -10000)
  returning id into test_adj_id;

  -- 3. Переводим в quoted — редактирование и состав разрешены
  update public.orders set status = 'quoted' where id = test_order_id;

  update public.order_lines
  set unit_price = 16000
  where id = test_line_id;

  -- 4. Переводим в approved (заблокирован)
  update public.orders set status = 'approved' where id = test_order_id;

  -- 5. Попытка вставки новой позиции в approved — должна упасть
  v_err_caught := false;
  begin
    insert into public.order_items (order_id, kind, title)
    values (test_order_id, 'wardrobe', 'Шкаф');
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'order_items insert must be blocked when status is approved';
  end if;

  -- 6. Попытка изменения строки заказа в approved — должна упасть
  v_err_caught := false;
  begin
    update public.order_lines
    set unit_price = 20000
    where id = test_line_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'order_lines update must be blocked when status is approved';
  end if;

  -- 7. Попытка удаления корректировки в approved — должна упасть
  v_err_caught := false;
  begin
    delete from public.adjustments where id = test_adj_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'adjustments delete must be blocked when status is approved';
  end if;

  -- 8. RPC apply_price_updates_to_order на заблокированном заказе — должна упасть
  v_err_caught := false;
  begin
    perform public.apply_price_updates_to_order(
      test_order_id,
      jsonb_build_array(
        jsonb_build_object('line_id', test_line_id, 'unit_price', 18000)
      )
    );
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'apply_price_updates_to_order must be blocked when status is approved';
  end if;

  -- 9. В approved смена contract_price или settings — должна упасть
  v_err_caught := false;
  begin
    update public.orders
    set contract_price = 600000
    where id = test_order_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'contract_price update must be blocked when status is approved';
  end if;

  v_err_caught := false;
  begin
    update public.orders
    set settings = '{"target_margin_pct": 0.25}'::jsonb
    where id = test_order_id;
  exception when others then
    v_err_caught := true;
  end;
  if not v_err_caught then
    raise exception 'settings update must be blocked when status is approved';
  end if;

  -- 10. В approved смена name и client_label — РАЗРЕШЕНА
  update public.orders
  set name = '__test_lock_order_renamed__',
      client_label = 'Новый лейбл клиента'
  where id = test_order_id;

  -- 11. В approved внесение платежей и фактических расходов — РАЗРЕШЕНО
  insert into public.actual_expenses (order_id, category, name, amount)
  values (test_order_id, 'materials', 'Распил', 25000)
  returning id into test_expense_id;

  insert into public.payments (order_id, amount, note)
  values (test_order_id, 300000, 'Аванс 60%')
  returning id into test_payment_id;

  -- 12. Разблокировка: смена статуса approved -> quoted РАЗРЕШЕНА
  update public.orders
  set status = 'quoted'
  where id = test_order_id;

  -- После разблокировки редактирование цены и строк снова разрешено
  update public.orders
  set contract_price = 550000
  where id = test_order_id;

  update public.order_lines
  set unit_price = 17000
  where id = test_line_id;

  -- 13. Удаление заказа каскадом — проходит без ошибок
  delete from public.orders where id = test_order_id;

  -- Проверяем, что дочерние записи удалились
  select count(*) into v_count from public.order_lines where order_id = test_order_id;
  if v_count <> 0 then
    raise exception 'Expected 0 order_lines after order cascade delete, got %', v_count;
  end if;
end;
$$;
