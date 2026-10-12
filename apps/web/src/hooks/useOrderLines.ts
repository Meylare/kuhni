import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { formatErrorMessage } from "../lib/errors";
import {
  getRecentPriceItems,
  mergeOrAddPriceItem,
  roundQuantity,
  updateLineQuantity,
} from "../lib/order-lines-stepper";
import { computePriceUpdatesDiff } from "../lib/orders";
import { type ParametersMap } from "../lib/parameters";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  type Order,
  type OrderItem,
  type OrderLine,
  type PriceCategory,
  type PriceItem,
} from "../types/database";
import { useManualLine } from "./useManualLine";

interface UseOrderLinesProps {
  order: Order | null;
  items: OrderItem[];
  lines: OrderLine[];
  setLines: React.Dispatch<React.SetStateAction<OrderLine[]>>;
  priceItems: PriceItem[];
  globalParams: ParametersMap;
  locked: boolean;
}

export function useOrderLines({
  order,
  items,
  lines,
  setLines,
  priceItems,
  globalParams,
  locked,
}: UseOrderLinesProps) {
  const dialog = useDialog();

  // Делегируем модалку ручных строк в отдельный хук
  const manualLine = useManualLine({ order, items, setLines, locked });

  // Справочник цен и модалка добавления
  const [isPricePickerOpen, setIsPricePickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState<PriceCategory | "all">("all");
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItem | null>(null);
  const [pickerQty, setPickerQty] = useState("1");
  const [pickerWaste, setPickerWaste] = useState("");
  const [pickerItemId, setPickerItemId] = useState<string>("");
  const [pickerComment, setPickerComment] = useState("");
  const [pickerSaving, setPickerSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [addedItemsCount, setAddedItemsCount] = useState(0);

  // Модалка обновления цен из справочника
  const [isPriceDiffModalOpen, setIsPriceDiffModalOpen] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Словарь позиций цен по id
  const priceItemsById = useMemo(
    () => new Map(priceItems.map((p) => [p.id, p])),
    [priceItems]
  );

  // Разница цен со справочником
  const priceDiff = useMemo(
    () => computePriceUpdatesDiff(lines, priceItemsById),
    [lines, priceItemsById]
  );

  // Популярные / недавние позиции (8 шт)
  const recentPriceItems = useMemo(
    () => getRecentPriceItems(lines, priceItemsById, 8),
    [lines, priceItemsById]
  );

  // Фильтрация каталога по категории и строке поиска
  const filteredCatalogItems = useMemo(() => {
    return priceItems.filter((p) => {
      if (!p.active) return false;
      if (pickerCategory !== "all" && p.category !== pickerCategory) return false;
      if (pickerSearch.trim()) {
        const query = pickerSearch.trim().toLowerCase();
        return p.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [priceItems, pickerCategory, pickerSearch]);

  // Очередь дебаунса для сохранения изменений количества в БД (400 мс)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Очистка таймеров при размонтировании
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  function handleOpenPricePicker(defaultItemId?: string) {
    setSelectedPriceItem(null);
    setPickerQty("1");
    setPickerWaste("");
    setPickerItemId(
      defaultItemId ?? (items.length > 0 ? items[0].id : "")
    );
    setPickerComment("");
    setPickerError(null);
    setAddedItemsCount(0);
    setIsPricePickerOpen(true);
  }

  function handleSelectPriceItem(pi: PriceItem) {
    setSelectedPriceItem(pi);
    setPickerWaste(pi.waste_applicable ? String(globalParams.waste_edge_pct * 100) : "0");
  }

  /**
   * Синхронизация количества строки с БД после задержки дебаунса (400 мс).
   */
  async function syncLineToDatabase(line: OrderLine) {
    if (!order) return;
    try {
      if (line.id.startsWith("temp-")) {
        // Создание новой строки в БД
        const { data, error } = await getSupabase()
          .from("order_lines")
          .insert({
            order_id: order.id,
            order_item_id: line.order_item_id,
            price_item_id: line.price_item_id,
            category: line.category,
            name: line.name,
            unit: line.unit,
            qty: line.qty,
            unit_price: line.unit_price,
            waste_pct: line.waste_pct,
            billable_qty_rounding: line.billable_qty_rounding,
            counts_for_technolog: line.counts_for_technolog,
            is_manual: false,
            comment: line.comment,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          // Заменяем временный ID на постоянный ID из базы данных
          setLines((prev) =>
            prev.map((l) => (l.id === line.id ? (data as OrderLine) : l))
          );
        }
      } else {
        // Обновление существующей строки в БД
        const res = await getSupabase()
          .from("order_lines")
          .update({ qty: line.qty })
          .eq("id", line.id)
          .select();
        assertSingleRowAffected<OrderLine>(res);
      }
    } catch (err) {
      console.error("Ошибка сохранения позиции в БД:", err);
      await dialog.alert({
        title: "Ошибка сохранения",
        message: "Не удалось сохранить количество позиции: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  /**
   * Быстрое добавление/увеличение позиции из справочника со степпером (U1.1-U1.3).
   * Окно не закрывается, количество суммируется при повторном клике.
   */
  function handleStepPriceItem(
    priceItem: PriceItem,
    delta: number,
    targetItemId?: string | null
  ) {
    if (!order || locked) return;
    const destItemId = targetItemId !== undefined ? targetItemId : (pickerItemId || null);

    const result = mergeOrAddPriceItem(linesRef.current, {
      priceItem,
      orderItemId: destItemId,
      orderId: order.id,
      deltaQty: delta,
      globalParams,
    });

    if (result.action === "noop" || !result.affectedLine) return;

    setLines(result.lines);
    if (delta > 0) {
      setAddedItemsCount((prev) => prev + 1);
    }

    const lineKey = result.affectedLine.id;
    const existingTimer = debounceTimers.current.get(lineKey);
    if (existingTimer) clearTimeout(existingTimer);

    if (result.action === "deleted") {
      const timer = setTimeout(async () => {
        debounceTimers.current.delete(lineKey);
        if (!lineKey.startsWith("temp-")) {
          try {
            await getSupabase().from("order_lines").delete().eq("id", lineKey);
          } catch (err) {
            console.error("Ошибка удаления позиции:", err);
          }
        }
      }, 400);
      debounceTimers.current.set(lineKey, timer);
      return;
    }

    // Планируем отправку в БД с дебаунсом 400 мс
    const affected = result.affectedLine;
    const timer = setTimeout(() => {
      debounceTimers.current.delete(lineKey);
      void syncLineToDatabase(affected);
    }, 400);

    debounceTimers.current.set(lineKey, timer);
  }

  /**
   * Быстрый степпер для строки заказа в смете (LinesSection) или модалке (U1.1, U1.6).
   */
  function handleStepLineQty(lineId: string, delta: number) {
    if (locked) return;
    const targetLine = linesRef.current.find((l) => l.id === lineId);
    if (!targetLine) return;

    const newQty = roundQuantity(targetLine.qty + delta);
    handleSetLineQty(lineId, newQty);
  }

  /**
   * Прямое изменение количества строки (через ввод или степпер).
   */
  function handleSetLineQty(lineId: string, newQty: number) {
    if (locked) return;
    const result = updateLineQuantity(linesRef.current, lineId, newQty);
    setLines(result.lines);

    const existingTimer = debounceTimers.current.get(lineId);
    if (existingTimer) clearTimeout(existingTimer);

    if (result.action === "deleted") {
      // При достижении 0 удаляем строку из БД
      const timer = setTimeout(async () => {
        debounceTimers.current.delete(lineId);
        if (!lineId.startsWith("temp-")) {
          try {
            await getSupabase().from("order_lines").delete().eq("id", lineId);
          } catch (err) {
            console.error("Ошибка удаления строки:", err);
          }
        }
      }, 400);
      debounceTimers.current.set(lineId, timer);
    } else if (result.affectedLine) {
      const affected = result.affectedLine;
      const timer = setTimeout(() => {
        debounceTimers.current.delete(lineId);
        void syncLineToDatabase(affected);
      }, 400);
      debounceTimers.current.set(lineId, timer);
    }
  }

  /**
   * Полное добавление из детальной формы модалки (для особых случаев: отход, комментарий).
   */
  async function handleAddPriceItemToOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!order || !selectedPriceItem || locked) return;
    const qtyNum = Number(pickerQty.replace(/,/g, ".").trim());
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setPickerError("Количество должно быть больше 0.");
      return;
    }
    const wasteNum = pickerWaste.trim()
      ? Number(pickerWaste.replace(/,/g, ".").trim()) / 100
      : 0;

    try {
      setPickerSaving(true);
      setPickerError(null);
      const { data, error: insertErr } = await getSupabase()
        .from("order_lines")
        .insert({
          order_id: order.id,
          order_item_id: pickerItemId || null,
          price_item_id: selectedPriceItem.id,
          category: selectedPriceItem.category,
          name: selectedPriceItem.name,
          unit: selectedPriceItem.unit,
          qty: qtyNum,
          unit_price: selectedPriceItem.price,
          waste_pct: wasteNum,
          billable_qty_rounding: selectedPriceItem.billable_qty_rounding,
          counts_for_technolog: selectedPriceItem.counts_for_technolog,
          is_manual: false,
          comment: pickerComment.trim() || null,
        })
        .select()
        .single();

      if (insertErr) {
        setPickerError(formatErrorMessage(insertErr, "Ошибка добавления позиции."));
      } else if (data) {
        setLines((prev) => [...prev, data as OrderLine]);
        setAddedItemsCount((prev) => prev + 1);
        setSelectedPriceItem(null);
        setPickerComment("");
      }
    } catch (err: unknown) {
      setPickerError(formatErrorMessage(err, "Ошибка добавления позиции."));
    } finally {
      setPickerSaving(false);
    }
  }

  async function handleDuplicateLine(line: OrderLine) {
    if (locked || !order) return;
    try {
      const { data, error: insertErr } = await getSupabase()
        .from("order_lines")
        .insert({
          order_id: order.id,
          order_item_id: line.order_item_id,
          price_item_id: line.price_item_id,
          category: line.category,
          name: line.name,
          unit: line.unit,
          qty: line.qty,
          unit_price: line.unit_price,
          waste_pct: line.waste_pct,
          billable_qty_rounding: line.billable_qty_rounding,
          counts_for_technolog: line.counts_for_technolog,
          is_manual: line.is_manual,
          comment: line.comment,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      if (data) {
        setLines((prev) => [...prev, data as OrderLine]);
      }
    } catch (err) {
      console.error("Ошибка дублирования позиции:", err);
      await dialog.alert({
        title: "Ошибка",
        message: "Не удалось продублировать позицию: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleDeleteLine(lineId: string) {
    if (locked) return;
    const confirmed = await dialog.confirm({
      title: "Удаление позиции",
      message: "Удалить эту позицию из заказа?",
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await getSupabase().from("order_lines").delete().eq("id", lineId).select();
      assertSingleRowAffected(res);
      setLines((prev) => prev.filter((l) => l.id !== lineId));
    } catch (err) {
      await dialog.alert({
        title: "Ошибка удаления",
        message: "Ошибка удаления: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleConfirmPriceUpdates() {
    if (locked || priceDiff.lines.length === 0 || !order) return;
    try {
      setIsUpdatingPrices(true);
      const { error: rpcErr } = await getSupabase().rpc("apply_price_updates_to_order", {
        p_order_id: order.id,
        p_updates: priceDiff.lines.map((item) => ({
          line_id: item.lineId,
          unit_price: item.newUnitPrice,
        })),
      });
      if (rpcErr) throw new Error(formatErrorMessage(rpcErr, "Ошибка при обновлении цен."));
      const { data: updatedLines } = await getSupabase()
        .from("order_lines")
        .select("*")
        .eq("order_id", order.id);
      if (updatedLines) setLines(updatedLines as OrderLine[]);
      setIsPriceDiffModalOpen(false);
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "Ошибка обновления цен",
        message: "Ошибка при обновлении цен: " + (err instanceof Error ? err.message : String(err)),
        variant: "error",
      });
    } finally {
      setIsUpdatingPrices(false);
    }
  }

  return {
    priceItemsById,
    priceDiff,
    recentPriceItems,
    filteredCatalogItems,
    // Picker modal
    isPricePickerOpen,
    setIsPricePickerOpen,
    pickerSearch,
    setPickerSearch,
    pickerCategory,
    setPickerCategory,
    selectedPriceItem,
    setSelectedPriceItem,
    pickerQty,
    setPickerQty,
    pickerWaste,
    setPickerWaste,
    pickerItemId,
    setPickerItemId,
    pickerComment,
    setPickerComment,
    pickerSaving,
    pickerError,
    addedItemsCount,
    handleOpenPricePicker,
    handleSelectPriceItem,
    handleStepPriceItem,
    handleStepLineQty,
    handleSetLineQty,
    handleAddPriceItemToOrder,
    handleDuplicateLine,
    handleDeleteLine,
    // Price updates
    isPriceDiffModalOpen,
    setIsPriceDiffModalOpen,
    isUpdatingPrices,
    handleConfirmPriceUpdates,
    // Manual line modal (from useManualLine)
    ...manualLine,
  };
}
