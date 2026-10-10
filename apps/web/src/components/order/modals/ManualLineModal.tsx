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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900">
            {editingLine
              ? editingLine.is_manual
                ? "Редактировать ручную позицию"
                : "Редактировать позицию из прайса"
              : "Добавить ручную позицию"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {manualError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {manualError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-3 flex flex-col gap-3 text-xs">
          {(!editingLine || editingLine.is_manual) && (
            <>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Категория <span className="text-rose-600">*</span>
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as PriceCategory)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Название <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Например: Транспорт (ГАЗель)"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Единица измерения
                  </label>
                  <select
                    value={manualUnit}
                    onChange={(e) => setManualUnit(e.target.value as PriceUnit)}
                    className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                  >
                    {PRICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Цена за ед. (₸) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={manualUnitPrice}
                    onChange={(e) => setManualUnitPrice(e.target.value)}
                    placeholder="20 000"
                    className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                  />
                </div>
              </div>
            </>
          )}

          {/* Количество и отход */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Количество <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Отход (%)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={manualWaste}
                onChange={(e) => setManualWaste(e.target.value)}
                placeholder="0"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>
          </div>

          {/* Чекбоксы: технолог и округление */}
          {(!editingLine || editingLine.is_manual) && (
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualTechnolog}
                  onChange={(e) => setManualTechnolog(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-stone-300 text-emerald-900 focus:ring-emerald-800"
                />
                <span>Учитывать для технолога (как лист ЛДСП)</span>
              </label>

              <label className="flex items-center gap-2 text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualRounding === "ceil_to_unit"}
                  onChange={(e) =>
                    setManualRounding(e.target.checked ? "ceil_to_unit" : "none")
                  }
                  className="h-4 w-4 rounded-sm border-stone-300 text-emerald-900 focus:ring-emerald-800"
                />
                <span>Округлять оплачиваемое количество вверх до целого</span>
              </label>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Привязать к изделию
              </label>
              <select
                value={manualItemId}
                onChange={(e) => setManualItemId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
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
            <label className="block font-semibold text-stone-700 mb-1">
              Комментарий
            </label>
            <input
              type="text"
              value={manualComment}
              onChange={(e) => setManualComment(e.target.value)}
              placeholder="Примечание к позиции…"
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={manualSaving}
              className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={manualSaving}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {manualSaving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
