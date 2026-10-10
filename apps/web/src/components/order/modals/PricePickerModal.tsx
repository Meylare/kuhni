import { useEffect, useRef, type FormEvent } from "react";
import { formatKzt } from "../../../lib/money";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  ORDER_ITEM_KIND_LABELS,
  type OrderItem,
  type OrderLine,
  type PriceCategory,
  type PriceItem,
} from "../../../types/database";

export interface PricePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Поиск и фильтрация
  pickerSearch: string;
  setPickerSearch: (search: string) => void;
  pickerCategory: PriceCategory | "all";
  setPickerCategory: (cat: PriceCategory | "all") => void;
  filteredCatalogItems: PriceItem[];
  recentPriceItems: PriceItem[];
  // Строки заказа и изделия
  lines: OrderLine[];
  items: OrderItem[];
  pickerItemId: string;
  setPickerItemId: (id: string) => void;
  // Быстрый степпер и счётчик
  onStepPriceItem: (item: PriceItem, delta: number, targetItemId?: string | null) => void;
  addedItemsCount: number;
  // Детальная форма добавления (по кнопке ⋯)
  selectedPriceItem: PriceItem | null;
  setSelectedPriceItem: (item: PriceItem | null) => void;
  handleSelectPriceItem: (item: PriceItem) => void;
  pickerQty: string;
  setPickerQty: (qty: string) => void;
  pickerWaste: string;
  setPickerWaste: (waste: string) => void;
  pickerComment: string;
  setPickerComment: (comment: string) => void;
  pickerError: string | null;
  pickerSaving: boolean;
  onAdd: (e: FormEvent) => void;
}

