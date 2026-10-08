-- Step A3: Add assembly and technolog categories to actual_expenses table
alter table public.actual_expenses
  drop constraint if exists actual_expenses_category_check;

alter table public.actual_expenses
  add constraint actual_expenses_category_check
  check (category in (
    'materials', 'workshop', 'facades', 'hardware', 'transport', 'labor', 'assembly', 'technolog', 'other'
  ));

comment on column public.actual_expenses.category is
  'Expense category: materials, workshop, facades, hardware, transport, labor, assembly, technolog, other';
