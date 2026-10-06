import { useEffect, useState } from "react";

import { formatErrorMessage } from "../lib/errors";
import {
  DEFAULT_PARAMETERS,
  evaluateDenominator,
  formatPercent,
  PARAMETER_DEFINITIONS,
  PARAMETER_GROUPS,
  parametersArrayToMap,
  parsePercent,
  type ParametersMap,
} from "../lib/parameters";
import { parsePrice } from "../lib/price-items";
import { getSupabase } from "../lib/supabase";
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

  // Загрузка параметров из базы
  async function loadParameters() {
    try {
      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase.from("parameters").select("*");

      if (fetchErr) {
        setError(formatErrorMessage(fetchErr, "Не удалось загрузить параметры."));
      } else if (data) {
        const rows = data as ParameterItem[];
        const map = parametersArrayToMap(rows);
        setForm({
          target_margin_pct: (map.target_margin_pct * 100).toString().replace(".", ","),
          price_rounding: String(map.price_rounding),
          assembly_mode: map.assembly_mode,
          assembly_pct: (map.assembly_pct * 100).toString().replace(".", ","),
          assembly_per_meter_kitchen: String(map.assembly_per_meter_kitchen),
          assembly_per_meter_wardrobe: String(map.assembly_per_meter_wardrobe),
          technolog_mode: map.technolog_mode,
          technolog_pct: (map.technolog_pct * 100).toString().replace(".", ","),
          technolog_per_sheet: String(map.technolog_per_sheet),
          waste_edge_pct: (map.waste_edge_pct * 100).toString().replace(".", ","),
          risk_reserve_pct: (map.risk_reserve_pct * 100).toString().replace(".", ","),
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

  // Вычисляем текущую карту параметров для живого расчёта знаменателя
  const currentMap: ParametersMap = {
    target_margin_pct: parsePercent(form.target_margin_pct) ?? DEFAULT_PARAMETERS.target_margin_pct,
    price_rounding: parsePrice(form.price_rounding) ?? DEFAULT_PARAMETERS.price_rounding,
    assembly_mode: form.assembly_mode,
    assembly_pct: parsePercent(form.assembly_pct) ?? DEFAULT_PARAMETERS.assembly_pct,
    assembly_per_meter_kitchen:
      parsePrice(form.assembly_per_meter_kitchen) ?? DEFAULT_PARAMETERS.assembly_per_meter_kitchen,
    assembly_per_meter_wardrobe:
      parsePrice(form.assembly_per_meter_wardrobe) ?? DEFAULT_PARAMETERS.assembly_per_meter_wardrobe,
    technolog_mode: form.technolog_mode,
    technolog_pct: parsePercent(form.technolog_pct) ?? DEFAULT_PARAMETERS.technolog_pct,
    technolog_per_sheet:
      parsePrice(form.technolog_per_sheet) ?? DEFAULT_PARAMETERS.technolog_per_sheet,
    waste_edge_pct: parsePercent(form.waste_edge_pct) ?? DEFAULT_PARAMETERS.waste_edge_pct,
    risk_reserve_pct: parsePercent(form.risk_reserve_pct) ?? DEFAULT_PARAMETERS.risk_reserve_pct,
  };

  const denomEval = evaluateDenominator(currentMap);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    // Валидация полей
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

    const updates = [
      { key: "target_margin_pct", value_num: targetMargin, value_text: null },
      { key: "assembly_mode", value_num: null, value_text: form.assembly_mode },
      { key: "assembly_pct", value_num: assemblyPct, value_text: null },
      { key: "assembly_per_meter_kitchen", value_num: assemblyKitchen, value_text: null },
      { key: "assembly_per_meter_wardrobe", value_num: assemblyWardrobe, value_text: null },
      { key: "technolog_mode", value_num: null, value_text: form.technolog_mode },
      { key: "technolog_pct", value_num: technologPct, value_text: null },
      { key: "technolog_per_sheet", value_num: technologSheet, value_text: null },
      { key: "waste_edge_pct", value_num: wasteEdge, value_text: null },
      { key: "risk_reserve_pct", value_num: riskReserve, value_text: null },
      { key: "price_rounding", value_num: priceRounding, value_text: null },
    ];

    try {
      const supabase = getSupabase();
      for (const row of updates) {
        const { error: upsertErr } = await supabase
          .from("parameters")
          .update({
            value_num: row.value_num,
            value_text: row.value_text,
            updated_at: new Date().toISOString(),
          })
          .eq("key", row.key);

        if (upsertErr) {
          throw new Error(`Ошибка сохранения параметра ${row.key}: ${formatErrorMessage(upsertErr)}`);
        }
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
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 pb-24 md:pb-12">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Параметры расчёта</h1>
          <p className="text-xs text-stone-500 mt-1">
            Глобальные коэффициенты маржи, сборки, технолога и отходов для калькулятора
          </p>
        </div>

        <button
          type="submit"
          form="parameters-form"
          disabled={saving || loading}
          className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-6 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 active:scale-98 transition-all disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить параметры"}
        </button>
      </div>

      {loading && (
        <div className="mt-12 text-center text-sm text-stone-500">Загрузка параметров…</div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs md:text-sm text-red-800">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs md:text-sm font-medium text-emerald-900">
          ✓ Параметры успешно сохранены и обновлены в базе данных!
        </div>
      )}

      {!loading && (
        <form id="parameters-form" onSubmit={handleSave} className="mt-6 flex flex-col gap-6">
          {/* Индикатор знаменателя формулы расчёта (согласно ТЗ 4.6) */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs ${
              denomEval.status === "error"
                ? "border-red-300 bg-red-50 text-red-950"
                : denomEval.status === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-stone-200 bg-white text-stone-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Контроль формулы расчёта цены
                </span>
                <h3 className="mt-0.5 text-base sm:text-lg font-bold">
                  Знаменатель: {(denomEval.denominator * 100).toFixed(1).replace(".", ",")}%
                </h3>
              </div>

              <div
                className={`rounded-xl px-3 py-1 text-xs font-bold ${
                  denomEval.status === "error"
                    ? "bg-red-200 text-red-900"
                    : denomEval.status === "warning"
                      ? "bg-amber-200 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {denomEval.status === "error"
                  ? "Критическая ошибка"
                  : denomEval.status === "warning"
                    ? "Предупреждение (≤ 5%)"
                    : "Норма"}
              </div>
            </div>

            {denomEval.message && (
              <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed">
                {denomEval.message}
              </p>
            )}

            {/* Сводка долей */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-stone-200/60 text-xs">
              <div>
                <span className="text-stone-500 block">Маржа:</span>
                <span className="font-semibold">{formatPercent(currentMap.target_margin_pct)}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Сборка:</span>
                <span className="font-semibold">
                  {currentMap.assembly_mode === "percent"
                    ? formatPercent(currentMap.assembly_pct)
                    : "за пог. м"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Технолог:</span>
                <span className="font-semibold">
                  {currentMap.technolog_mode === "percent"
                    ? formatPercent(currentMap.technolog_pct)
                    : "за лист"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Резерв риска:</span>
                <span className="font-semibold">{formatPercent(currentMap.risk_reserve_pct)}</span>
              </div>
            </div>
          </div>

          {/* Секция 1: Целевая маржа и округление */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs">
            <header className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">
                {PARAMETER_GROUPS.margin_rounding.title}
              </h2>
              <p className="text-xs text-stone-500">
                {PARAMETER_GROUPS.margin_rounding.description}
              </p>
            </header>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* target_margin_pct */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800">
                    {PARAMETER_DEFINITIONS.target_margin_pct.name}
                  </label>
                  <code className="text-[10px] text-stone-400">target_margin_pct</code>
                </div>
                <div className="relative mt-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.target_margin_pct}
                    onChange={(e) => setForm({ ...form, target_margin_pct: e.target.value })}
                    placeholder="18"
                    className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-9 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    %
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  {PARAMETER_DEFINITIONS.target_margin_pct.description}
                </p>
              </div>

              {/* price_rounding */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800">
                    {PARAMETER_DEFINITIONS.price_rounding.name}
                  </label>
                  <code className="text-[10px] text-stone-400">price_rounding</code>
                </div>
                <div className="relative mt-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.price_rounding}
                    onChange={(e) => setForm({ ...form, price_rounding: e.target.value })}
                    placeholder="1000"
                    className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-9 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    ₸
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  {PARAMETER_DEFINITIONS.price_rounding.description}
                </p>
              </div>
            </div>
          </section>

          {/* Секция 2: Сборка */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs">
            <header className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">
                {PARAMETER_GROUPS.assembly.title}
              </h2>
              <p className="text-xs text-stone-500">{PARAMETER_GROUPS.assembly.description}</p>
            </header>

            <div className="mt-4 flex flex-col gap-4">
              {/* Режим сборки: переключатель */}
              <div>
                <label className="block text-xs font-semibold text-stone-800">
                  {PARAMETER_DEFINITIONS.assembly_mode.name}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, assembly_mode: "percent" })}
                    className={`min-h-11 rounded-xl px-4 text-xs font-semibold transition-all ${
                      form.assembly_mode === "percent"
                        ? "bg-emerald-900 text-white shadow-xs"
                        : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    Процент от цены (% договора)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, assembly_mode: "per_meter" })}
                    className={`min-h-11 rounded-xl px-4 text-xs font-semibold transition-all ${
                      form.assembly_mode === "per_meter"
                        ? "bg-emerald-900 text-white shadow-xs"
                        : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    За погонный метр изделия
                  </button>
                </div>
              </div>

              {/* Поля сборки в зависимости от режима */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* assembly_pct */}
                <div
                  className={`transition-opacity ${
                    form.assembly_mode === "percent" ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <label className="text-xs font-semibold text-stone-800 block">
                    {PARAMETER_DEFINITIONS.assembly_pct.name}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.assembly_pct}
                      onChange={(e) => setForm({ ...form, assembly_pct: e.target.value })}
                      placeholder="14,5"
                      className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-8 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      %
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Используется при процентном режиме.
                  </p>
                </div>

                {/* assembly_per_meter_kitchen */}
                <div
                  className={`transition-opacity ${
                    form.assembly_mode === "per_meter" ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <label className="text-xs font-semibold text-stone-800 block">
                    {PARAMETER_DEFINITIONS.assembly_per_meter_kitchen.name}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.assembly_per_meter_kitchen}
                      onChange={(e) =>
                        setForm({ ...form, assembly_per_meter_kitchen: e.target.value })
                      }
                      placeholder="35000"
                      className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-14 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">
                      ₸/пог.м
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">Ставка для кухни.</p>
                </div>

                {/* assembly_per_meter_wardrobe */}
                <div
                  className={`transition-opacity ${
                    form.assembly_mode === "per_meter" ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <label className="text-xs font-semibold text-stone-800 block">
                    {PARAMETER_DEFINITIONS.assembly_per_meter_wardrobe.name}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.assembly_per_meter_wardrobe}
                      onChange={(e) =>
                        setForm({ ...form, assembly_per_meter_wardrobe: e.target.value })
                      }
                      placeholder="25000"
                      className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-14 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">
                      ₸/пог.м
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">Ставка для шкафа.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Секция 3: Технолог */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs">
            <header className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">
                {PARAMETER_GROUPS.technolog.title}
              </h2>
              <p className="text-xs text-stone-500">{PARAMETER_GROUPS.technolog.description}</p>
            </header>

            <div className="mt-4 flex flex-col gap-4">
              {/* Режим технолога: переключатель */}
              <div>
                <label className="block text-xs font-semibold text-stone-800">
                  {PARAMETER_DEFINITIONS.technolog_mode.name}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, technolog_mode: "percent" })}
                    className={`min-h-11 rounded-xl px-4 text-xs font-semibold transition-all ${
                      form.technolog_mode === "percent"
                        ? "bg-emerald-900 text-white shadow-xs"
                        : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    Процент от цены (% договора)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, technolog_mode: "per_sheet" })}
                    className={`min-h-11 rounded-xl px-4 text-xs font-semibold transition-all ${
                      form.technolog_mode === "per_sheet"
                        ? "bg-emerald-900 text-white shadow-xs"
                        : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    За лист ЛДСП в проекте
                  </button>
                </div>
              </div>

              {/* Поля технолога */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* technolog_pct */}
                <div
                  className={`transition-opacity ${
                    form.technolog_mode === "percent" ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <label className="text-xs font-semibold text-stone-800 block">
                    {PARAMETER_DEFINITIONS.technolog_pct.name}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.technolog_pct}
                      onChange={(e) => setForm({ ...form, technolog_pct: e.target.value })}
                      placeholder="4"
                      className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-8 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      %
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Используется при процентном режиме.
                  </p>
                </div>

                {/* technolog_per_sheet */}
                <div
                  className={`transition-opacity ${
                    form.technolog_mode === "per_sheet" ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <label className="text-xs font-semibold text-stone-800 block">
                    {PARAMETER_DEFINITIONS.technolog_per_sheet.name}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.technolog_per_sheet}
                      onChange={(e) => setForm({ ...form, technolog_per_sheet: e.target.value })}
                      placeholder="4000"
                      className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-14 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">
                      ₸/лист
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Считается по позициям с флагом «Для технолога».
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Секция 4: Отходы и риски */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs">
            <header className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">
                {PARAMETER_GROUPS.waste_risk.title}
              </h2>
              <p className="text-xs text-stone-500">{PARAMETER_GROUPS.waste_risk.description}</p>
            </header>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* waste_edge_pct */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800">
                    {PARAMETER_DEFINITIONS.waste_edge_pct.name}
                  </label>
                  <code className="text-[10px] text-stone-400">waste_edge_pct</code>
                </div>
                <div className="relative mt-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.waste_edge_pct}
                    onChange={(e) => setForm({ ...form, waste_edge_pct: e.target.value })}
                    placeholder="10"
                    className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-8 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    %
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  {PARAMETER_DEFINITIONS.waste_edge_pct.description}
                </p>
              </div>

              {/* risk_reserve_pct */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800">
                    {PARAMETER_DEFINITIONS.risk_reserve_pct.name}
                  </label>
                  <code className="text-[10px] text-stone-400">risk_reserve_pct</code>
                </div>
                <div className="relative mt-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.risk_reserve_pct}
                    onChange={(e) => setForm({ ...form, risk_reserve_pct: e.target.value })}
                    placeholder="0"
                    className="w-full min-h-11 rounded-xl border border-stone-300 px-3 pr-8 text-sm font-semibold text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    %
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  {PARAMETER_DEFINITIONS.risk_reserve_pct.description}
                </p>
              </div>
            </div>
          </section>

          {/* Кнопка сохранения внизу */}
          <div className="mt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving || loading}
              className="min-h-12 w-full sm:w-auto rounded-2xl bg-emerald-900 px-8 text-base font-semibold text-white shadow-md hover:bg-emerald-800 active:scale-98 transition-all disabled:opacity-50"
            >
              {saving ? "Сохранение параметров…" : "Сохранить параметры"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
