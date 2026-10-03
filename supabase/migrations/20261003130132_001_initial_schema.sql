create table public.price_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'materials', 'workshop', 'facades', 'hardware', 'transport', 'labor', 'other'
  )),
  name text not null unique,
  unit text not null check (unit in ('лист', 'м2', 'м', 'шт', 'деталь', 'точка', 'проект')),
  price numeric(12, 0) not null check (price >= 0),
  supplier text,
  waste_applicable boolean not null default false,
  waste_kind text check (waste_kind in ('edge')),
  billable_qty_rounding text not null default 'none'
    check (billable_qty_rounding in ('none', 'ceil_to_unit')),
  counts_for_technolog boolean not null default false,
  note text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (
    (waste_applicable = true and waste_kind = 'edge')
    or (waste_applicable = false and waste_kind is null)
  )
);

create table public.price_history (
  id bigint generated always as identity primary key,
  price_item_id uuid not null references public.price_items(id),
  old_price numeric(12, 0),
  new_price numeric(12, 0) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);

create table public.parameters (
  key text primary key,
  value_num numeric,
  value_text text,
  description text,
  updated_at timestamptz not null default now(),
  check ((value_num is null) <> (value_text is null))
);

create table public.product_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

create table public.product_template_lines (
  template_id uuid references public.product_templates(id) on delete cascade,
  price_item_id uuid references public.price_items(id),
  qty numeric(12, 3) not null,
  note text,
  primary key (template_id, price_item_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_label text,
  status text not null default 'draft'
    check (status in ('draft', 'quoted', 'approved', 'in_production', 'done', 'cancelled')),
  contract_price numeric(12, 0),
  settings jsonb not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('kitchen', 'wardrobe', 'other')),
  title text not null,
  description text,
  linear_meters numeric(8, 2),
  dims jsonb not null default '{}',
  unique (id, order_id)
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid,
  price_item_id uuid references public.price_items(id),
  category text not null check (category in (
    'materials', 'workshop', 'facades', 'hardware', 'transport', 'labor', 'other'
  )),
  name text not null,
  unit text not null,
  qty numeric(12, 3) not null check (qty >= 0),
  unit_price numeric(12, 0) not null,
  waste_pct numeric(5, 4) not null default 0 check (waste_pct >= 0),
  billable_qty_rounding text not null default 'none'
    check (billable_qty_rounding in ('none', 'ceil_to_unit')),
  is_manual boolean not null default false,
  comment text,
  foreign key (order_item_id, order_id)
    references public.order_items (id, order_id) on delete cascade
);

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('cost', 'price')),
  category text not null default 'adjustments' check (category = 'adjustments'),
  label text not null,
  amount numeric(12, 0) not null,
  comment text
);

create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  version int not null,
  mode text not null check (mode in ('quote', 'check_contract')),
  params_snapshot jsonb not null,
  input_snapshot jsonb not null,
  result jsonb not null,
  cost_total numeric(12, 0) not null,
  price_total numeric(12, 0) not null,
  margin_pct numeric(6, 4),
  is_contract_baseline boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create unique index calculations_one_contract_baseline_per_order
  on public.calculations (order_id)
  where is_contract_baseline;

create table public.actual_expenses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in (
    'materials', 'workshop', 'facades', 'hardware', 'transport', 'labor', 'other'
  )),
  name text not null,
  amount numeric(12, 0) not null,
  is_rework boolean not null default false,
  rework_reason text,
  note text
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  paid_at date not null default current_date,
  amount numeric(12, 0) not null,
  note text
);

create table public.app_users (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('owner', 'staff', 'agent_readonly'))
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger price_items_set_updated_at
before update on public.price_items
for each row execute function public.set_updated_at();

create trigger parameters_set_updated_at
before update on public.parameters
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();
