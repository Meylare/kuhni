-- Step 6: access is denied by default. Until the owner explicitly defines
-- staff and external-agent workflows, only an authenticated owner may use data.

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

comment on function public.is_owner() is
  'True only for the authenticated user assigned the owner role in app_users.';

alter table public.price_items enable row level security;
alter table public.price_history enable row level security;
alter table public.parameters enable row level security;
alter table public.product_templates enable row level security;
alter table public.product_template_lines enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_lines enable row level security;
alter table public.adjustments enable row level security;
alter table public.calculations enable row level security;
alter table public.actual_expenses enable row level security;
alter table public.payments enable row level security;
alter table public.app_users enable row level security;

create policy owner_full_access on public.price_items
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.price_history
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.parameters
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.product_templates
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.product_template_lines
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.orders
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.order_items
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.order_lines
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.adjustments
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.calculations
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.actual_expenses
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.payments
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy owner_full_access on public.app_users
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Views use the caller's RLS policies. Therefore the future accounting export
-- cannot expose rows to a non-owner merely because the view exists.
-- Its business definition, including the meaning of the "total" column, is
-- intentionally added in a later migration after owner confirmation.
