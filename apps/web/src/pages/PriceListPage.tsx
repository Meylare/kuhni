import { useEffect, useState } from "react";

import { formatErrorMessage } from "../lib/errors";
import { formatKzt } from "../lib/money";
import {
  filterPriceItems,
  parsePrice,
  validatePriceItem,
  type PriceItemInput,
} from "../lib/price-items";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  PRICE_UNITS,
  type BillableQtyRounding,
  type PriceCategory,
  type PriceItem,
  type PriceHistoryItem,
  type PriceUnit,
} from "../types/database";

export function PriceListPage() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PriceCategory | "all">("all");
  const [showArchived, setShowArchived] = useState(false);

  // Быстрое (инлайн) редактирование цены в списке
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Модальное окно просмотра / редактирования позиции
  const [selectedItem, setSelectedItem] = useState<PriceItem | null>(null);
  const [modalHistory, setModalHistory] = useState<PriceHistoryItem[]>([]);
  const [modalHistoryLoading, setModalHistoryLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Модальное окно добавления новой позиции
  const [isAddingNew, setIsAddingNew] = useState(false);

  async function loadItems() {
    try {
      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase
        .from("price_items")
        .select("*")
        .order("category")
        .order("name");

      if (fetchErr) {
        setError(formatErrorMessage(fetchErr, "Не удалось загрузить справочник цен."));
      } else {
        setItems((data as PriceItem[]) || []);
      }
    } catch (err: unknown) {
      setError(formatErrorMessage(err, "Не удалось загрузить справочник цен."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  // Загрузка истории цен при открытии карточки позиции
  async function loadItemHistory(itemId: string) {
    setModalHistoryLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error: histErr } = await supabase
        .from("price_history")
        .select("*")
        .eq("price_item_id", itemId)
        .order("changed_at", { ascending: false });

      if (histErr) {
        console.error("Ошибка загрузки истории цен:", histErr.message);
      } else {
        setModalHistory((data as PriceHistoryItem[]) || []);
      }
    } catch (err) {
      console.error("Ошибка загрузки истории цен:", err);
    } finally {
      setModalHistoryLoading(false);
    }
  }

  function handleOpenDetail(item: PriceItem) {
    setSelectedItem(item);
    setModalError(null);
    void loadItemHistory(item.id);
  }

  // Быстрое сохранение цены прямо в списке
  async function handleSaveInlinePrice(item: PriceItem) {
    const parsed = parsePrice(inlinePriceInput);
    if (parsed === null) {
      setInlineError("Введите целое неотрицательное число.");
      return;
    }

    if (parsed === item.price) {
      setInlineEditingId(null);
      setInlineError(null);
      return;
    }

    setInlineSaving(true);
    setInlineError(null);
    try {
      const supabase = getSupabase();
      const res = await supabase
        .from("price_items")
        .update({ price: parsed, updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .select();

      assertSingleRowAffected(res);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, price: parsed } : it)),
      );
      setInlineEditingId(null);
    } catch (err: unknown) {
      setInlineError(formatErrorMessage(err, "Не удалось обновить цену."));
    } finally {
      setInlineSaving(false);
    }
  }

  // Сохранение изменений из модального окна карточки позиции
  async function handleSaveDetailItem(updatedFields: Partial<PriceItem>) {
    if (!selectedItem) return;
    setModalSaving(true);
    setModalError(null);

    const merged: PriceItemInput = {
      name: updatedFields.name ?? selectedItem.name,
      category: updatedFields.category ?? selectedItem.category,
      unit: updatedFields.unit ?? selectedItem.unit,
      price: updatedFields.price ?? selectedItem.price,
      supplier: updatedFields.supplier !== undefined ? updatedFields.supplier : selectedItem.supplier,
      waste_applicable: updatedFields.waste_applicable ?? selectedItem.waste_applicable,
      waste_kind: updatedFields.waste_applicable ? "edge" : null,
      billable_qty_rounding: updatedFields.billable_qty_rounding ?? selectedItem.billable_qty_rounding,
      counts_for_technolog: updatedFields.counts_for_technolog ?? selectedItem.counts_for_technolog,
      note: updatedFields.note !== undefined ? updatedFields.note : selectedItem.note,
      active: updatedFields.active !== undefined ? updatedFields.active : selectedItem.active,
    };

    const validation = validatePriceItem(merged);
    if (!validation.isValid) {
      setModalError(validation.error ?? "Некорректные данные.");
      setModalSaving(false);
      return;
    }

    try {
      const supabase = getSupabase();
      const res = await supabase
        .from("price_items")
        .update({
          name: merged.name.trim(),
          category: merged.category,
          unit: merged.unit,
          price: merged.price,
          supplier: merged.supplier?.trim() || null,
          waste_applicable: merged.waste_applicable,
          waste_kind: merged.waste_kind,
          billable_qty_rounding: merged.billable_qty_rounding,
          counts_for_technolog: merged.counts_for_technolog,
          note: merged.note?.trim() || null,
          active: merged.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedItem.id)
        .select();

      const updatedItem = assertSingleRowAffected<PriceItem>(res);
      setSelectedItem(updatedItem);
      setItems((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
      void loadItemHistory(updatedItem.id);
    } catch (err: unknown) {
      setModalError(formatErrorMessage(err, "Не удалось сохранить изменения."));
    } finally {
      setModalSaving(false);
    }
  }

  // Архивирование / восстановление позиции
  async function handleToggleActive(item: PriceItem) {
    const nextActive = !item.active;
    try {
      const supabase = getSupabase();
      const res = await supabase
        .from("price_items")
        .update({ active: nextActive, updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .select();

      assertSingleRowAffected(res);
      const updated = { ...item, active: nextActive };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      if (selectedItem?.id === item.id) {
        setSelectedItem(updated);
      }
    } catch (err: unknown) {
      alert("Ошибка: " + formatErrorMessage(err));
    }
  }

  // Создание новой позиции
  async function handleCreateItem(newInput: PriceItemInput) {
    const validation = validatePriceItem(newInput);
    if (!validation.isValid) {
      return { ok: false, error: validation.error };
    }

    try {
      const supabase = getSupabase();
      const { data, error: insertErr } = await supabase
        .from("price_items")
        .insert({
          name: newInput.name.trim(),
          category: newInput.category,
          unit: newInput.unit,
          price: newInput.price,
          supplier: newInput.supplier?.trim() || null,
          waste_applicable: newInput.waste_applicable,
          waste_kind: newInput.waste_kind,
          billable_qty_rounding: newInput.billable_qty_rounding,
          counts_for_technolog: newInput.counts_for_technolog,
          note: newInput.note?.trim() || null,
          active: true,
        })
        .select()
        .single();

      if (insertErr) {
        return { ok: false, error: formatErrorMessage(insertErr, "Не удалось добавить позицию.") };
      }

      if (data) {
        setItems((prev) => [...prev, data as PriceItem]);
      }
      setIsAddingNew(false);
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: formatErrorMessage(err, "Не удалось добавить позицию."),
      };
    }
  }

  const filteredItems = filterPriceItems(items, searchQuery, selectedCategory, showArchived);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 pb-24 md:pb-12">
      {/* Заголовок страницы и кнопка добавления */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Справочник цен</h1>
          <p className="text-xs text-stone-500 mt-1">
            Прайс-лист материалов, работ цеха, фурнитуры и монтажа
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 active:scale-98 transition-all"
        >
          <span className="text-base font-bold">+</span>
          <span>Новая позиция</span>
        </button>
      </div>

      {/* Поиск и переключатели */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, поставщику, примечанию…"
            className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Фильтр по категориям (горизонтальный скролл на мобильном) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`min-h-9 shrink-0 rounded-lg px-3 py-1.5 transition-colors ${
              selectedCategory === "all"
                ? "bg-stone-900 text-white"
                : "bg-stone-200/80 text-stone-700 hover:bg-stone-300"
            }`}
          >
            Все ({items.length})
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const count = items.filter((it) => it.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-9 shrink-0 rounded-lg px-3 py-1.5 transition-colors ${
                  selectedCategory === cat
                    ? "bg-stone-900 text-white"
                    : "bg-stone-200/80 text-stone-700 hover:bg-stone-300"
                }`}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* Переключатель показа архивных позиций */}
        <div className="flex items-center justify-between text-xs text-stone-600 pt-1">
          <span>Найдено позиций: {filteredItems.length}</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
            />
            <span>Показать архивные</span>
          </label>
        </div>
      </div>

      {/* Ошибки или индикатор загрузки */}
      {loading && (
        <div className="mt-12 flex items-center justify-center text-sm text-stone-500">
          Загрузка справочника цен…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Ошибка: {error}
        </div>
      )}

      {/* Список позиций */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500">
          Позиции не найдены. Попробуйте изменить поисковый запрос или категорию.
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {filteredItems.map((item) => {
            const isEditing = inlineEditingId === item.id;

            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-white p-3.5 transition-all shadow-2xs ${
                  item.active
                    ? "border-stone-200/80 hover:border-stone-300"
                    : "border-stone-200 bg-stone-100/70 opacity-75"
                }`}
              >
                {/* Левая часть: название, категория, бейджи */}
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleOpenDetail(item)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900 text-sm md:text-base leading-snug">
                      {item.name}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    {!item.active && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Архив
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span>
                      Ед.: <strong className="font-medium text-stone-700">{item.unit}</strong>
                    </span>
                    {item.supplier && (
                      <span>
                        Поставщик:{" "}
                        <strong className="font-medium text-stone-700">{item.supplier}</strong>
                      </span>
                    )}
                    {item.waste_applicable && (
                      <span className="text-emerald-700 font-medium">Отход: кромка</span>
                    )}
                    {item.counts_for_technolog && (
                      <span className="text-blue-700 font-medium">Для технолога</span>
                    )}
                    {item.billable_qty_rounding === "ceil_to_unit" && (
                      <span className="text-stone-600">Окр. вверх</span>
                    )}
                  </div>
                </div>

                {/* Правая часть: цена и инлайн-редактирование */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inlinePriceInput}
                        onChange={(e) => setInlinePriceInput(e.target.value)}
                        placeholder="Цена"
                        className="w-28 min-h-11 rounded-xl border border-emerald-700 bg-white px-3 text-right text-sm font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveInlinePrice(item)}
                        disabled={inlineSaving}
                        className="min-h-11 min-w-11 rounded-xl bg-emerald-800 px-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        title="Сохранить цену"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInlineEditingId(null);
                          setInlineError(null);
                        }}
                        className="min-h-11 min-w-11 rounded-xl border border-stone-300 bg-stone-100 px-3 text-sm font-bold text-stone-600 hover:bg-stone-200 active:scale-95"
                        title="Отмена"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-base md:text-lg font-bold text-stone-900">
                          {formatKzt(item.price)} ₸
                        </span>
                        <span className="block text-[10px] text-stone-400">
                          за {item.unit}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setInlineEditingId(item.id);
                          setInlinePriceInput(String(item.price));
                          setInlineError(null);
                        }}
                        className="min-h-11 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700 hover:bg-stone-100 active:scale-95 transition-all"
                        title="Быстро изменить цену"
                      >
                        Изменить цену
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDetail(item)}
                        className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 hover:bg-stone-50 active:scale-95"
                        title="Подробнее"
                      >
                        ⋯
                      </button>
                    </div>
                  )}
                </div>

                {/* Ошибка инлайн-сохранения, если возникла */}
                {isEditing && inlineError && (
                  <div className="w-full text-xs text-red-600 font-medium">
                    {inlineError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно карточки позиции (детали, история, редактирование, архив) */}
      {selectedItem && (
        <PriceItemDetailModal
          item={selectedItem}
          history={modalHistory}
          historyLoading={modalHistoryLoading}
          saving={modalSaving}
          error={modalError}
          onClose={() => setSelectedItem(null)}
          onSave={handleSaveDetailItem}
          onToggleActive={handleToggleActive}
        />
      )}

      {/* Модальное окно создания новой позиции */}
      {isAddingNew && (
        <NewPriceItemModal
          onClose={() => setIsAddingNew(false)}
          onCreate={handleCreateItem}
        />
      )}
    </main>
  );
}

