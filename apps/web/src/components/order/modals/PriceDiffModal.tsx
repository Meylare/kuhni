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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">Обновление цен из каталога</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
          В каталоге изменились цены для {priceDiff.lines.length} поз. из этого заказа.
          Ознакомьтесь с изменениями перед подтверждением:
        </p>

        <div className="mt-3.5 max-h-56 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 divide-y divide-zinc-900 text-xs">
          {priceDiff.lines.map((item) => (
            <div key={item.lineId} className="p-3">
              <div className="font-semibold text-zinc-200">{item.name}</div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-400">
                <span>
                  {item.qty} шт: {formatKzt(item.oldUnitPrice)} ₸ ➔{" "}
                  <strong className="text-white font-mono">{formatKzt(item.newUnitPrice)} ₸</strong>
                </span>
                <span className={`font-mono font-bold ${item.diff > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {item.diff > 0 ? "+" : ""}
                  {formatKzt(item.diff)} ₸
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Сводка разницы */}
        <div className="mt-3 rounded-2xl border border-zinc-800 bg-[#121215] p-3 text-xs flex justify-between items-center">
          <span className="font-medium text-zinc-400">Разница общей стоимости:</span>
          <span
            className={`text-sm font-bold font-mono ${
              priceDiff.totalDiff > 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {priceDiff.totalDiff > 0 ? "+" : ""}
            {formatKzt(priceDiff.totalDiff)} ₸
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void onConfirm()}
            className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
          >
            {isUpdating ? "Обновление…" : "Подтвердить обновление"}
          </button>
        </div>
      </div>
    </div>
  );
}
