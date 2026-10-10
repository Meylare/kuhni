-- Step A5 (FIX_SPEC_2.md): Изменение типа calculations.margin_pct для поддержки сильно отрицательной маржи
-- При цене договора сильно ниже себестоимости (опечатка или экстремальная скидка),
-- маржа может опускаться ниже -100 (-999% и ниже).
-- numeric(6,4) имел ограничение максимум +/- 99.9999, что приводило к numeric field overflow.
-- numeric(12,4) поддерживает значения до +/- 99 999 999.9999.

alter table public.calculations
  alter column margin_pct type numeric(12, 4);
