-- Step A4 (FIX_SPEC_2.md): Блокировка заказа в базе данных
-- Защищает утверждённые заказы (approved, in_production, done, cancelled) от правок через API/агентов
-- Разрешает изменение полей name, client_label, note у заказа.
-- Блокирует contract_price и settings у заблокированного заказа (требуется разблокировка через статус quoted).
-- Блокирует вставку, изменение и удаление строк order_items, order_lines, adjustments.
-- Сохраняет возможность каскадного удаления заказа и внесения факта (actual_expenses, payments, calculations).

-- 1. Триггер для запоминания ID удаляемого заказа при каскадном удалении
create or replace function public.on_order_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.deleting_order_id', OLD.id::text, true);
  return OLD;
end;
$$;

-- 2. Триггер на orders: запрет изменения contract_price и settings в заблокированном статусе
create or replace function public.check_order_header_not_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Проверяем, находится ли заказ в заблокированном статусе
  if OLD.status in ('approved', 'in_production', 'done', 'cancelled') then
    -- Запрещено менять цену договора и индивидуальные настройки без возврата в статус quoted
    if NEW.contract_price is distinct from OLD.contract_price
       or NEW.settings is distinct from OLD.settings then
      raise exception 'order_locked: Заказ утверждён и заблокирован для правок: изменение цены договора и индивидуальных настроек запрещено';
    end if;
  end if;

  return NEW;
end;
$$;

-- 3. Триггер на дочерние таблицы состава: order_items, order_lines, adjustments
create or replace function public.check_order_child_not_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_status text;
begin
  if TG_OP = 'DELETE' then
    v_order_id := OLD.order_id;
  else
    v_order_id := NEW.order_id;
  end if;

  if v_order_id is null then
    return coalesce(NEW, OLD);
  end if;

  -- Если удаление вызвано удалением самого заказа (каскад), разрешаем
  if current_setting('app.deleting_order_id', true) = v_order_id::text then
    return coalesce(NEW, OLD);
  end if;

  -- Проверяем статус заказа
  select status into v_order_status
  from public.orders
  where id = v_order_id;

  -- Если заказ не найден (уже удалён), не блокируем
  if not found or v_order_status is null then
    return coalesce(NEW, OLD);
  end if;

  -- При заблокированном статусе запрещаем изменения состава
  if v_order_status in ('approved', 'in_production', 'done', 'cancelled') then
    raise exception 'order_locked: Заказ утверждён и заблокирован для правок: редактирование состава запрещено';
  end if;

  -- При смене order_id проверяем также старый заказ
  if TG_OP = 'UPDATE' and OLD.order_id is distinct from NEW.order_id then
    if current_setting('app.deleting_order_id', true) = OLD.order_id::text then
      return NEW;
    end if;

    select status into v_order_status
    from public.orders
    where id = OLD.order_id;

    if found and v_order_status in ('approved', 'in_production', 'done', 'cancelled') then
      raise exception 'order_locked: Заказ утверждён и заблокирован для правок: редактирование состава запрещено';
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- 4. Обновление RPC apply_price_updates_to_order с явной проверкой блокировки
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
    v_line_id := coalesce(
      (v_item->>'line_id')::uuid,
      (v_item->>'lineId')::uuid
    );
    v_unit_price := coalesce(
      (v_item->>'unit_price')::numeric,
      (v_item->>'newUnitPrice')::numeric,
      (v_item->>'new_price')::numeric
    );

    if v_line_id is null or v_unit_price is null or v_unit_price < 0 then
      raise exception 'Invalid update element: line_id and non-negative unit_price required, got %', v_item;
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

-- 5. Привязка триггеров к таблицам
drop trigger if exists trg_orders_before_delete on public.orders;
create trigger trg_orders_before_delete
  before delete on public.orders
  for each row
  execute function public.on_order_before_delete();

drop trigger if exists trg_orders_header_lock on public.orders;
create trigger trg_orders_header_lock
  before update on public.orders
  for each row
  execute function public.check_order_header_not_locked();

drop trigger if exists trg_order_items_lock on public.order_items;
create trigger trg_order_items_lock
  before insert or update or delete on public.order_items
  for each row
  execute function public.check_order_child_not_locked();

drop trigger if exists trg_order_lines_lock on public.order_lines;
create trigger trg_order_lines_lock
  before insert or update or delete on public.order_lines
  for each row
  execute function public.check_order_child_not_locked();

drop trigger if exists trg_adjustments_lock on public.adjustments;
create trigger trg_adjustments_lock
  before insert or update or delete on public.adjustments
  for each row
  execute function public.check_order_child_not_locked();
