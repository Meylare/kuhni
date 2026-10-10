import { formatKzt } from "../../lib/money";
import type { PriceDiffData } from "./modals/PriceDiffModal";

interface CalcModeSwitchProps {
  calcMode: "quote" | "check_contract";
  onSelectCalcMode: (mode: "quote" | "check_contract") => void;
  contractPrice: number | null;
  priceDiff: PriceDiffData;
  isUpdatingPrices: boolean;
  locked: boolean;
  onOpenPriceDiffModal: () => void;
}

export function CalcModeSwitch({
  calcMode,
  onSelectCalcMode,
  contractPrice,
  priceDiff,
  isUpdatingPrices,
  locked,
  onOpenPriceDiffModal,
}: CalcModeSwitchProps) {
  return (
    <>
      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-semibold text-stone-700">Режим расчёта:</span>
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => onSelectCalcMode("quote")}
            className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-all ${
              calcMode === "quote"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Рассчитать цену (quote)
          </button>
          <button
            type="button"
            onClick={() => onSelectCalcMode("check_contract")}
            className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-all ${
              calcMode === "check_contract"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Проверить договор (check_contract)
          </button>
        </div>
      </div>

      {calcMode === "check_contract" && contractPrice === null && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠️ В режиме проверки договора требуется указать цену по договору. Нажмите «Изменить заказ» вверху и введите сумму.
        </div>
      )}

      {priceDiff.lines.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50/80 p-3 sm:flex-row sm:items-center sm:justify-between text-xs text-amber-900">
          <div>
            <strong>Внимание:</strong> в справочнике цен изменились цены для {priceDiff.lines.length} поз. из этого заказа.
          </div>
          {!locked && (
            <button
              type="button"
              disabled={isUpdatingPrices}
              onClick={onOpenPriceDiffModal}
              className="self-start whitespace-nowrap rounded-lg bg-amber-800 px-3 py-1.5 font-semibold text-white shadow-xs hover:bg-amber-900 disabled:opacity-50"
            >
              {isUpdatingPrices
                ? "Обновление…"
                : `Обновить цены (${priceDiff.totalDiff > 0 ? "+" : ""}${formatKzt(priceDiff.totalDiff)} ₸)`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
