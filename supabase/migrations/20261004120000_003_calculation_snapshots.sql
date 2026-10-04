-- A line selected from the price list keeps the properties that were in effect
-- when it was added to an order. Later edits to price_items do not change it.
create function public.snapshot_price_item_on_order_line_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_price_item public.price_items%rowtype;
  snapshot_waste_pct numeric(5, 4);
begin
  if new.price_item_id is null then
    return new;
  end if;

  select *
  into source_price_item
  from public.price_items
  where id = new.price_item_id;

  if not found then
    raise exception 'Price item % was not found', new.price_item_id;
  end if;

  if source_price_item.waste_applicable then
    select value_num
    into snapshot_waste_pct
    from public.parameters
    where key = 'waste_edge_pct';

    if snapshot_waste_pct is null then
      raise exception 'Parameter waste_edge_pct is required for price item %', source_price_item.id;
    end if;
  else
    snapshot_waste_pct := 0;
  end if;

  new.category := source_price_item.category;
  new.name := source_price_item.name;
  new.unit := source_price_item.unit;
  new.unit_price := source_price_item.price;
  new.waste_pct := snapshot_waste_pct;
  new.billable_qty_rounding := source_price_item.billable_qty_rounding;
  new.is_manual := false;

  return new;
end;
$$;

create trigger order_lines_snapshot_price_item_on_insert
before insert on public.order_lines
for each row execute function public.snapshot_price_item_on_order_line_insert();

-- The database assigns the next version inside the transaction. The advisory
-- lock serializes concurrent fixes for the same order.
create function public.assign_calculation_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.order_id::text, 0));

  select coalesce(max(version), 0) + 1
  into new.version
  from public.calculations
  where order_id = new.order_id;

  return new;
end;
$$;

create trigger calculations_assign_version
before insert on public.calculations
for each row execute function public.assign_calculation_version();

-- A fixed calculation may only change its contract-baseline marker. Its
-- snapshots and result stay immutable while the order itself remains editable.
create function public.prevent_calculation_content_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'is_contract_baseline') is distinct from
     (to_jsonb(old) - 'is_contract_baseline') then
    raise exception 'Calculation versions are immutable';
  end if;

  return new;
end;
$$;

create trigger calculations_prevent_content_change
before update on public.calculations
for each row execute function public.prevent_calculation_content_change();
