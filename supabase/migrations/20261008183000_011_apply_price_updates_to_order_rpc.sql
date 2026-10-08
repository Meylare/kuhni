-- Step B2 (fix_spec.md): RPC функция apply_price_updates_to_order
-- Массовое атомарное обновление цен позиций заказа в единой транзакции
-- с гарантией проверки затронутых строк.

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
begin
  -- Проверка прав владельца
  if not public.is_owner() then
    raise exception 'Access denied: owner role required';
  end if;

  -- Проверка существования заказа
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Order % not found', p_order_id;
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

grant execute on function public.apply_price_updates_to_order(uuid, jsonb) to authenticated;
