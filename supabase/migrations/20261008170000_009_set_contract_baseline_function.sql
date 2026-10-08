-- Step A5 (Q3, fix_spec.md): Атомарное назначение договорной базовой версии расчёта.
-- Внутри одной транзакции сбрасывает is_contract_baseline у всех версий заказа
-- и выставляет true у целевой версии.

create or replace function public.set_contract_baseline(p_order_id uuid, p_calc_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Проверка прав владельца
  if not public.is_owner() then
    raise exception 'Access denied: owner role required';
  end if;

  -- Проверяем, что расчёт существует и принадлежит указанному заказу
  if not exists (
    select 1 from public.calculations
    where id = p_calc_id and order_id = p_order_id
  ) then
    raise exception 'Calculation % not found for order %', p_calc_id, p_order_id;
  end if;

  -- Снимаем базовый флаг со всех версий заказа
  update public.calculations
  set is_contract_baseline = false
  where order_id = p_order_id
    and is_contract_baseline = true;

  -- Выставляем базовый флаг у целевой версии
  update public.calculations
  set is_contract_baseline = true
  where id = p_calc_id
    and order_id = p_order_id;
end;
$$;

grant execute on function public.set_contract_baseline(uuid, uuid) to authenticated;
