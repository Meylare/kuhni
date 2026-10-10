-- Step A8 (FIX_SPEC_2.md): Гигиена базы данных
-- 1. Ограничение прав на функции (revoke public, anon; grant authenticated только нужным RPC и триггерам)
-- 2. Неизменяемость истории (запрет прямого DELETE calculations, запрет UPDATE/DELETE price_history)
-- 3. Индексы на внешних ключах
-- 4. Очистка RPC apply_price_updates_to_order от устаревших алиасов ключей

-- ============================================================================
-- 1. Очистка и ужесточение RPC apply_price_updates_to_order
-- ============================================================================
create or replace function public.apply_price_updates_to_order(
  p_order_id uuid,
  p_updates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_line_id uuid;
  v_unit_price numeric;
  v_count integer := 0;
  v_rows_affected integer := 0;
  v_order_status text;
begin
  -- Проверка прав владельца
  if not public.is_owner() then
    raise exception 'Access denied: owner role required';
  end if;

  -- Проверка существования заказа и статуса
  select status into v_order_status
  from public.orders
  where id = p_order_id;

  if not found or v_order_status is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order_status in ('approved', 'in_production', 'done', 'cancelled') then
    raise exception 'order_locked: Заказ утверждён и заблокирован для правок';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'Invalid updates payload: expected JSON array';
  end if;

  for v_item in select * from jsonb_array_elements(p_updates) loop
    -- Принимаем строго только line_id и unit_price (без алиасов lineId, newUnitPrice, new_price)
    if not (v_item ? 'line_id' and v_item ? 'unit_price') then
      raise exception 'Invalid update element: strict line_id and unit_price keys required, got %', v_item;
    end if;

    v_line_id := (v_item->>'line_id')::uuid;
    v_unit_price := (v_item->>'unit_price')::numeric;

    if v_line_id is null or v_unit_price is null or v_unit_price < 0 then
      raise exception 'Invalid update element: non-null line_id and non-negative unit_price required, got %', v_item;
    end if;

    update public.order_lines
    set unit_price = v_unit_price
    where id = v_line_id
      and order_id = p_order_id;

    get diagnostics v_rows_affected = row_count;

    if v_rows_affected <> 1 then
      raise exception 'Expected to update 1 line for id % in order %, but affected % rows',
        v_line_id, p_order_id, v_rows_affected;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ============================================================================
-- 2. Неизменяемость истории: calculations и price_history
-- ============================================================================

-- Запрет прямого удаления версий расчёта (разрешено только каскадное удаление заказа)
create or replace function public.check_calculation_not_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Если удаление вызвано удалением заказа (каскад), сессионная переменная установлена триггером on_order_before_delete
  if current_setting('app.deleting_order_id', true) = OLD.order_id::text then
    return OLD;
  end if;

  -- 2. Если родительский заказ уже удалён (проверка на случай каскадного удаления без сессионной переменной), разрешаем
  if not exists (select 1 from public.orders where id = OLD.order_id) then
    return OLD;
  end if;

  -- Иначе прямое удаление версии расчёта запрещено
  raise exception 'calculations_immutable: Удаление версий расчёта запрещено';
end;
$$;

drop trigger if exists trg_calculations_prevent_delete on public.calculations;
create trigger trg_calculations_prevent_delete
  before delete on public.calculations
  for each row
  execute function public.check_calculation_not_deleted();

-- Запрет любых изменений и удалений записей в price_history (только добавление)
create or replace function public.prevent_price_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'price_history_immutable: История изменения цен неизменяема (UPDATE и DELETE запрещены)';
end;
$$;

drop trigger if exists trg_price_history_prevent_mutation on public.price_history;
create trigger trg_price_history_prevent_mutation
  before update or delete on public.price_history
  for each row
  execute function public.prevent_price_history_mutation();

-- ============================================================================
-- 3. Индексы на внешних ключах
-- ============================================================================
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_lines_order_id on public.order_lines(order_id);
create index if not exists idx_order_lines_order_item_order on public.order_lines(order_item_id, order_id);
create index if not exists idx_order_lines_price_item_id on public.order_lines(price_item_id);
create index if not exists idx_adjustments_order_id on public.adjustments(order_id);
create index if not exists idx_actual_expenses_order_id on public.actual_expenses(order_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_price_history_price_item_id on public.price_history(price_item_id);
create index if not exists idx_product_template_lines_price_item_id on public.product_template_lines(price_item_id);

-- ============================================================================
-- 4. Права на функции (revoke public/anon, grant authenticated)
-- ============================================================================
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Разрешаем authenticated вызывать только необходимые RPC-функции
grant execute on function public.is_owner() to authenticated;
grant execute on function public.save_parameters(jsonb) to authenticated;
grant execute on function public.set_contract_baseline(uuid, uuid) to authenticated;
grant execute on function public.apply_price_updates_to_order(uuid, jsonb) to authenticated;

-- Разрешаем authenticated исполнение триггерных функций
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.record_price_history() to authenticated;
grant execute on function public.snapshot_price_item_on_order_line_insert() to authenticated;
grant execute on function public.assign_calculation_version() to authenticated;
grant execute on function public.prevent_calculation_content_change() to authenticated;
grant execute on function public.on_order_before_delete() to authenticated;
grant execute on function public.check_order_header_not_locked() to authenticated;
grant execute on function public.check_order_child_not_locked() to authenticated;
grant execute on function public.check_calculation_not_deleted() to authenticated;
grant execute on function public.prevent_price_history_mutation() to authenticated;