export function PricePickerModal({
  isOpen,
  onClose,
  pickerSearch,
  setPickerSearch,
  pickerCategory,
  setPickerCategory,
  filteredCatalogItems,
  recentPriceItems,
  lines,
  items,
  pickerItemId,
  setPickerItemId,
  onStepPriceItem,
  addedItemsCount,
  selectedPriceItem,
  setSelectedPriceItem,
  handleSelectPriceItem,
  pickerQty,
  setPickerQty,
  pickerWaste,
  setPickerWaste,
  pickerComment,
  setPickerComment,
  pickerError,
  pickerSaving,
  onAdd,
}: PricePickerModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Автофокус на поле поиска при открытии модального окна (U1.5)
  useEffect(() => {
    if (isOpen && !selectedPriceItem) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, selectedPriceItem]);

  if (!isOpen) return null;

  // Поиск существующей позиции в текущем выбранном изделии
  function getExistingLine(priceItemId: string): OrderLine | undefined {
    return lines.find(
      (l) =>
        l.price_item_id === priceItemId &&
        (l.order_item_id || "") === (pickerItemId || "")
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="flex h-[92vh] sm:h-[85vh] w-full sm:max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 shadow-2xl overflow-hidden">
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Справочник цен
            </h3>
            <p className="text-xs text-stone-500">
              {addedItemsCount > 0
                ? `В текущем сеансе добавлено: ${addedItemsCount}`
                : "Нажмите «+» для добавления в заказ"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 text-lg"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {pickerError && (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 shrink-0">
            {pickerError}
          </div>
        )}

        {/* Выбор целевого изделия (U1.2: постоянно виден вверху) */}
        {items.length > 0 && !selectedPriceItem && (
          <div className="mt-3 shrink-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Куда добавлять позиции:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPickerItemId(it.id)}
                  className={`min-h-11 rounded-xl px-3.5 font-medium transition-all shrink-0 ${
                    pickerItemId === it.id
                      ? "bg-emerald-900 text-white shadow-xs font-semibold"
                      : "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {it.title} ({ORDER_ITEM_KIND_LABELS[it.kind]})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickerItemId("")}
                className={`min-h-11 rounded-xl px-3.5 font-medium transition-all shrink-0 ${
                  pickerItemId === ""
                    ? "bg-emerald-900 text-white shadow-xs font-semibold"
                    : "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                }`}
              >
                Общий заказ
              </button>
            </div>
          </div>
        )}

        {!selectedPriceItem ? (
          // Шаг 1: Каталог с быстрым поиском и степперами (U1.1)
          <div className="mt-2 flex flex-1 flex-col overflow-hidden">
            {/* Поле поиска с кнопкой очистки (U1.5) */}
            <div className="relative shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Поиск по названию…"
                className="min-h-11 w-full rounded-xl border border-stone-300 pr-10 pl-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
              {pickerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1.5 flex min-h-8 min-w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 text-sm"
                  title="Очистить"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Блок «Частые позиции» (U1.4) */}
            {!pickerSearch && recentPriceItems.length > 0 && (
              <div className="mt-2 shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Частые позиции:
                </span>
                <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {recentPriceItems.map((p) => {
                    const existing = getExistingLine(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onStepPriceItem(p, 1, pickerItemId)}
                        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 text-stone-800 hover:border-emerald-600 hover:bg-emerald-50 shrink-0 transition-colors"
                        title={`Добавить ${p.name}`}
                      >
                        <span className="font-medium truncate max-w-[140px]">{p.name}</span>
                        <span className="rounded-md bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-bold text-stone-700">
                          {existing ? `${existing.qty} +1` : "+1"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Фильтр по категориям */}
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setPickerCategory("all")}
                className={`min-h-11 whitespace-nowrap rounded-xl px-3 font-medium ${
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
                  className={`min-h-11 whitespace-nowrap rounded-xl px-3 font-medium ${
                    pickerCategory === cat
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Список позиций каталога со степперами (U1.1) */}
            <div className="mt-2 flex-1 overflow-y-auto divide-y divide-stone-100 pr-0.5">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  Позиций не найдено
                </div>
              ) : (
                filteredCatalogItems.map((p) => {
                  const existingLine = getExistingLine(p.id);

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-stone-50/80 rounded-xl transition-colors gap-2"
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="font-semibold text-stone-900 text-sm leading-tight">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {CATEGORY_LABELS[p.category]} • {p.unit}
                        </div>
                        <div className="font-bold text-emerald-900 text-xs mt-0.5">
                          {formatKzt(p.price)} ₸ / {p.unit}
                        </div>
                      </div>

                      {/* Правая часть: степпер или кнопка добавления (touch target >= 44x44) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {existingLine ? (
                          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-0.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => onStepPriceItem(p, -1, pickerItemId)}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stone-100 text-base font-bold text-stone-800 hover:bg-stone-200 active:scale-95"
                              title="Уменьшить"
                            >
                              −
                            </button>
                            <span className="min-w-12 text-center text-xs font-bold text-stone-900 px-1">
                              {existingLine.qty} {p.unit}
                            </span>
                            <button
                              type="button"
                              onClick={() => onStepPriceItem(p, 1, pickerItemId)}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-emerald-900 text-base font-bold text-white hover:bg-emerald-950 active:scale-95"
                              title="Увеличить"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStepPriceItem(p, 1, pickerItemId)}
                            className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-900 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-95"
                          >
                            <span>+ 1</span>
                          </button>
                        )}

                        {/* Кнопка ⋯ для детальной настройки (отход, коммент) */}
                        <button
                          type="button"
                          onClick={() => handleSelectPriceItem(p)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 text-stone-400 hover:text-stone-800 hover:bg-stone-50 text-sm"
                          title="Подробнее (отход, комментарий)"
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Закреплённая кнопка «Готово» внизу (U1.2, U1.4) */}
            <div className="pt-3 border-t border-stone-100 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-stone-900 text-sm font-bold text-white shadow-xs hover:bg-stone-800"
              >
                {addedItemsCount > 0
                  ? `Готово (добавлено ${addedItemsCount})`
                  : "Готово"}
              </button>
            </div>
          </div>
        ) : (
          // Шаг 2: Детальная форма с отходом и комментарием (по кнопке ⋯)
          <form onSubmit={onAdd} className="mt-4 flex flex-1 flex-col justify-between overflow-y-auto text-xs">
            <div className="flex flex-col gap-3">
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
                    className="min-h-11 text-xs text-emerald-900 font-semibold underline px-2"
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
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
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
