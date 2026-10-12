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
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-xs font-bold text-stone-800 gap-2 flex-wrap"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span>⚙️ Дополнительно (параметры)</span>
          {isCustomized ? (
            <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-semibold border border-amber-300">
              изменены{customMargin ? `: маржа ${customMargin}%` : ""}
            </span>
          ) : (
            <span className="rounded-md bg-stone-100 text-stone-600 px-2 py-0.5 text-[11px] font-normal">
              используются общие параметры
            </span>
          )}
        </div>
        <span>{isOpen ? "▲ Скрыть" : "▼ Настроить"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Целевая маржа (по умолч. {formatPercent(globalParams.target_margin_pct)})
              </label>
              <input
                type="text"
                placeholder="28%"
                value={customMargin}
                onChange={(e) => setCustomMargin(e.target.value)}
                disabled={locked}
                className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
              />
              {!locked && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCustomMargin("20")}
                    className="rounded-lg bg-stone-100 hover:bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700 cursor-pointer"
                  >
                    20% Эконом
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMargin("28")}
                    className="rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                  >
                    28% Стандарт
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMargin("35")}
                    className="rounded-lg bg-stone-100 hover:bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700 cursor-pointer"
                  >
                    35% Премиум
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
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
                className="min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 focus:border-emerald-800"
              >
                <option value="default">
                  По умолчанию ({globalParams.assembly_mode === "percent" ? "Процент" : "За метр"})
                </option>
                <option value="percent">Процент от цены</option>
                <option value="per_meter">За погонный метр</option>
              </select>
            </div>

            {isPerMeter ? (
              <div className="sm:col-span-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-col gap-3">
                {itemsWithMeters.length > 0 ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-900">
                    <p className="font-semibold">ℹ️ Метраж берётся из изделий заказа</p>
                    <p className="mt-0.5 text-stone-600">
                      Всего в карточках изделий: <span className="font-bold">{totalItemsMeters.toFixed(2)} м</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Погонные метры изделия (м)
                        </label>
                        <input
                          type="text"
                          placeholder="Например, 3.0"
                          value={customLinearMeters}
                          onChange={(e) => setCustomLinearMeters?.(e.target.value)}
                          disabled={locked}
                          className="min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 focus:border-emerald-800"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Тип изделия для сборки
                        </label>
                        <select
                          value={customOrderKind}
                          onChange={(e) =>
                            setCustomOrderKind?.(e.target.value as "kitchen" | "wardrobe")
                          }
                          disabled={locked}
                          className="min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 focus:border-emerald-800"
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
                          <p className="text-amber-800 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium">
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
                        <div className="flex items-center justify-between text-xs text-stone-700 bg-white border border-stone-200 rounded-lg px-3 py-2">
                          <span>
                            Расчёт сборки: <strong>{parsedMeters} м</strong> × {formatKzt(rate)} ₸
                          </span>
                          <span className="font-bold text-emerald-800">
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
                <label className="block font-semibold text-stone-700 mb-1">
                  Сборка, % (по умолч. {formatPercent(globalParams.assembly_pct)})
                </label>
                <input
                  type="text"
                  placeholder="14,5%"
                  value={customAssemblyPct}
                  onChange={(e) => setCustomAssemblyPct(e.target.value)}
                  disabled={locked}
                  className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Технолог, % (по умолч. {formatPercent(globalParams.technolog_pct)})
              </label>
              <input
                type="text"
                placeholder="4%"
                value={customTechnologPct}
                onChange={(e) => setCustomTechnologPct(e.target.value)}
                disabled={locked}
                className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
              />
            </div>
          </div>

          {!locked && (
            <button
              type="button"
              disabled={paramsSaving}
              onClick={onSaveOrderSettings}
              className="self-end min-h-10 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {paramsSaving ? "Сохранение…" : "Применить параметры к заказу"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
