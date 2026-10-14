import { formatKzt } from "../../lib/money";
import { formatPercent, type ParametersMap } from "../../lib/parameters";
import type { OrderItem } from "../../types/database";

export interface OrderParametersAccordionProps {
  isOpen: boolean;
  setIsOpen: (fn: (prev: boolean) => boolean) => void;
  globalParams: ParametersMap;
  customMargin: string;
  setCustomMargin: (v: string) => void;
  customAssemblyMode: "default" | "percent" | "per_meter";
  setCustomAssemblyMode: (v: "default" | "percent" | "per_meter") => void;
  customAssemblyPct: string;
  setCustomAssemblyPct: (v: string) => void;
  customLinearMeters?: string;
  setCustomLinearMeters?: (v: string) => void;
  customOrderKind?: "kitchen" | "wardrobe";
  setCustomOrderKind?: (v: "kitchen" | "wardrobe") => void;
  items?: OrderItem[];
  customTechnologPct: string;
  setCustomTechnologPct: (v: string) => void;
  customRiskReservePct?: string;
  locked: boolean;
  paramsSaving: boolean;
  onSaveOrderSettings: () => void;
}

export function OrderParametersAccordion({
  isOpen,
  setIsOpen,
  globalParams,
  customMargin,
  setCustomMargin,
  customAssemblyMode,
  setCustomAssemblyMode,
  customAssemblyPct,
  setCustomAssemblyPct,
  customLinearMeters = "",
  setCustomLinearMeters,
  customOrderKind = "kitchen",
  setCustomOrderKind,
  items = [],
  customTechnologPct,
  setCustomTechnologPct,
  locked,
  paramsSaving,
  onSaveOrderSettings,
}: OrderParametersAccordionProps) {
  const isCustomized = Boolean(
    customMargin ||
    customAssemblyMode !== "default" ||
    customAssemblyPct ||
    customLinearMeters ||
    customTechnologPct
  );

  const isPerMeter =
    customAssemblyMode === "per_meter" ||
    (customAssemblyMode === "default" && globalParams.assembly_mode === "per_meter");

  const itemsWithMeters = (items || []).filter(
    (item) =>
      item.linear_meters !== null &&
      item.linear_meters !== undefined &&
      Number(item.linear_meters) > 0
  );
  const totalItemsMeters = itemsWithMeters.reduce(
    (sum, item) => sum + Number(item.linear_meters),
    0
  );

  return (
    <div className="mt-5 rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-lg text-zinc-100">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-zinc-300 gap-2 flex-wrap cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span>⚙️ Индивидуальные параметры сделки</span>
          {isCustomized ? (
            <span className="rounded-full bg-amber-500/15 text-amber-300 px-2.5 py-0.5 text-[11px] font-semibold border border-amber-500/30">
              изменены{customMargin ? `: маржа ${customMargin}%` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.06] text-zinc-400 px-2.5 py-0.5 text-[11px]">
              общие нормативы
            </span>
          )}
        </div>
        <span className="text-zinc-500">{isOpen ? "▲ Скрыть" : "▼ Настроить"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 flex flex-col gap-3.5 border-t border-white/[0.06] pt-4 animate-in fade-in duration-200">
          <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Целевая маржа (по умолч. {formatPercent(globalParams.target_margin_pct)})
              </label>
              <input
                type="text"
                placeholder="28%"
                value={customMargin}
                onChange={(e) => setCustomMargin(e.target.value)}
                disabled={locked}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20 font-mono"
              />
              {!locked && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCustomMargin("20")}
                    className="rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 cursor-pointer"
                  >
                    20% Эконом
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMargin("28")}
                    className="rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 px-2.5 py-1 text-[10px] font-semibold cursor-pointer"
                  >
                    28% Стандарт
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMargin("35")}
                    className="rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 cursor-pointer"
                  >
                    35% Премиум
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Режим сборки
              </label>
              <select
                value={customAssemblyMode}
                onChange={(e) =>
                  setCustomAssemblyMode(
                    e.target.value as "default" | "percent" | "per_meter"
                  )
                }
                disabled={locked}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
              >
                <option value="default">
                  По умолчанию ({globalParams.assembly_mode === "percent" ? "Процент" : "За метр"})
                </option>
                <option value="percent">Процент от цены</option>
                <option value="per_meter">За погонный метр</option>
              </select>
            </div>

            {isPerMeter ? (
              <div className="sm:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 flex flex-col gap-3">
                {itemsWithMeters.length > 0 ? (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-300">
                    <p className="font-semibold">ℹ️ Метраж берётся из изделий заказа</p>
                    <p className="mt-0.5 text-zinc-400">
                      Всего в карточках изделий: <span className="font-bold text-white font-mono">{totalItemsMeters.toFixed(2)} м</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block font-semibold text-zinc-300 mb-1">
                          Погонные метры (м)
                        </label>
                        <input
                          type="text"
                          placeholder="Например, 3.0"
                          value={customLinearMeters}
                          onChange={(e) => setCustomLinearMeters?.(e.target.value)}
                          disabled={locked}
                          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-white/20 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-300 mb-1">
                          Тип изделия для сборки
                        </label>
                        <select
                          value={customOrderKind}
                          onChange={(e) =>
                            setCustomOrderKind?.(e.target.value as "kitchen" | "wardrobe")
                          }
                          disabled={locked}
                          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white/20"
                        >
                          <option value="kitchen">
                            Кухня ({formatKzt(globalParams.assembly_per_meter_kitchen || 35000)} ₸/м)
                          </option>
                          <option value="wardrobe">
                            Шкаф ({formatKzt(globalParams.assembly_per_meter_wardrobe || 25000)} ₸/м)
                          </option>
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const parsedMeters = Number(customLinearMeters.replace(/,/g, ".").trim());
                      if (!Number.isFinite(parsedMeters) || parsedMeters <= 0) {
                        return (
                          <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 font-medium">
                            ⚠️ Укажите погонные метры, иначе сборка = 0 ₸
                          </p>
                        );
                      }
                      const rate =
                        customOrderKind === "wardrobe"
                          ? (globalParams.assembly_per_meter_wardrobe || 25000)
                          : (globalParams.assembly_per_meter_kitchen || 35000);
                      const estAssembly = Math.round(parsedMeters * rate);
                      return (
                        <div className="flex items-center justify-between text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                          <span>
                            Расчёт сборки: <strong>{parsedMeters} м</strong> × {formatKzt(rate)} ₸
                          </span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {formatKzt(estAssembly)} ₸
                          </span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Сборка, % (по умолч. {formatPercent(globalParams.assembly_pct)})
                </label>
                <input
                  type="text"
                  placeholder="14,5%"
                  value={customAssemblyPct}
                  onChange={(e) => setCustomAssemblyPct(e.target.value)}
                  disabled={locked}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20 font-mono"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Технолог, % (по умолч. {formatPercent(globalParams.technolog_pct)})
              </label>
              <input
                type="text"
                placeholder="4%"
                value={customTechnologPct}
                onChange={(e) => setCustomTechnologPct(e.target.value)}
                disabled={locked}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20 font-mono"
              />
            </div>
          </div>

          {!locked && (
            <button
              type="button"
              disabled={paramsSaving}
              onClick={onSaveOrderSettings}
              className="self-end rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {paramsSaving ? "Сохранение…" : "Применить параметры"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
