import { formatCurrencyInput } from "../../../lib/number-inputs";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "../../../types/database";

export interface OrderHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerName: string;
  setHeaderName: (v: string) => void;
  headerClient: string;
  setHeaderClient: (v: string) => void;
  headerStatus: OrderStatus;
  setHeaderStatus: (v: OrderStatus) => void;
  headerContractPrice: string;
  setHeaderContractPrice: (v: string) => void;
  headerNote: string;
  setHeaderNote: (v: string) => void;
  headerSaving: boolean;
  headerError: string | null;
  onSave: (e: React.FormEvent) => void;
}

export function OrderHeaderModal({
  isOpen,
  onClose,
  headerName,
  setHeaderName,
  headerClient,
  setHeaderClient,
  headerStatus,
  setHeaderStatus,
  headerContractPrice,
  setHeaderContractPrice,
  headerNote,
  setHeaderNote,
  headerSaving,
  headerError,
  onSave,
}: OrderHeaderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">Параметры проекта</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {headerError && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {headerError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Название проекта <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Клиент / ЖК / Телефон
            </label>
            <input
              type="text"
              value={headerClient}
              onChange={(e) => setHeaderClient(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Статус выполнения
            </label>
            <select
              value={headerStatus}
              onChange={(e) => setHeaderStatus(e.target.value as OrderStatus)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
            >
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {ORDER_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Цена договора (₸)
            </label>
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              value={headerContractPrice}
              onChange={(e) => setHeaderContractPrice(formatCurrencyInput(e.target.value))}
              placeholder="Оставьте пустым для авто-сметы"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs font-semibold text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Заметки по проекту
            </label>
            <textarea
              rows={2}
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={headerSaving}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={headerSaving}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {headerSaving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
