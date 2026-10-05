do $$
declare
  protected_tables text[] := array[
    'price_items', 'price_history', 'parameters', 'product_templates',
    'product_template_lines', 'orders', 'order_items', 'order_lines',
    'adjustments', 'calculations', 'actual_expenses', 'payments', 'app_users'
  ];
  protected_table text;
begin
  foreach protected_table in array protected_tables loop
    if not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = protected_table
        and relation.relrowsecurity
    ) then
      raise exception 'RLS must be enabled on public.%', protected_table;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = protected_table
        and policyname = 'owner_full_access'
        and roles = array['authenticated']::name[]
        and cmd = 'ALL'
    ) then
      raise exception 'Owner policy is missing on public.%', protected_table;
    end if;
  end loop;

  if public.is_owner() then
    raise exception 'An anonymous session must not be an owner';
  end if;
end;
$$;
