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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900">Изменение заказа</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {headerError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {headerError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Название заказа <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Клиент / метка
            </label>
            <input
              type="text"
              value={headerClient}
              onChange={(e) => setHeaderClient(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Статус заказа
            </label>
            <select
              value={headerStatus}
              onChange={(e) => setHeaderStatus(e.target.value as OrderStatus)}
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
            >
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {ORDER_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Цена по договору (₸)
            </label>
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              value={headerContractPrice}
              onChange={(e) => setHeaderContractPrice(formatCurrencyInput(e.target.value))}
              placeholder="850 000"
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm font-semibold text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Заметка
            </label>
            <textarea
              rows={2}
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={headerSaving}
              className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={headerSaving}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {headerSaving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
