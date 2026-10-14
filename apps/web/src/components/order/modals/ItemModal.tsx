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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">
            {editingItem ? "Редактировать изделие" : "Новое изделие"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {itemError && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {itemError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Тип изделия
            </label>
            <select
              value={itemKind}
              onChange={(e) => setItemKind(e.target.value as OrderItemKind)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
            >
              {ORDER_ITEM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ORDER_ITEM_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Название изделия <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="Например: Кухня угловая"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          {itemKind !== "other" && (
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Погонные метры (м)
              </label>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                value={itemMeters}
                onChange={(e) => setItemMeters(e.target.value)}
                placeholder="3.0"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20 font-mono"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Описание / габариты
            </label>
            <input
              type="text"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              placeholder="2400 × 600 × 850"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={itemSaving}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={itemSaving}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {itemSaving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
