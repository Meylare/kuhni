import { type FormEvent } from "react";
import {
  ORDER_ITEM_KINDS,
  ORDER_ITEM_KIND_LABELS,
  type OrderItem,
  type OrderItemKind,
} from "../../../types/database";

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: OrderItem | null;
  itemKind: OrderItemKind;
  setItemKind: (kind: OrderItemKind) => void;
  itemTitle: string;
  setItemTitle: (title: string) => void;
  itemMeters: string;
  setItemMeters: (meters: string) => void;
  itemDesc: string;
  setItemDesc: (desc: string) => void;
  itemError: string | null;
  itemSaving: boolean;
  onSave: (e: FormEvent) => void;
}

export function ItemModal({
  isOpen,
  onClose,
  editingItem,
  itemKind,
  setItemKind,
  itemTitle,
  setItemTitle,
  itemMeters,
  setItemMeters,
  itemDesc,
  setItemDesc,
  itemError,
  itemSaving,
  onSave,
}: ItemModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900">
            {editingItem ? "Редактировать изделие" : "Новое изделие"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {itemError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {itemError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-3 flex flex-col gap-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Тип изделия
            </label>
            <select
              value={itemKind}
              onChange={(e) => setItemKind(e.target.value as OrderItemKind)}
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
            >
              {ORDER_ITEM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ORDER_ITEM_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Название изделия <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="Например: Кухня угловая"
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          {itemKind !== "other" && (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Погонные метры (м)
              </label>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                value={itemMeters}
                onChange={(e) => setItemMeters(e.target.value)}
                placeholder="3.0"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Описание / габариты
            </label>
            <input
              type="text"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              placeholder="2400 × 600 × 850"
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={itemSaving}
              className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={itemSaving}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {itemSaving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
