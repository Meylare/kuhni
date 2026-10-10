import { formatKzt } from "../../../lib/money";

export interface PriceDiffLine {
  lineId: string;
  name: string;
  qty: number;
  oldUnitPrice: number;
  newUnitPrice: number;
  diff: number;
}

export interface PriceDiffData {
  lines: PriceDiffLine[];
  totalDiff: number;
}

interface PriceDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceDiff: PriceDiffData;
  isUpdating: boolean;
  onConfirm: () => Promise<void> | void;
}

export function PriceDiffModal({
  isOpen,
  onClose,
  priceDiff,
  isUpdating,
  onConfirm,
}: PriceDiffModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900">Обновление цен из справочника</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-xs text-stone-600 leading-relaxed">
          В актуальном справочнике цен изменились цены для {priceDiff.lines.length} поз. из этого заказа.
          Ознакомьтесь с изменениями перед подтверждением:
        </p>

        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 divide-y divide-stone-200 text-xs">
          {priceDiff.lines.map((item) => (
            <div key={item.lineId} className="p-3">
              <div className="font-bold text-stone-900">{item.name}</div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-stone-600">
                <span>
                  {item.qty} шт: {formatKzt(item.oldUnitPrice)} ₸ ➔{" "}
                  <strong className="text-emerald-900">{formatKzt(item.newUnitPrice)} ₸</strong>
                </span>
                <span className={item.diff > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                  {item.diff > 0 ? "+" : ""}
                  {formatKzt(item.diff)} ₸
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Сводка разницы */}
        <div className="mt-3 rounded-xl border border-stone-200 bg-stone-100 p-3 text-xs flex justify-between items-center">
          <span className="font-medium text-stone-700">Разница общей стоимости:</span>
          <span
            className={`text-sm font-extrabold ${
              priceDiff.totalDiff > 0 ? "text-rose-800" : "text-emerald-800"
            }`}
          >
            {priceDiff.totalDiff > 0 ? "+" : ""}
            {formatKzt(priceDiff.totalDiff)} ₸
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void onConfirm()}
            className="min-h-11 rounded-xl bg-amber-800 px-5 text-sm font-semibold text-white shadow-xs hover:bg-amber-900 disabled:opacity-50"
          >
            {isUpdating ? "Обновление…" : "Подтвердить обновление цен"}
          </button>
        </div>
      </div>
    </div>
  );
}
