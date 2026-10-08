-- Step B3: Preserve custom waste_pct on order_lines insert (fix_spec.md Step B3)
-- Drop default 0 on order_lines.waste_pct so that omitted/null waste_pct can be identified by the trigger.
alter table public.order_lines alter column waste_pct drop default;

-- Update trigger function to coalesce caller-provided waste_pct with snapshot_waste_pct
create or replace function public.snapshot_price_item_on_order_line_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_price_item public.price_items%rowtype;
  snapshot_waste_pct numeric(5, 4);
begin
  if new.price_item_id is null then
    new.waste_pct := coalesce(new.waste_pct, 0);
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
  new.waste_pct := coalesce(new.waste_pct, snapshot_waste_pct, 0);
  new.billable_qty_rounding := source_price_item.billable_qty_rounding;
  new.counts_for_technolog := source_price_item.counts_for_technolog;
  new.is_manual := false;

  return new;
end;
$$;
