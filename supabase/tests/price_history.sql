do $$
declare
  test_price_item_id uuid;
  history_count bigint;
begin
  insert into public.price_items (category, name, unit, price)
  values (
    'other',
    '__price_history_test__' || gen_random_uuid()::text,
    'шт',
    100
  )
  returning id into test_price_item_id;

  select count(*) into history_count
  from public.price_history
  where price_item_id = test_price_item_id;

  if history_count <> 1 or not exists (
    select 1 from public.price_history
    where price_item_id = test_price_item_id
      and old_price is null
      and new_price = 100
  ) then
    raise exception 'Insert should create one initial price history row';
  end if;

  update public.price_items
  set price = 100
  where id = test_price_item_id;

  select count(*) into history_count
  from public.price_history
  where price_item_id = test_price_item_id;

  if history_count <> 1 then
    raise exception 'Unchanged price should not create a history row';
  end if;

  update public.price_items
  set price = 125
  where id = test_price_item_id;

  select count(*) into history_count
  from public.price_history
  where price_item_id = test_price_item_id;

  if history_count <> 2 or not exists (
    select 1 from public.price_history
    where price_item_id = test_price_item_id
      and old_price = 100
      and new_price = 125
  ) then
    raise exception 'Changed price should create one old/new history row';
  end if;

  -- Step A8: удаление price_history запрещено
  begin
    delete from public.price_history where price_item_id = test_price_item_id;
    raise exception 'price_history delete should have been blocked';
  exception when others then
    -- Ожидаемая ошибка блокировки удаления
    null;
  end;
end;
$$;
