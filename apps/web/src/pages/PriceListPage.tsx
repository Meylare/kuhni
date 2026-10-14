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
import { demoSavePriceItem, isDemoModeActive, loadDemoState } from "../lib/demo-data";
import { useDialog } from "../components/DialogProvider";
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
  const dialog = useDialog();
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
      if (isDemoModeActive()) {
        const state = loadDemoState();
        setItems(state.priceItems || []);
        setLoading(false);
        return;
      }

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
      if (isDemoModeActive()) {
        const updatedItem = { ...item, price: parsed, updated_at: new Date().toISOString() };
        demoSavePriceItem(updatedItem);
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? updatedItem : it)),
        );
        setInlineEditingId(null);
        return;
      }

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
      if (isDemoModeActive()) {
        const updatedItem: PriceItem = {
          ...selectedItem,
          ...merged,
          name: merged.name.trim(),
          supplier: merged.supplier?.trim() || null,
          note: merged.note?.trim() || null,
          updated_at: new Date().toISOString(),
        };
        demoSavePriceItem(updatedItem);
        setSelectedItem(updatedItem);
        setItems((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
        return;
      }

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
      if (isDemoModeActive()) {
        const updated = { ...item, active: nextActive, updated_at: new Date().toISOString() };
        demoSavePriceItem(updated);
        setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
        if (selectedItem?.id === item.id) {
          setSelectedItem(updated);
        }
        return;
      }

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
      await dialog.alert({
        title: "Ошибка",
        message: formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  // Создание новой позиции
  async function handleCreateItem(newInput: PriceItemInput) {
    const validation = validatePriceItem(newInput);
    if (!validation.isValid) {
      return { ok: false, error: validation.error };
    }

    try {
      if (isDemoModeActive()) {
        const newItem: PriceItem = {
          id: `demo-price-${Date.now()}`,
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
          updated_at: new Date().toISOString(),
        };
        demoSavePriceItem(newItem);
        setItems((prev) => [...prev, newItem]);
        setIsAddingNew(false);
        return { ok: true };
      }

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
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 pb-32 text-zinc-100">
      {/* Заголовок страницы и кнопка добавления */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Каталог цен</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Материалы, работы цеха, фурнитура и сборка
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          className="rounded-full bg-white text-black font-semibold px-5 py-2.5 text-xs hover:bg-zinc-200 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          <span>Новая позиция</span>
        </button>
      </div>

      {/* Поиск и переключатели */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, поставщику, примечанию…"
            className="w-full rounded-full bg-[#121215] border border-white/[0.08] px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Фильтр по категориям */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-medium no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full px-3.5 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === "all"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-500 hover:text-zinc-300"
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
                className={`rounded-full px-3.5 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-zinc-800 text-white font-semibold shadow-xs"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* Переключатель показа архивных позиций */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
          <span>Найдено позиций: {filteredItems.length}</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
            />
            <span>Показать архивные</span>
          </label>
        </div>
      </div>

      {/* Ошибки или индикатор загрузки */}
      {loading && (
        <div className="mt-12 flex items-center justify-center text-xs text-zinc-500">
          Загрузка каталога…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          Ошибка: {error}
        </div>
      )}

      {/* Список позиций */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500">
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
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border p-4 transition-all shadow-md ${
                  item.active
                    ? "border-white/[0.07] bg-[#121215] hover:border-white/[0.18]"
                    : "border-zinc-800/60 bg-zinc-950/60 opacity-60"
                }`}
              >
                {/* Левая часть: название, категория, бейджи */}
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleOpenDetail(item)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white text-sm md:text-base leading-snug">
                      {item.name}
                    </span>
                    <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    {!item.active && (
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                        Архив
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>
                      Ед.: <strong className="font-medium text-zinc-300">{item.unit}</strong>
                    </span>
                    {item.supplier && (
                      <span>
                        Поставщик:{" "}
                        <strong className="font-medium text-zinc-300">{item.supplier}</strong>
                      </span>
                    )}
                    {item.waste_applicable && (
                      <span className="text-emerald-400 font-medium">Отход: кромка</span>
                    )}
                    {item.counts_for_technolog && (
                      <span className="text-indigo-400 font-medium">Для технолога</span>
                    )}
                    {item.billable_qty_rounding === "ceil_to_unit" && (
                      <span className="text-zinc-400">Окр. вверх</span>
                    )}
                  </div>
                </div>

                {/* Правая часть: цена и инлайн-редактирование */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inlinePriceInput}
                        onChange={(e) => setInlinePriceInput(e.target.value)}
                        placeholder="Цена"
                        className="w-28 min-h-10 rounded-xl border border-emerald-500 bg-zinc-950 px-3 text-right text-sm font-semibold text-white focus:outline-hidden"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveInlinePrice(item)}
                        disabled={inlineSaving}
                        className="min-h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
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
                        className="min-h-10 px-3 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
                        title="Отмена"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-base md:text-lg font-bold text-white tabular-nums">
                          {formatKzt(item.price)} ₸
                        </span>
                        <span className="block text-[10px] text-zinc-500 font-mono">
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
                        className="rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                        title="Быстро изменить цену"
                      >
                        Изменить
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDetail(item)}
                        className="h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
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
// Модальное окно деталей и истории позиции (Luxury Dark)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-[#141418] border border-white/10 shadow-2xl overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-white leading-snug">
              {item.name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                {CATEGORY_LABELS[item.category]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  item.active
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                }`}
              >
                {item.active ? "Активна" : "В архиве"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Вкладки Редактирование / История цены */}
        <div className="flex border-b border-white/[0.06] bg-[#121215] px-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              tab === "edit"
                ? "border-emerald-400 text-white font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Редактирование
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              tab === "history"
                ? "border-emerald-400 text-white font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            История цены ({history.length})
          </button>
        </div>

        {/* Содержимое вкладки */}
        <div className="overflow-y-auto p-6 flex-1 text-xs">
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {tab === "edit" ? (
            <form id="price-item-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Название</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Категория</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PriceCategory)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Единица измерения</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as PriceUnit)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
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
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Цена в тенге (KZT)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-hidden focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Поставщик</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Например: Крона, Blum"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
                  />
                </div>
              </div>

              {/* Чекбоксы правил */}
              <div className="space-y-3 rounded-2xl bg-zinc-950/60 p-4 border border-zinc-800/80">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wasteApplicable}
                    onChange={(e) => setWasteApplicable(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-200">
                      Применять плановый отход кромки (waste_applicable)
                    </span>
                    <span className="block text-[11px] text-zinc-500">
                      Автоматически добавляет процент отхода кромки из параметров.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={countsForTechnolog}
                    onChange={(e) => setCountsForTechnolog(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-200">
                      Учитывать для технолога (Базис)
                    </span>
                    <span className="block text-[11px] text-zinc-500">
                      Учитывается при расчёте оплаты технологу за листы ЛДСП.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Округление оплачиваемого количества
                  </label>
                  <select
                    value={rounding}
                    onChange={(e) => setRounding(e.target.value as BillableQtyRounding)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white/20"
                  >
                    <option value="none">Без округления (none)</option>
                    <option value="ceil_to_unit">Округлять вверх до целого (ceil_to_unit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Примечание</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
                />
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              {historyLoading && (
                <div className="py-6 text-center text-xs text-zinc-500">
                  Загрузка истории изменений цены…
                </div>
              )}

              {!historyLoading && history.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
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
                      className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs"
                    >
                      <div>
                        <span className="block font-medium text-zinc-200">{dateStr}</span>
                        <span className="text-[11px] text-zinc-500">
                          {record.old_price !== null
                            ? `Старая: ${formatKzt(record.old_price)} ₸`
                            : "Первоначальное добавление"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-white tabular-nums">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06] bg-[#121215] px-6 py-4">
          <button
            type="button"
            onClick={() => void onToggleActive(item)}
            className={`w-full sm:w-auto rounded-full border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              item.active
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            }`}
          >
            {item.active ? "В архив" : "Восстановить из архива"}
          </button>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Закрыть
            </button>
            {tab === "edit" && (
              <button
                type="submit"
                form="price-item-form"
                disabled={saving}
                className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
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
// Модальное окно добавления новой позиции (Luxury Dark)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-[#141418] border border-white/10 shadow-2xl overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-base font-bold text-white leading-snug">
            Новая позиция каталога
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-4 flex-1 text-xs">
          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Название позиции *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: ЛДСП Дуб Галифакс"
              required
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Категория *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PriceCategory)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Единица *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as PriceUnit)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
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
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Цена в KZT *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Например: 24000"
                required
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-hidden focus:border-white/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Поставщик</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Опционально"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-zinc-950/60 p-4 border border-zinc-800/80">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wasteApplicable}
                onChange={(e) => setWasteApplicable(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <div>
                <span className="block text-xs font-semibold text-zinc-200">
                  Применять отход кромки (edge)
                </span>
                <span className="block text-[11px] text-zinc-500">
                  Будет автоматически начисляться процент отхода из параметров.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={countsForTechnolog}
                onChange={(e) => setCountsForTechnolog(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <div>
                <span className="block text-xs font-semibold text-zinc-200">
                  Учитывать для технолога (Базис)
                </span>
                <span className="block text-[11px] text-zinc-500">
                  Включается в подсчёт листов ЛДСП для оплаты технологу.
                </span>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Округление оплачиваемого количества
              </label>
              <select
                value={rounding}
                onChange={(e) => setRounding(e.target.value as BillableQtyRounding)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white/20"
              >
                <option value="none">Без округления (none)</option>
                <option value="ceil_to_unit">Округлять вверх до целого (ceil_to_unit)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Примечание</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Дополнительные сведения…"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {saving ? "Добавление…" : "Добавить позицию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
