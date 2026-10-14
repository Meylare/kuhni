import { type FormEvent } from "react";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  ORDER_ITEM_KIND_LABELS,
  PRICE_UNITS,
  type BillableQtyRounding,
  type OrderItem,
  type OrderLine,
  type PriceCategory,
  type PriceUnit,
} from "../../../types/database";

interface ManualLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLine: OrderLine | null;
  manualCategory: PriceCategory;
  setManualCategory: (cat: PriceCategory) => void;
  manualName: string;
  setManualName: (name: string) => void;
  manualUnit: PriceUnit;
  setManualUnit: (unit: PriceUnit) => void;
  manualUnitPrice: string;
  setManualUnitPrice: (price: string) => void;
  manualQty: string;
  setManualQty: (qty: string) => void;
  manualWaste: string;
  setManualWaste: (waste: string) => void;
  manualTechnolog: boolean;
  setManualTechnolog: (tech: boolean) => void;
  manualRounding: BillableQtyRounding;
  setManualRounding: (rnd: BillableQtyRounding) => void;
  items: OrderItem[];
  manualItemId: string;
  setManualItemId: (id: string) => void;
  manualComment: string;
  setManualComment: (comment: string) => void;
  manualError: string | null;
  manualSaving: boolean;
  onSave: (e: FormEvent) => void;
}

export function ManualLineModal({
  isOpen,
  onClose,
  editingLine,
  manualCategory,
  setManualCategory,
  manualName,
  setManualName,
  manualUnit,
  setManualUnit,
  manualUnitPrice,
  setManualUnitPrice,
  manualQty,
  setManualQty,
  manualWaste,
  setManualWaste,
  manualTechnolog,
  setManualTechnolog,
  manualRounding,
  setManualRounding,
  items,
  manualItemId,
  setManualItemId,
  manualComment,
  setManualComment,
  manualError,
  manualSaving,
  onSave,
}: ManualLineModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">
            {editingLine
              ? editingLine.is_manual
                ? "Редактировать ручную позицию"
                : "Редактировать позицию из каталога"
              : "Добавить ручную позицию"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {manualError && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {manualError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3.5 text-xs">
          {(!editingLine || editingLine.is_manual) && (
            <>
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Категория <span className="text-rose-400">*</span>
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as PriceCategory)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Название <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Например: Доставка (ГАЗель) или спецраспил"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">
                    Единица измерения
                  </label>
                  <select
                    value={manualUnit}
                    onChange={(e) => setManualUnit(e.target.value as PriceUnit)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
                  >
                    {PRICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">
                    Цена за ед. (₸) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={manualUnitPrice}
                    onChange={(e) => setManualUnitPrice(e.target.value)}
                    placeholder="20 000"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white font-mono focus:outline-hidden focus:border-white/20"
                  />
                </div>
              </div>
            </>
          )}

          {/* Количество и отход */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Количество <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white font-mono focus:outline-hidden focus:border-white/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Отход (%)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={manualWaste}
                onChange={(e) => setManualWaste(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
              />
            </div>
          </div>

          {/* Чекбоксы: технолог и округление */}
          {(!editingLine || editingLine.is_manual) && (
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2.5 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualTechnolog}
                  onChange={(e) => setManualTechnolog(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                />
                <span>Учитывать для технолога (как лист ЛДСП)</span>
              </label>

              <label className="flex items-center gap-2.5 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualRounding === "ceil_to_unit"}
                  onChange={(e) =>
                    setManualRounding(e.target.checked ? "ceil_to_unit" : "none")
                  }
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                />
                <span>Округлять оплачиваемое количество вверх до целого</span>
              </label>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Привязать к изделию
              </label>
              <select
                value={manualItemId}
                onChange={(e) => setManualItemId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white/20"
              >
                <option value="">Без привязки (общий заказ)</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title} ({ORDER_ITEM_KIND_LABELS[i.kind]})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Комментарий
            </label>
            <input
              type="text"
              value={manualComment}
              onChange={(e) => setManualComment(e.target.value)}
              placeholder="Примечание к позиции…"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={manualSaving}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={manualSaving}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {manualSaving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
