import { formatPercent, type ParametersMap } from "../../lib/parameters";

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
  customTechnologPct,
  setCustomTechnologPct,
  locked,
  paramsSaving,
  onSaveOrderSettings,
}: OrderParametersAccordionProps) {
  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-xs font-bold text-stone-800"
      >
        <span>⚙️ Индивидуальные параметры расчёта заказа</span>
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
                placeholder="18%"
                value={customMargin}
                onChange={(e) => setCustomMargin(e.target.value)}
                disabled={locked}
                className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
              />
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
