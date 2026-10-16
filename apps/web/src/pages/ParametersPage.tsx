import { useEffect, useState } from "react";

import { formatErrorMessage } from "../lib/errors";
import {
  evaluateDenominator,
  formatPercent,
  formatPercentInput,
  PARAMETER_DEFINITIONS,
  PARAMETER_GROUPS,
  parametersArrayToMap,
  parsePercent,
  type ParametersMap,
} from "../lib/parameters";
import { parsePrice } from "../lib/price-items";
import { getSupabase } from "../lib/supabase";
import { demoSaveParameters, isDemoModeActive, loadDemoState } from "../lib/demo-data";
import type { ParameterItem } from "../types/database";

interface FormState {
  target_margin_pct: string;
  price_rounding: string;
  assembly_mode: "percent" | "per_meter";
  assembly_pct: string;
  assembly_per_meter_kitchen: string;
  assembly_per_meter_wardrobe: string;
  technolog_mode: "percent" | "per_sheet";
  technolog_pct: string;
  technolog_per_sheet: string;
  waste_edge_pct: string;
  risk_reserve_pct: string;
}

export function ParametersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [form, setForm] = useState<FormState>({
    target_margin_pct: "18",
    price_rounding: "1000",
    assembly_mode: "percent",
    assembly_pct: "14,5",
    assembly_per_meter_kitchen: "35000",
    assembly_per_meter_wardrobe: "25000",
    technolog_mode: "percent",
    technolog_pct: "4",
    technolog_per_sheet: "4000",
    waste_edge_pct: "10",
    risk_reserve_pct: "0",
  });

  async function loadParameters() {
    try {
      if (isDemoModeActive()) {
        const state = loadDemoState();
        const map = state.parameters;
        setForm({
          target_margin_pct: formatPercentInput(map.target_margin_pct),
          price_rounding: String(map.price_rounding),
          assembly_mode: map.assembly_mode,
          assembly_pct: formatPercentInput(map.assembly_pct),
          assembly_per_meter_kitchen: String(map.assembly_per_meter_kitchen),
          assembly_per_meter_wardrobe: String(map.assembly_per_meter_wardrobe),
          technolog_mode: map.technolog_mode,
          technolog_pct: formatPercentInput(map.technolog_pct),
          technolog_per_sheet: String(map.technolog_per_sheet),
          waste_edge_pct: formatPercentInput(map.waste_edge_pct),
          risk_reserve_pct: formatPercentInput(map.risk_reserve_pct),
        });
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase.from("parameters").select("*");

      if (fetchErr) {
        setError(formatErrorMessage(fetchErr, "Не удалось загрузить параметры."));
      } else if (data) {
        const rows = data as ParameterItem[];
        const map = parametersArrayToMap(rows);
        setForm({
          target_margin_pct: formatPercentInput(map.target_margin_pct),
          price_rounding: String(map.price_rounding),
          assembly_mode: map.assembly_mode,
          assembly_pct: formatPercentInput(map.assembly_pct),
          assembly_per_meter_kitchen: String(map.assembly_per_meter_kitchen),
          assembly_per_meter_wardrobe: String(map.assembly_per_meter_wardrobe),
          technolog_mode: map.technolog_mode,
          technolog_pct: formatPercentInput(map.technolog_pct),
          technolog_per_sheet: String(map.technolog_per_sheet),
          waste_edge_pct: formatPercentInput(map.waste_edge_pct),
          risk_reserve_pct: formatPercentInput(map.risk_reserve_pct),
        });
      }
    } catch (err: unknown) {
      setError(formatErrorMessage(err, "Не удалось загрузить параметры."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadParameters();
  }, []);

  const currentMap: ParametersMap = {
    target_margin_pct: parsePercent(form.target_margin_pct) ?? 0,
    price_rounding: parsePrice(form.price_rounding) ?? 0,
    assembly_mode: form.assembly_mode,
    assembly_pct: parsePercent(form.assembly_pct) ?? 0,
    assembly_per_meter_kitchen: parsePrice(form.assembly_per_meter_kitchen) ?? 0,
    assembly_per_meter_wardrobe: parsePrice(form.assembly_per_meter_wardrobe) ?? 0,
    technolog_mode: form.technolog_mode,
    technolog_pct: parsePercent(form.technolog_pct) ?? 0,
    technolog_per_sheet: parsePrice(form.technolog_per_sheet) ?? 0,
    waste_edge_pct: parsePercent(form.waste_edge_pct) ?? 0,
    risk_reserve_pct: parsePercent(form.risk_reserve_pct) ?? 0,
  };

  const denomEval = evaluateDenominator(currentMap);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    if (denomEval.status === "error") {
      setError(
        denomEval.message ||
          "Критическая ошибка: сумма процентных ставок и маржи ≥ 100% (знаменатель ≤ 0). Сохранение невозможно."
      );
      setSaving(false);
      return;
    }

    const targetMargin = parsePercent(form.target_margin_pct);
    if (targetMargin === null) {
      setError("Некорректное значение целевой маржи.");
      setSaving(false);
      return;
    }

    const assemblyPct = parsePercent(form.assembly_pct);
    if (assemblyPct === null) {
      setError("Некорректный процент сборки.");
      setSaving(false);
      return;
    }

    const technologPct = parsePercent(form.technolog_pct);
    if (technologPct === null) {
      setError("Некорректный процент технолога.");
      setSaving(false);
      return;
    }

    const wasteEdge = parsePercent(form.waste_edge_pct);
    if (wasteEdge === null) {
      setError("Некорректный процент отхода кромки.");
      setSaving(false);
      return;
    }

    const riskReserve = parsePercent(form.risk_reserve_pct);
    if (riskReserve === null) {
      setError("Некорректный резерв на риск.");
      setSaving(false);
      return;
    }

    const priceRounding = parsePrice(form.price_rounding);
    if (priceRounding === null || priceRounding <= 0) {
      setError("Округление цены должно быть положительным числом.");
      setSaving(false);
      return;
    }

    const assemblyKitchen = parsePrice(form.assembly_per_meter_kitchen);
    const assemblyWardrobe = parsePrice(form.assembly_per_meter_wardrobe);
    const technologSheet = parsePrice(form.technolog_per_sheet);

    if (assemblyKitchen === null || assemblyWardrobe === null || technologSheet === null) {
      setError("Денежные ставки должны быть целыми неотрицательными числами.");
      setSaving(false);
      return;
    }

    try {
      if (isDemoModeActive()) {
        const newMap: ParametersMap = {
          target_margin_pct: targetMargin,
          price_rounding: priceRounding,
          assembly_mode: form.assembly_mode,
          assembly_pct: assemblyPct,
          assembly_per_meter_kitchen: assemblyKitchen,
          assembly_per_meter_wardrobe: assemblyWardrobe,
          technolog_mode: form.technolog_mode,
          technolog_pct: technologPct,
          technolog_per_sheet: technologSheet,
          waste_edge_pct: wasteEdge,
          risk_reserve_pct: riskReserve,
        };
        demoSaveParameters(newMap);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
        return;
      }

      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("save_parameters", {
        p_params: {
          target_margin_pct: targetMargin,
          price_rounding: priceRounding,
          assembly_mode: form.assembly_mode,
          assembly_pct: assemblyPct,
          assembly_per_meter_kitchen: assemblyKitchen,
          assembly_per_meter_wardrobe: assemblyWardrobe,
          technolog_mode: form.technolog_mode,
          technolog_pct: technologPct,
          technolog_per_sheet: technologSheet,
          waste_edge_pct: wasteEdge,
          risk_reserve_pct: riskReserve,
        },
      });

      if (rpcErr) {
        throw new Error(formatErrorMessage(rpcErr, "Не удалось сохранить параметры."));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, "Не удалось сохранить параметры."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[680px] flex-col px-5 pt-6 pb-24 text-zinc-100 select-none">
      {/* Заголовок */}
      <div className="flex items-end justify-between pb-6 border-b border-white/[0.07]">
        <div>
          <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-500 block mb-1">
            Глобальные нормативы
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Параметры расчёта
          </h1>
        </div>

        <button
          type="submit"
          form="parameters-form"
          disabled={saving || loading || denomEval.status === "error"}
          className="h-9 px-4 rounded-lg bg-white text-black font-semibold text-[13px] hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>

      {loading && (
        <div className="py-16 text-center text-[13px] text-zinc-500">
          Загрузка параметров…
        </div>
      )}

      {error && (
        <div className="my-4 border-l-2 border-rose-500 bg-rose-500/5 pl-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="my-4 border-l-2 border-emerald-500 bg-emerald-500/5 pl-4 py-3 text-xs font-medium text-emerald-300">
          Параметры сохранены и применены к расчётам.
        </div>
      )}

      {!loading && (
        <form
          id="parameters-form"
          onSubmit={handleSave}
          className="divide-y divide-white/[0.07] border-b border-white/[0.07]"
        >
          {/* Контроль знаменателя формулы */}
          <div className="py-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block">
                  Контроль формулы расчёта цены
                </span>
                <div className="mt-1 flex items-baseline gap-2.5">
                  <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
                    {(denomEval.denominator * 100).toFixed(1).replace(".", ",")}%
                  </span>
                  <span className="text-xs text-zinc-500">знаменатель</span>
                </div>
              </div>

              <span
                className={`text-xs font-medium ${
                  denomEval.status === "error"
                    ? "text-rose-400"
                    : denomEval.status === "warning"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {denomEval.status === "error"
                  ? "Критическая ошибка"
                  : denomEval.status === "warning"
                  ? "Предупреждение (≤ 5%)"
                  : "Формула сбалансирована"}
              </span>
            </div>

            {denomEval.message && (
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                {denomEval.message}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/[0.05] text-xs">
              <div>
                <span className="text-zinc-500 block">Целевая маржа</span>
                <span className="font-medium text-zinc-200 tabular-nums mt-0.5 block">
                  {formatPercent(currentMap.target_margin_pct)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Сборка</span>
                <span className="font-medium text-zinc-200 tabular-nums mt-0.5 block">
                  {currentMap.assembly_mode === "percent"
                    ? formatPercent(currentMap.assembly_pct)
                    : "за пог. м"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Технолог</span>
                <span className="font-medium text-zinc-200 tabular-nums mt-0.5 block">
                  {currentMap.technolog_mode === "percent"
                    ? formatPercent(currentMap.technolog_pct)
                    : "за лист"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Резерв риска</span>
                <span className="font-medium text-zinc-200 tabular-nums mt-0.5 block">
                  {formatPercent(currentMap.risk_reserve_pct)}
                </span>
              </div>
            </div>
          </div>

          {/* Секция 1: Целевая маржа и округление */}
          <section className="py-6">
            <div className="mb-4">
              <h2 className="text-[15px] font-medium text-white">
                {PARAMETER_GROUPS.margin_rounding.title}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {PARAMETER_GROUPS.margin_rounding.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  {PARAMETER_DEFINITIONS.target_margin_pct.name}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.target_margin_pct}
                    onChange={(e) => setForm({ ...form, target_margin_pct: e.target.value })}
                    placeholder="18"
                    className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-8 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  {PARAMETER_DEFINITIONS.price_rounding.name}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.price_rounding}
                    onChange={(e) => setForm({ ...form, price_rounding: e.target.value })}
                    placeholder="1000"
                    className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-8 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    ₸
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Секция 2: Сборка */}
          <section className="py-6">
            <div className="mb-4">
              <h2 className="text-[15px] font-medium text-white">
                {PARAMETER_GROUPS.assembly.title}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {PARAMETER_GROUPS.assembly.description}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {PARAMETER_DEFINITIONS.assembly_mode.name}
                </label>
                <div className="grid grid-cols-2 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, assembly_mode: "percent" })}
                    className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      form.assembly_mode === "percent"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Процент от цены (% договора)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, assembly_mode: "per_meter" })}
                    className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      form.assembly_mode === "per_meter"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    За погонный метр
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={form.assembly_mode === "percent" ? "opacity-100" : "opacity-40"}>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    {PARAMETER_DEFINITIONS.assembly_pct.name}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.assembly_pct}
                      onChange={(e) => setForm({ ...form, assembly_pct: e.target.value })}
                      placeholder="14,5"
                      className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-8 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                      %
                    </span>
                  </div>
                </div>

                <div className={form.assembly_mode === "per_meter" ? "opacity-100" : "opacity-40"}>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    {PARAMETER_DEFINITIONS.assembly_per_meter_kitchen.name}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.assembly_per_meter_kitchen}
                      onChange={(e) =>
                        setForm({ ...form, assembly_per_meter_kitchen: e.target.value })
                      }
                      placeholder="35000"
                      className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-14 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
                      ₸/м
                    </span>
                  </div>
                </div>

                <div className={form.assembly_mode === "per_meter" ? "opacity-100" : "opacity-40"}>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    {PARAMETER_DEFINITIONS.assembly_per_meter_wardrobe.name}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.assembly_per_meter_wardrobe}
                      onChange={(e) =>
                        setForm({ ...form, assembly_per_meter_wardrobe: e.target.value })
                      }
                      placeholder="25000"
                      className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-14 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
                      ₸/м
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Секция 3: Технолог */}
          <section className="py-6">
            <div className="mb-4">
              <h2 className="text-[15px] font-medium text-white">
                {PARAMETER_GROUPS.technolog.title}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {PARAMETER_GROUPS.technolog.description}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {PARAMETER_DEFINITIONS.technolog_mode.name}
                </label>
                <div className="grid grid-cols-2 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, technolog_mode: "percent" })}
                    className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      form.technolog_mode === "percent"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Процент от цены (% договора)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, technolog_mode: "per_sheet" })}
                    className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      form.technolog_mode === "per_sheet"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    За лист ЛДСП
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={form.technolog_mode === "percent" ? "opacity-100" : "opacity-40"}>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    {PARAMETER_DEFINITIONS.technolog_pct.name}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.technolog_pct}
                      onChange={(e) => setForm({ ...form, technolog_pct: e.target.value })}
                      placeholder="4"
                      className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-8 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                      %
                    </span>
                  </div>
                </div>

                <div className={form.technolog_mode === "per_sheet" ? "opacity-100" : "opacity-40"}>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    {PARAMETER_DEFINITIONS.technolog_per_sheet.name}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.technolog_per_sheet}
                      onChange={(e) => setForm({ ...form, technolog_per_sheet: e.target.value })}
                      placeholder="4000"
                      className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-14 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
                      ₸/лист
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Секция 4: Отходы и риски */}
          <section className="py-6">
            <div className="mb-4">
              <h2 className="text-[15px] font-medium text-white">
                {PARAMETER_GROUPS.waste_risk.title}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {PARAMETER_GROUPS.waste_risk.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  {PARAMETER_DEFINITIONS.waste_edge_pct.name}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.waste_edge_pct}
                    onChange={(e) => setForm({ ...form, waste_edge_pct: e.target.value })}
                    placeholder="10"
                    className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-8 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  {PARAMETER_DEFINITIONS.risk_reserve_pct.name}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.risk_reserve_pct}
                    onChange={(e) => setForm({ ...form, risk_reserve_pct: e.target.value })}
                    placeholder="0"
                    className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.09] px-3 pr-8 text-[14px] text-white tabular-nums focus:outline-hidden focus:border-white/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    %
                  </span>
                </div>
              </div>
            </div>
          </section>
        </form>
      )}
    </main>
  );
}
