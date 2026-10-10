import { type FormEvent } from "react";
import { formatKzt } from "../../../lib/money";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  ORDER_ITEM_KIND_LABELS,
  type OrderItem,
  type PriceCategory,
  type PriceItem,
} from "../../../types/database";

interface PricePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPriceItem: PriceItem | null;
  setSelectedPriceItem: (item: PriceItem | null) => void;
  pickerSearch: string;
  setPickerSearch: (search: string) => void;
  pickerCategory: PriceCategory | "all";
  setPickerCategory: (cat: PriceCategory | "all") => void;
  filteredCatalogItems: PriceItem[];
  handleSelectPriceItem: (item: PriceItem) => void;
  pickerQty: string;
  setPickerQty: (qty: string) => void;
  pickerWaste: string;
  setPickerWaste: (waste: string) => void;
  items: OrderItem[];
  pickerItemId: string;
  setPickerItemId: (id: string) => void;
  pickerComment: string;
  setPickerComment: (comment: string) => void;
  pickerError: string | null;
  pickerSaving: boolean;
  onAdd: (e: FormEvent) => void;
}

export function PricePickerModal({
  isOpen,
  onClose,
  selectedPriceItem,
  setSelectedPriceItem,
  pickerSearch,
  setPickerSearch,
  pickerCategory,
  setPickerCategory,
  filteredCatalogItems,
  handleSelectPriceItem,
  pickerQty,
  setPickerQty,
  pickerWaste,
  setPickerWaste,
  items,
  pickerItemId,
  setPickerItemId,
  pickerComment,
  setPickerComment,
  pickerError,
  pickerSaving,
  onAdd,
}: PricePickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="flex h-full w-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Выбор из справочника цен
            </h3>
            <p className="text-xs text-stone-500">
              {selectedPriceItem
                ? `Выбрано: ${selectedPriceItem.name}`
                : "Выберите позицию для добавления в заказ"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-2"
          >
            ✕
          </button>
        </div>

        {pickerError && (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {pickerError}
          </div>
        )}

        {!selectedPriceItem ? (
          // Шаг 1: Поиск и выбор позиции из прайса
          <div className="mt-3 flex flex-1 flex-col overflow-hidden">
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Поиск позиции по названию…"
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />

            {/* Категории */}
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setPickerCategory("all")}
                className={`min-h-8 whitespace-nowrap rounded-lg px-2.5 py-1 ${
                  pickerCategory === "all"
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                Все
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPickerCategory(cat)}
                  className={`min-h-8 whitespace-nowrap rounded-lg px-2.5 py-1 ${
                    pickerCategory === cat
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Список активных позиций */}
            <div className="mt-2 flex-1 overflow-y-auto divide-y divide-stone-100">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  Позиций не найдено
                </div>
              ) : (
                filteredCatalogItems.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPriceItem(p)}
                    className="flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-stone-50 rounded-xl transition-colors active:bg-emerald-50"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{p.name}</div>
                      <div className="text-[11px] text-stone-500">
                        {CATEGORY_LABELS[p.category]} • {p.unit}
                      </div>
                    </div>
                    <div className="font-bold text-emerald-900 text-sm">
                      {formatKzt(p.price)} ₸
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          // Шаг 2: Ввод количества и параметров для выбранной позиции
          <form onSubmit={onAdd} className="mt-4 flex flex-col gap-3 text-xs">
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-stone-900 text-sm">
                    {selectedPriceItem.name}
                  </span>
                  <span className="block text-stone-500 text-[11px]">
                    {CATEGORY_LABELS[selectedPriceItem.category]} • {selectedPriceItem.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPriceItem(null)}
                  className="text-xs text-emerald-900 font-semibold underline"
                >
                  Сменить
                </button>
              </div>
              <div className="mt-2 font-bold text-base text-stone-900">
                {formatKzt(selectedPriceItem.price)} ₸ / {selectedPriceItem.unit}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Количество ({selectedPriceItem.unit}) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={pickerQty}
                  onChange={(e) => setPickerQty(e.target.value)}
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
                  value={pickerWaste}
                  onChange={(e) => setPickerWaste(e.target.value)}
                  placeholder="0"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>
            </div>

            {items.length > 0 && (
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Привязать к изделию
                </label>
                <select
                  value={pickerItemId}
                  onChange={(e) => setPickerItemId(e.target.value)}
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
                Комментарий (необязательно)
              </label>
              <input
                type="text"
                value={pickerComment}
                onChange={(e) => setPickerComment(e.target.value)}
                placeholder="Например: на верхние шкафы"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPriceItem(null)}
                className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Назад к списку
              </button>
              <button
                type="submit"
                disabled={pickerSaving}
                className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
              >
                {pickerSaving ? "Добавление…" : "Добавить в заказ"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
