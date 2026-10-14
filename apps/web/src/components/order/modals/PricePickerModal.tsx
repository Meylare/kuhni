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

  // Автофокус на поле поиска при открытии модального окна
  useEffect(() => {
    if (isOpen && !selectedPriceItem) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, selectedPriceItem]);

  if (!isOpen) return null;

  function getExistingLine(priceItemId: string): OrderLine | undefined {
    return lines.find(
      (l) =>
        l.price_item_id === priceItemId &&
        (l.order_item_id || "") === (pickerItemId || "")
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="flex h-[92vh] sm:h-[85vh] w-full sm:max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#141418] p-5 sm:p-6 shadow-2xl overflow-hidden text-zinc-100 animate-in zoom-in-95 duration-150">
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] shrink-0">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
              CATALOG PICKER
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              Справочник цен
            </h3>
            <p className="text-xs text-zinc-400">
              {addedItemsCount > 0
                ? `В текущем сеансе добавлено: ${addedItemsCount}`
                : "Нажмите «+» для добавления в заказ"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {pickerError && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 shrink-0">
            {pickerError}
          </div>
        )}

        {/* Выбор целевого изделия */}
        {items.length > 0 && !selectedPriceItem && (
          <div className="mt-3 shrink-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Куда добавлять позиции:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPickerItemId(it.id)}
                  className={`rounded-full px-3.5 py-1.5 font-medium transition-all shrink-0 cursor-pointer ${
                    pickerItemId === it.id
                      ? "bg-zinc-800 text-white shadow-xs font-semibold border border-white/20"
                      : "bg-[#121215] border border-white/[0.08] text-zinc-400 hover:text-white"
                  }`}
                >
                  {it.title} ({ORDER_ITEM_KIND_LABELS[it.kind]})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickerItemId("")}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-all shrink-0 cursor-pointer ${
                  pickerItemId === ""
                    ? "bg-zinc-800 text-white shadow-xs font-semibold border border-white/20"
                    : "bg-[#121215] border border-white/[0.08] text-zinc-400 hover:text-white"
                }`}
              >
                Общий заказ
              </button>
            </div>
          </div>
        )}

        {!selectedPriceItem ? (
          // Шаг 1: Каталог со степперами
          <div className="mt-3 flex flex-1 flex-col overflow-hidden">
            {/* Поле поиска */}
            <div className="relative shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Поиск по названию (Egger, петли, профиль...)"
                className="w-full rounded-full bg-zinc-950 border border-zinc-800 px-4 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20 transition-all"
              />
              {pickerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer"
                  title="Очистить"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Блок «Частые позиции» */}
            {!pickerSearch && recentPriceItems.length > 0 && (
              <div className="mt-3 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Частые позиции:
                </span>
                <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {recentPriceItems.map((p) => {
                    const existing = getExistingLine(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onStepPriceItem(p, 1, pickerItemId)}
                        className="flex items-center gap-1.5 rounded-full bg-[#121215] border border-white/[0.08] px-3 py-1.5 text-zinc-300 hover:border-white/20 hover:text-white shrink-0 transition-colors cursor-pointer"
                        title={`Добавить ${p.name}`}
                      >
                        <span className="font-medium truncate max-w-[130px]">{p.name}</span>
                        <span className="rounded-full bg-white/[0.1] px-1.5 py-0.5 text-[10px] font-bold text-white font-mono">
                          {existing ? `${existing.qty} +1` : "+1"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Фильтр по категориям */}
            <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-1 text-xs shrink-0 no-scrollbar">
              <button
                type="button"
                onClick={() => setPickerCategory("all")}
                className={`rounded-full px-3 py-1 font-medium whitespace-nowrap cursor-pointer transition-all ${
                  pickerCategory === "all"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Все
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPickerCategory(cat)}
                  className={`rounded-full px-3 py-1 font-medium whitespace-nowrap cursor-pointer transition-all ${
                    pickerCategory === cat
                      ? "bg-zinc-800 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Список позиций каталога */}
            <div className="mt-3 flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  Позиций не найдено
                </div>
              ) : (
                filteredCatalogItems.map((p) => {
                  const existingLine = getExistingLine(p.id);

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#121215] border border-white/[0.05] hover:border-white/[0.15] transition-all gap-2"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-medium text-white text-xs leading-tight truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {CATEGORY_LABELS[p.category]} • {p.unit}
                        </div>
                        <div className="font-bold text-emerald-400 text-xs mt-0.5 font-mono">
                          {formatKzt(p.price)} ₸ / {p.unit}
                        </div>
                      </div>

                      {/* Правая часть: степпер или кнопка добавления */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {existingLine ? (
                          <div className="flex items-center rounded-lg bg-zinc-950 border border-zinc-800 p-0.5">
                            <button
                              type="button"
                              onClick={() => onStepPriceItem(p, -1, pickerItemId)}
                              className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 cursor-pointer font-bold"
                              title="Уменьшить"
                            >
                              −
                            </button>
                            <span className="min-w-10 text-center text-xs font-mono font-bold text-white px-1">
                              {existingLine.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onStepPriceItem(p, 1, pickerItemId)}
                              className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 cursor-pointer font-bold"
                              title="Увеличить"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStepPriceItem(p, 1, pickerItemId)}
                            className="rounded-full bg-white text-black font-semibold px-3 py-1 text-xs hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer shadow-xs"
                          >
                            + 1
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectPriceItem(p)}
                          className="h-7 w-7 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 text-xs cursor-pointer"
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

            {/* Закреплённая кнопка «Готово» внизу */}
            <div className="pt-3 border-t border-white/[0.06] shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-white text-black font-semibold py-2.5 text-xs hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer shadow-md"
              >
                {addedItemsCount > 0
                  ? `Готово (добавлено ${addedItemsCount})`
                  : "Готово"}
              </button>
            </div>
          </div>
        ) : (
          // Шаг 2: Детальная форма с отходом и комментарием
          <form onSubmit={onAdd} className="mt-4 flex flex-1 flex-col justify-between overflow-y-auto text-xs">
            <div className="flex flex-col gap-3.5">
              <div className="rounded-2xl bg-zinc-950/60 p-4 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white text-xs">
                      {selectedPriceItem.name}
                    </span>
                    <span className="block text-zinc-500 text-[11px] mt-0.5">
                      {CATEGORY_LABELS[selectedPriceItem.category]} • {selectedPriceItem.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPriceItem(null)}
                    className="text-xs text-emerald-400 font-semibold underline px-2 cursor-pointer"
                  >
                    Сменить
                  </button>
                </div>
                <div className="mt-2 font-bold text-sm text-white font-mono">
                  {formatKzt(selectedPriceItem.price)} ₸ / {selectedPriceItem.unit}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">
                    Количество ({selectedPriceItem.unit}) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={pickerQty}
                    onChange={(e) => setPickerQty(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">
                    Отход (%)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pickerWaste}
                    onChange={(e) => setPickerWaste(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
                  />
                </div>
              </div>

              {items.length > 0 && (
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">
                    Привязать к изделию
                  </label>
                  <select
                    value={pickerItemId}
                    onChange={(e) => setPickerItemId(e.target.value)}
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
                  Комментарий (необязательно)
                </label>
                <input
                  type="text"
                  value={pickerComment}
                  onChange={(e) => setPickerComment(e.target.value)}
                  placeholder="Например: на верхние шкафы"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setSelectedPriceItem(null)}
                className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Назад к списку
              </button>
              <button
                type="submit"
                disabled={pickerSaving}
                className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
              >
                {pickerSaving
                  ? "Сохранение…"
                  : (selectedPriceItem && getExistingLine(selectedPriceItem.id))
                  ? "Сохранить изменения"
                  : "Добавить в заказ"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
