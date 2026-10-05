do $$
declare
  test_order_id uuid;
  export_row public.v_accounting_export%rowtype;
begin
  insert into public.orders (name, contract_price)
  values ('__accounting_export_test__' || gen_random_uuid()::text, 100000)
  returning id into test_order_id;

  insert into public.payments (order_id, amount)
  values
    (test_order_id, 25000),
    (test_order_id, 35000);

  insert into public.actual_expenses (order_id, category, name, amount, is_rework)
  values
    (test_order_id, 'materials', 'Test material', 10000, false),
    (test_order_id, 'workshop', 'Test rework', 5000, true),
    (test_order_id, 'labor', 'Test labor', 20000, false);

  select *
  into export_row
  from public.v_accounting_export
  where order_id = test_order_id;

  if export_row.contract_price <> 100000
    or export_row.payments_total <> 60000
    or export_row.payment_balance <> 40000
    or export_row.materials_expenses <> 10000
    or export_row.workshop_expenses <> 5000
    or export_row.labor_expenses <> 20000
    or export_row.actual_expenses_total <> 35000
    or export_row.rework_total <> 5000
    or export_row.actual_profit_before_rework <> 70000
    or export_row.actual_profit_after_rework <> 65000 then
    raise exception 'Accounting export values are incorrect: %', row_to_json(export_row);
  end if;

  delete from public.orders where id = test_order_id;
end;
$$;
