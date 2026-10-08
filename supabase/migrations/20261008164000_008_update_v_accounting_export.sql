-- Step A4: Update v_accounting_export to include assembly and technolog expenses
-- and adhere to the transparent financial summary formula (actual_profit_after_rework = contract_price - actual_expenses_total).
create or replace view public.v_accounting_export
with (security_invoker = true)
as
select
  orders.id as order_id,
  orders.name as order_name,
  orders.status,
  orders.contract_price,
  payments.payments_total,
  orders.contract_price - payments.payments_total as payment_balance,
  expenses.materials_expenses,
  expenses.workshop_expenses,
  expenses.facades_expenses,
  expenses.hardware_expenses,
  expenses.transport_expenses,
  expenses.labor_expenses,
  expenses.assembly_expenses,
  expenses.technolog_expenses,
  expenses.other_expenses,
  expenses.actual_expenses_total,
  expenses.rework_total,
  orders.contract_price - (expenses.actual_expenses_total - expenses.rework_total)
    as actual_profit_before_rework,
  orders.contract_price - expenses.actual_expenses_total
    as actual_profit_after_rework
from public.orders
left join lateral (
  select coalesce(sum(payments.amount), 0)::numeric as payments_total
  from public.payments
  where payments.order_id = orders.id
) as payments on true
left join lateral (
  select
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'materials'), 0)::numeric
      as materials_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'workshop'), 0)::numeric
      as workshop_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'facades'), 0)::numeric
      as facades_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'hardware'), 0)::numeric
      as hardware_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'transport'), 0)::numeric
      as transport_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'labor'), 0)::numeric
      as labor_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'assembly'), 0)::numeric
      as assembly_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'technolog'), 0)::numeric
      as technolog_expenses,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.category = 'other'), 0)::numeric
      as other_expenses,
    coalesce(sum(actual_expenses.amount), 0)::numeric as actual_expenses_total,
    coalesce(sum(actual_expenses.amount) filter (where actual_expenses.is_rework), 0)::numeric as rework_total
  from public.actual_expenses
  where actual_expenses.order_id = orders.id
) as expenses on true;

revoke all on public.v_accounting_export from anon;
grant select on public.v_accounting_export to authenticated;

comment on view public.v_accounting_export is
  'Accounting export. actual_profit_after_rework is contract price minus all actual expenses (including reworks).';
