do $$
declare
  test_price_item_id uuid;
  test_order_id uuid;
  test_line_id uuid;
  first_calculation_id uuid;
  second_calculation_id uuid;
  edge_waste_pct numeric(5, 4);
begin
  select value_num
  into edge_waste_pct
  from public.parameters
  where key = 'waste_edge_pct';

  if edge_waste_pct is null then
    raise exception 'The seed parameter waste_edge_pct is required for this test';
  end if;

  insert into public.price_items (
    category,
    name,
    unit,
    price,
    waste_applicable,
    waste_kind,
    billable_qty_rounding,
    counts_for_technolog
  )
  values (
    'materials',
    '__calculation_snapshot_test__' || gen_random_uuid()::text,
    'м',
    123,
    true,
    'edge',
    'ceil_to_unit',
    true
  )
  returning id into test_price_item_id;

  insert into public.orders (name)
  values ('__calculation_snapshot_test__')
  returning id into test_order_id;

  insert into public.order_lines (order_id, price_item_id, qty)
  values (test_order_id, test_price_item_id, 2)
  returning id into test_line_id;

  if not exists (
    select 1
    from public.order_lines
    where id = test_line_id
      and category = 'materials'
      and unit = 'м'
      and unit_price = 123
      and waste_pct = edge_waste_pct
      and billable_qty_rounding = 'ceil_to_unit'
      and counts_for_technolog = true
      and is_manual = false
  ) then
    raise exception 'An order line must copy the selected price-item snapshots';
  end if;

  insert into public.calculations (
    order_id,
    version,
    mode,
    params_snapshot,
    input_snapshot,
    result,
    cost_total,
    price_total,
    margin_pct
  )
  values (
    test_order_id,
    999,
    'quote',
    jsonb_build_object('priceRounding', 1000),
    jsonb_build_object(
      'lines', jsonb_build_array(jsonb_build_object(
        'id', test_line_id,
        'unitPrice', 123,
        'wastePct', edge_waste_pct,
        'billableQtyRounding', 'ceil_to_unit',
        'countsForTechnolog', true
      )),
      'adjustments', jsonb_build_array(),
      'contractPrice', null
    ),
    jsonb_build_object('priceTotal', 246),
    246,
    246,
    0
  )
  returning id into first_calculation_id;

  if not exists (
    select 1
    from public.calculations
    where id = first_calculation_id
      and version = 1
      and input_snapshot -> 'lines' -> 0 ->> 'unitPrice' = '123'
      and (input_snapshot -> 'lines' -> 0 ->> 'wastePct')::numeric = edge_waste_pct
      and (input_snapshot -> 'lines' -> 0 ->> 'countsForTechnolog')::boolean = true
  ) then
    raise exception 'The first fixed calculation must retain its complete input snapshot';
  end if;

  update public.price_items
  set price = 456,
      billable_qty_rounding = 'none',
      counts_for_technolog = false
  where id = test_price_item_id;

  update public.order_lines
  set qty = 3
  where id = test_line_id;

  if not exists (
    select 1
    from public.order_lines
    where id = test_line_id
      and unit_price = 123
      and billable_qty_rounding = 'ceil_to_unit'
      and counts_for_technolog = true
  ) or not exists (
    select 1
    from public.calculations
    where id = first_calculation_id
      and input_snapshot -> 'lines' -> 0 ->> 'unitPrice' = '123'
      and (input_snapshot -> 'lines' -> 0 ->> 'wastePct')::numeric = edge_waste_pct
      and (input_snapshot -> 'lines' -> 0 ->> 'countsForTechnolog')::boolean = true
  ) then
    raise exception 'Price-list or order edits must not change a fixed calculation';
  end if;

  begin
    update public.calculations
    set result = jsonb_build_object('priceTotal', 999)
    where id = first_calculation_id;
    raise exception 'Calculation result update should have been rejected';
  exception
    when raise_exception then
      if sqlerrm <> 'Calculation versions are immutable' then
        raise;
      end if;
  end;

  update public.calculations
  set is_contract_baseline = true
  where id = first_calculation_id;

  insert into public.calculations (
    order_id,
    version,
    mode,
    params_snapshot,
    input_snapshot,
    result,
    cost_total,
    price_total,
    margin_pct
  )
  values (
    test_order_id,
    999,
    'quote',
    jsonb_build_object('priceRounding', 1000),
    jsonb_build_object('lines', jsonb_build_array(), 'adjustments', jsonb_build_array(), 'contractPrice', null),
    jsonb_build_object('priceTotal', 0),
    0,
    0,
    null
  )
  returning id into second_calculation_id;

  if not exists (
    select 1
    from public.calculations
    where id = second_calculation_id
      and version = 2
  ) then
    raise exception 'A repeated fix must receive the next version number';
  end if;

  -- Удаление заказа каскадно удаляет calculations
  delete from public.orders where id = test_order_id;
end;
$$;
