-- Step B1 (fix_spec.md, Q1): Атомарное сохранение параметров и валидация.
-- Принимает JSON с 11 параметрами, валидирует диапазоны и обновляет все строки
-- в единой транзакции. Если обновлено не 11 строк — бросает исключение с откатом.

create or replace function public.save_parameters(p_params jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_margin_pct numeric;
  v_price_rounding numeric;
  v_assembly_mode text;
  v_assembly_pct numeric;
  v_assembly_per_meter_kitchen numeric;
  v_assembly_per_meter_wardrobe numeric;
  v_technolog_mode text;
  v_technolog_pct numeric;
  v_technolog_per_sheet numeric;
  v_waste_edge_pct numeric;
  v_risk_reserve_pct numeric;

  v_assembly_share numeric;
  v_technolog_share numeric;
  v_sum_shares numeric;
  v_updated_count integer := 0;
begin
  -- Проверка прав владельца
  if not public.is_owner() then
    raise exception 'Access denied: owner role required';
  end if;

  if p_params is null or jsonb_typeof(p_params) <> 'object' then
    raise exception 'Invalid payload: expected JSON object';
  end if;

  -- Извлечение значений
  v_target_margin_pct := (p_params->>'target_margin_pct')::numeric;
  v_price_rounding := (p_params->>'price_rounding')::numeric;
  v_assembly_mode := p_params->>'assembly_mode';
  v_assembly_pct := (p_params->>'assembly_pct')::numeric;
  v_assembly_per_meter_kitchen := (p_params->>'assembly_per_meter_kitchen')::numeric;
  v_assembly_per_meter_wardrobe := (p_params->>'assembly_per_meter_wardrobe')::numeric;
  v_technolog_mode := p_params->>'technolog_mode';
  v_technolog_pct := (p_params->>'technolog_pct')::numeric;
  v_technolog_per_sheet := (p_params->>'technolog_per_sheet')::numeric;
  v_waste_edge_pct := (p_params->>'waste_edge_pct')::numeric;
  v_risk_reserve_pct := (p_params->>'risk_reserve_pct')::numeric;

  -- Проверка наличия всех 11 параметров
  if v_target_margin_pct is null or
     v_price_rounding is null or
     v_assembly_mode is null or
     v_assembly_pct is null or
     v_assembly_per_meter_kitchen is null or
     v_assembly_per_meter_wardrobe is null or
     v_technolog_mode is null or
     v_technolog_pct is null or
     v_technolog_per_sheet is null or
     v_waste_edge_pct is null or
     v_risk_reserve_pct is null then
    raise exception 'All 11 parameters must be provided';
  end if;

  -- Валидация строковых режимов
  if v_assembly_mode not in ('percent', 'per_meter') then
    raise exception 'Invalid assembly_mode: %', v_assembly_mode;
  end if;

  if v_technolog_mode not in ('percent', 'per_sheet') then
    raise exception 'Invalid technolog_mode: %', v_technolog_mode;
  end if;

  -- Валидация числовых диапазонов
  if v_target_margin_pct < 0 or v_target_margin_pct >= 1.0 then
    raise exception 'target_margin_pct must be between 0 and 1, got %', v_target_margin_pct;
  end if;

  if v_assembly_pct < 0 or v_assembly_pct >= 1.0 then
    raise exception 'assembly_pct must be between 0 and 1, got %', v_assembly_pct;
  end if;

  if v_technolog_pct < 0 or v_technolog_pct >= 1.0 then
    raise exception 'technolog_pct must be between 0 and 1, got %', v_technolog_pct;
  end if;

  if v_risk_reserve_pct < 0 or v_risk_reserve_pct >= 1.0 then
    raise exception 'risk_reserve_pct must be between 0 and 1, got %', v_risk_reserve_pct;
  end if;

  if v_waste_edge_pct < 0 then
    raise exception 'waste_edge_pct must be non-negative, got %', v_waste_edge_pct;
  end if;

  if v_price_rounding <= 0 then
    raise exception 'price_rounding must be strictly positive, got %', v_price_rounding;
  end if;

  if v_assembly_per_meter_kitchen < 0 then
    raise exception 'assembly_per_meter_kitchen must be non-negative, got %', v_assembly_per_meter_kitchen;
  end if;

  if v_assembly_per_meter_wardrobe < 0 then
    raise exception 'assembly_per_meter_wardrobe must be non-negative, got %', v_assembly_per_meter_wardrobe;
  end if;

  if v_technolog_per_sheet < 0 then
    raise exception 'technolog_per_sheet must be non-negative, got %', v_technolog_per_sheet;
  end if;

  -- Валидация знаменателя: блокируем сохранение, только если сумма ставок >= 100% (знаменатель <= 0)
  v_assembly_share := case when v_assembly_mode = 'percent' then v_assembly_pct else 0 end;
  v_technolog_share := case when v_technolog_mode = 'percent' then v_technolog_pct else 0 end;
  v_sum_shares := v_target_margin_pct + v_assembly_share + v_technolog_share + v_risk_reserve_pct;

  if v_sum_shares >= 1.0 then
    raise exception 'Sum of percentage shares must be strictly less than 100%% (denominator <= 0). Got %', v_sum_shares;
  end if;

  -- Атомарное обновление строк в единой транзакции
  update public.parameters
  set value_num = case
        when key = 'target_margin_pct' then v_target_margin_pct
        when key = 'price_rounding' then v_price_rounding
        when key = 'assembly_pct' then v_assembly_pct
        when key = 'assembly_per_meter_kitchen' then v_assembly_per_meter_kitchen
        when key = 'assembly_per_meter_wardrobe' then v_assembly_per_meter_wardrobe
        when key = 'technolog_pct' then v_technolog_pct
        when key = 'technolog_per_sheet' then v_technolog_per_sheet
        when key = 'waste_edge_pct' then v_waste_edge_pct
        when key = 'risk_reserve_pct' then v_risk_reserve_pct
        else null
      end,
      value_text = case
        when key = 'assembly_mode' then v_assembly_mode
        when key = 'technolog_mode' then v_technolog_mode
        else null
      end,
      updated_at = now()
  where key in (
    'target_margin_pct',
    'price_rounding',
    'assembly_mode',
    'assembly_pct',
    'assembly_per_meter_kitchen',
    'assembly_per_meter_wardrobe',
    'technolog_mode',
    'technolog_pct',
    'technolog_per_sheet',
    'waste_edge_pct',
    'risk_reserve_pct'
  );

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 11 then
    raise exception 'Expected to update exactly 11 parameters, but updated %', v_updated_count;
  end if;
end;
$$;

grant execute on function public.save_parameters(jsonb) to authenticated;
