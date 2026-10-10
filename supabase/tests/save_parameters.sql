-- Test for save_parameters RPC function (Step B1)
do $$
declare
  test_valid_payload jsonb := '{
    "target_margin_pct": 0.20,
    "price_rounding": 1000,
    "assembly_mode": "percent",
    "assembly_pct": 0.15,
    "assembly_per_meter_kitchen": 35000,
    "assembly_per_meter_wardrobe": 25000,
    "technolog_mode": "percent",
    "technolog_pct": 0.05,
    "technolog_per_sheet": 4000,
    "waste_edge_pct": 0.10,
    "risk_reserve_pct": 0.02
  }'::jsonb;

  test_invalid_sum jsonb := '{
    "target_margin_pct": 0.60,
    "price_rounding": 1000,
    "assembly_mode": "percent",
    "assembly_pct": 0.30,
    "assembly_per_meter_kitchen": 35000,
    "assembly_per_meter_wardrobe": 25000,
    "technolog_mode": "percent",
    "technolog_pct": 0.15,
    "technolog_per_sheet": 4000,
    "waste_edge_pct": 0.10,
    "risk_reserve_pct": 0.00
  }'::jsonb;

  test_invalid_rounding jsonb := '{
    "target_margin_pct": 0.18,
    "price_rounding": 0,
    "assembly_mode": "percent",
    "assembly_pct": 0.145,
    "assembly_per_meter_kitchen": 35000,
    "assembly_per_meter_wardrobe": 25000,
    "technolog_mode": "percent",
    "technolog_pct": 0.04,
    "technolog_per_sheet": 4000,
    "waste_edge_pct": 0.10,
    "risk_reserve_pct": 0.00
  }'::jsonb;

  v_margin numeric;
  v_err_caught boolean := false;
begin
  -- 1. Успешный вызов save_parameters
  perform public.save_parameters(test_valid_payload);

  select value_num into v_margin
  from public.parameters
  where key = 'target_margin_pct';

  if v_margin <> 0.20 then
    raise exception 'Expected margin to be updated to 0.20, got %', v_margin;
  end if;

  -- 2. Проверка блокировки при сумме ставок > 80% (MAX_PRICE_SHARES_SUM)
  v_err_caught := false;
  begin
    perform public.save_parameters(test_invalid_sum);
  exception when others then
    v_err_caught := true;
  end;

  if not v_err_caught then
    raise exception 'save_parameters should reject sum of shares > 80%%';
  end if;

  -- 2b. Граничное значение: ровно 80% (0.50 + 0.15 + 0.05 + 0.10 = 0.80) разрешено
  perform public.save_parameters('{
    "target_margin_pct": 0.50,
    "price_rounding": 1000,
    "assembly_mode": "percent",
    "assembly_pct": 0.15,
    "assembly_per_meter_kitchen": 35000,
    "assembly_per_meter_wardrobe": 25000,
    "technolog_mode": "percent",
    "technolog_pct": 0.05,
    "technolog_per_sheet": 4000,
    "waste_edge_pct": 0.10,
    "risk_reserve_pct": 0.10
  }'::jsonb);

  -- 2c. Граничное значение: чуть больше 80% (0.501 + 0.15 + 0.05 + 0.10 = 0.801) запрещено
  v_err_caught := false;
  begin
    perform public.save_parameters('{
      "target_margin_pct": 0.501,
      "price_rounding": 1000,
      "assembly_mode": "percent",
      "assembly_pct": 0.15,
      "assembly_per_meter_kitchen": 35000,
      "assembly_per_meter_wardrobe": 25000,
      "technolog_mode": "percent",
      "technolog_pct": 0.05,
      "technolog_per_sheet": 4000,
      "waste_edge_pct": 0.10,
      "risk_reserve_pct": 0.10
    }'::jsonb);
  exception when others then
    v_err_caught := true;
  end;

  if not v_err_caught then
    raise exception 'save_parameters should reject sum of shares = 0.801 (> 80%%)';
  end if;

  -- 3. Проверка блокировки при невалидном округлении (<= 0)
  v_err_caught := false;
  begin
    perform public.save_parameters(test_invalid_rounding);
  exception when others then
    v_err_caught := true;
  end;

  if not v_err_caught then
    raise exception 'save_parameters should reject price_rounding <= 0';
  end if;

  -- Восстанавливаем эталонные параметры
  perform public.save_parameters('{
    "target_margin_pct": 0.18,
    "price_rounding": 1000,
    "assembly_mode": "percent",
    "assembly_pct": 0.145,
    "assembly_per_meter_kitchen": 35000,
    "assembly_per_meter_wardrobe": 25000,
    "technolog_mode": "percent",
    "technolog_pct": 0.04,
    "technolog_per_sheet": 4000,
    "waste_edge_pct": 0.10,
    "risk_reserve_pct": 0.00
  }'::jsonb);
end;
$$;