// ==========================================
// Модальное окно деталей и истории позиции
// ==========================================
interface DetailModalProps {
  item: PriceItem;
  history: PriceHistoryItem[];
  historyLoading: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (fields: Partial<PriceItem>) => Promise<void>;
  onToggleActive: (item: PriceItem) => Promise<void>;
}

function PriceItemDetailModal({
  item,
  history,
  historyLoading,
  saving,
  error,
  onClose,
  onSave,
  onToggleActive,
}: DetailModalProps) {
  const [tab, setTab] = useState<"edit" | "history">("edit");

  // Состояние полей редактирования
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<PriceCategory>(item.category);
  const [unit, setUnit] = useState<PriceUnit>(item.unit);
  const [price, setPrice] = useState(String(item.price));
  const [supplier, setSupplier] = useState(item.supplier ?? "");
  const [wasteApplicable, setWasteApplicable] = useState(item.waste_applicable);
  const [rounding, setRounding] = useState<BillableQtyRounding>(item.billable_qty_rounding);
  const [countsForTechnolog, setCountsForTechnolog] = useState(item.counts_for_technolog);
  const [note, setNote] = useState(item.note ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedPrice = parsePrice(price);
    await onSave({
      name,
      category,
      unit,
      price: parsedPrice ?? item.price,
      supplier: supplier.trim() || null,
      waste_applicable: wasteApplicable,
      waste_kind: wasteApplicable ? "edge" : null,
      billable_qty_rounding: rounding,
      counts_for_technolog: countsForTechnolog,
      note: note.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 leading-snug">
              {item.name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {CATEGORY_LABELS[item.category]}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  item.active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {item.active ? "Активна" : "В архиве"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Вкладки Редактирование / История цены */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`min-h-11 border-b-2 px-4 transition-colors ${
              tab === "edit"
                ? "border-emerald-800 text-emerald-900 font-semibold"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            Редактирование
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`min-h-11 border-b-2 px-4 transition-colors ${
              tab === "history"
                ? "border-emerald-800 text-emerald-900 font-semibold"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            История цены ({history.length})
          </button>
        </div>

        {/* Содержимое вкладки */}
        <div className="overflow-y-auto p-6 flex-1">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {tab === "edit" ? (
            <form id="price-item-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Название</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Категория</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PriceCategory)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Единица измерения</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as PriceUnit)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
                  >
                    {PRICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Цена в тенге (KZT)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm font-semibold focus:border-emerald-800 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Поставщик</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Например: Крона, Blum"
                    className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Чекбоксы правил */}
              <div className="space-y-3 rounded-2xl bg-stone-50 p-4 border border-stone-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wasteApplicable}
                    onChange={(e) => setWasteApplicable(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-stone-800">
                      Применять плановый отход кромки (waste_applicable)
                    </span>
                    <span className="block text-[11px] text-stone-500">
                      Автоматически добавляет процент отхода кромки из параметров.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={countsForTechnolog}
                    onChange={(e) => setCountsForTechnolog(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-stone-800">
                      Учитывать для технолога (Базис)
                    </span>
                    <span className="block text-[11px] text-stone-500">
                      Учитывается при расчёте оплаты технологу за листы ЛДСП.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-stone-800">
                    Округление оплачиваемого количества
                  </label>
                  <select
                    value={rounding}
                    onChange={(e) => setRounding(e.target.value as BillableQtyRounding)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-xs focus:border-emerald-800 focus:outline-hidden"
                  >
                    <option value="none">Без округления (none)</option>
                    <option value="ceil_to_unit">Округлять вверх до целого (ceil_to_unit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Примечание</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-xs focus:border-emerald-800 focus:outline-hidden"
                />
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {historyLoading && (
                <div className="py-6 text-center text-xs text-stone-500">
                  Загрузка истории изменений цены…
                </div>
              )}

              {!historyLoading && history.length === 0 && (
                <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                  История изменения цен пока пуста. При первом изменении цены здесь появится запись.
                </div>
              )}

              {!historyLoading &&
                history.map((record) => {
                  const dateStr = new Date(record.changed_at).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs"
                    >
                      <div>
                        <span className="block font-medium text-stone-800">{dateStr}</span>
                        <span className="text-[11px] text-stone-500">
                          {record.old_price !== null
                            ? `Старая: ${formatKzt(record.old_price)} ₸`
                            : "Первоначальное добавление"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-900">
                          {formatKzt(record.new_price)} ₸
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Подвал модалки с кнопками действий */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4">
          <button
            type="button"
            onClick={() => void onToggleActive(item)}
            className={`min-h-11 w-full sm:w-auto rounded-xl border px-4 text-xs font-semibold transition-colors ${
              item.active
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
            }`}
          >
            {item.active ? "Перенести в архив" : "Восстановить из архива"}
          </button>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 sm:flex-initial rounded-xl border border-stone-300 bg-white px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              Закрыть
            </button>
            {tab === "edit" && (
              <button
                type="submit"
                form="price-item-form"
                disabled={saving}
                className="min-h-11 flex-1 sm:flex-initial rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Модальное окно добавления новой позиции
// ==========================================
interface NewItemModalProps {
  onClose: () => void;
  onCreate: (input: PriceItemInput) => Promise<{ ok: boolean; error?: string }>;
}

function NewPriceItemModal({ onClose, onCreate }: NewItemModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PriceCategory>("materials");
  const [unit, setUnit] = useState<PriceUnit>("лист");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [wasteApplicable, setWasteApplicable] = useState(false);
  const [rounding, setRounding] = useState<BillableQtyRounding>("none");
  const [countsForTechnolog, setCountsForTechnolog] = useState(false);
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) {
      setError("Укажите корректную цену (целое число ≥ 0).");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await onCreate({
      name: name.trim(),
      category,
      unit,
      price: parsedPrice,
      supplier: supplier.trim() || null,
      waste_applicable: wasteApplicable,
      waste_kind: wasteApplicable ? "edge" : null,
      billable_qty_rounding: rounding,
      counts_for_technolog: countsForTechnolog,
      note: note.trim() || null,
    });

    if (!res.ok) {
      setError(res.error ?? "Не удалось создать позицию.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="text-lg font-bold text-stone-900 leading-snug">
            Новая позиция справочника
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-4 flex-1">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700">
              Название позиции *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: ЛДСП Дуб Галифакс"
              required
              className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700">Категория *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PriceCategory)}
                className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Единица *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as PriceUnit)}
                className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
              >
                {PRICE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Цена в KZT *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Например: 24000"
                required
                className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm font-semibold focus:border-emerald-800 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Поставщик</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Опционально"
                className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-800 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-stone-50 p-4 border border-stone-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wasteApplicable}
                onChange={(e) => setWasteApplicable(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
              />
              <div>
                <span className="block text-xs font-semibold text-stone-800">
                  Применять отход кромки (edge)
                </span>
                <span className="block text-[11px] text-stone-500">
                  Будет автоматически начисляться процент отхода из параметров.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={countsForTechnolog}
                onChange={(e) => setCountsForTechnolog(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
              />
              <div>
                <span className="block text-xs font-semibold text-stone-800">
                  Учитывать для технолога (Базис)
                </span>
                <span className="block text-[11px] text-stone-500">
                  Включается в подсчёт листов ЛДСП для оплаты технологу.
                </span>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold text-stone-800">
                Округление оплачиваемого количества
              </label>
              <select
                value={rounding}
                onChange={(e) => setRounding(e.target.value as BillableQtyRounding)}
                className="mt-1 w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-xs focus:border-emerald-800 focus:outline-hidden"
              >
                <option value="none">Без округления (none)</option>
                <option value="ceil_to_unit">Округлять вверх до целого (ceil_to_unit)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700">Примечание</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Дополнительные сведения…"
              className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-xs focus:border-emerald-800 focus:outline-hidden"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? "Добавление…" : "Добавить позицию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
