import { useMemo, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { formatErrorMessage } from "../lib/errors";
import { computePriceUpdatesDiff, validateManualLineInput } from "../lib/orders";
import { type ParametersMap } from "../lib/parameters";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  type BillableQtyRounding,
  type Order,
  type OrderItem,
  type OrderLine,
  type PriceCategory,
  type PriceItem,
  type PriceUnit,
} from "../types/database";

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

  // Добавление позиции из справочника цен
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

  // Добавление / редактирование ручной позиции
  const [isManualLineModalOpen, setIsManualLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
  const [manualCategory, setManualCategory] = useState<PriceCategory>("other");
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState<PriceUnit>("шт");
  const [manualQty, setManualQty] = useState("1");
  const [manualUnitPrice, setManualUnitPrice] = useState("");
  const [manualWaste, setManualWaste] = useState("0");
  const [manualRounding, setManualRounding] = useState<BillableQtyRounding>("none");
  const [manualTechnolog, setManualTechnolog] = useState(false);
  const [manualItemId, setManualItemId] = useState<string>("");
  const [manualComment, setManualComment] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Модалка обновления цен из справочника
  const [isPriceDiffModalOpen, setIsPriceDiffModalOpen] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const priceItemsById = useMemo(() => new Map(priceItems.map((p) => [p.id, p])), [priceItems]);
  const priceDiff = useMemo(() => computePriceUpdatesDiff(lines, priceItemsById), [lines, priceItemsById]);

  const filteredCatalogItems = useMemo(() => {
    return priceItems.filter((p) => {
      if (!p.active) return false;
      if (pickerCategory !== "all" && p.category !== pickerCategory) return false;
      if (pickerSearch.trim()) return p.name.toLowerCase().includes(pickerSearch.trim().toLowerCase());
      return true;
    });
  }, [priceItems, pickerCategory, pickerSearch]);

  function handleOpenPricePicker() {
    setSelectedPriceItem(null);
    setPickerQty("1");
    setPickerWaste("");
    setPickerItemId(items.length > 0 ? items[0].id : "");
    setPickerComment("");
    setPickerError(null);
    setPickerSearch("");
    setPickerCategory("all");
    setIsPricePickerOpen(true);
  }

  function handleSelectPriceItem(pi: PriceItem) {
    setSelectedPriceItem(pi);
    setPickerWaste(pi.waste_applicable ? String(globalParams.waste_edge_pct * 100) : "0");
  }

  async function handleAddPriceItemToOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!order || !selectedPriceItem || locked) return;
    const qtyNum = Number(pickerQty.replace(/,/g, ".").trim());
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setPickerError("Количество должно быть больше 0.");
      return;
    }
    const wasteNum = pickerWaste.trim() ? Number(pickerWaste.replace(/,/g, ".").trim()) / 100 : 0;
    try {
      setPickerSaving(true);
      setPickerError(null);
      const { data, error: insertErr } = await getSupabase().from("order_lines").insert({
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
      }).select().single();
      if (insertErr) {
        setPickerError(formatErrorMessage(insertErr, "Ошибка добавления позиции."));
      } else if (data) {
        setLines((prev) => [...prev, data as OrderLine]);
        setIsPricePickerOpen(false);
      }
    } catch (err: unknown) {
      setPickerError(formatErrorMessage(err, "Ошибка добавления позиции."));
    } finally {
      setPickerSaving(false);
    }
  }

  function handleOpenAddManualLine() {
    setEditingLine(null);
    setManualCategory("transport");
    setManualName("");
    setManualUnit("проект");
    setManualQty("1");
    setManualUnitPrice("");
    setManualWaste("0");
    setManualRounding("none");
    setManualTechnolog(false);
    setManualItemId(items.length > 0 ? items[0].id : "");
    setManualComment("");
    setManualError(null);
    setIsManualLineModalOpen(true);
  }

  function handleOpenEditLine(line: OrderLine) {
    setEditingLine(line);
    setManualCategory(line.category);
    setManualName(line.name);
    setManualUnit(line.unit as PriceUnit);
    setManualQty(String(line.qty));
    setManualUnitPrice(String(line.unit_price));
    setManualWaste(String(Number(line.waste_pct) * 100));
    setManualRounding(line.billable_qty_rounding);
    setManualTechnolog(line.counts_for_technolog);
    setManualItemId(line.order_item_id || "");
    setManualComment(line.comment || "");
    setManualError(null);
    setIsManualLineModalOpen(true);
  }

  async function handleSaveManualLine(e: React.FormEvent) {
    e.preventDefault();
    if (!order || locked) return;
    const qtyNum = Number(manualQty.replace(/,/g, ".").trim());
    const priceNum = Number(manualUnitPrice.replace(/\s+/g, "").trim());
    const wasteNum = manualWaste.trim() ? Number(manualWaste.replace(/,/g, ".").trim()) / 100 : 0;
    const validation = validateManualLineInput({
      name: manualName,
      category: manualCategory,
      qty: qtyNum,
      unit_price: priceNum,
      waste_pct: wasteNum,
    });
    if (!validation.valid) {
      setManualError(validation.error ?? "Проверьте данные позиции.");
      return;
    }
    try {
      setManualSaving(true);
      setManualError(null);
      const supabase = getSupabase();
      if (editingLine) {
        const updatePayload: Partial<OrderLine> = {
          qty: qtyNum,
          waste_pct: wasteNum,
          comment: manualComment.trim() || null,
          order_item_id: manualItemId || null,
        };
        if (editingLine.is_manual) {
          updatePayload.name = manualName.trim();
          updatePayload.category = manualCategory;
          updatePayload.unit = manualUnit;
          updatePayload.unit_price = priceNum;
          updatePayload.billable_qty_rounding = manualRounding;
          updatePayload.counts_for_technolog = manualTechnolog;
        }
        const res = await supabase.from("order_lines").update(updatePayload).eq("id", editingLine.id).select();
        const updated = assertSingleRowAffected<OrderLine>(res);
        setLines((prev) => prev.map((l) => (l.id === editingLine.id ? updated : l)));
        setIsManualLineModalOpen(false);
      } else {
        const { data, error: insertErr } = await supabase.from("order_lines").insert({
          order_id: order.id,
          order_item_id: manualItemId || null,
          price_item_id: null,
          category: manualCategory,
          name: manualName.trim(),
          unit: manualUnit,
          qty: qtyNum,
          unit_price: priceNum,
          waste_pct: wasteNum,
          billable_qty_rounding: manualRounding,
          counts_for_technolog: manualTechnolog,
          is_manual: true,
          comment: manualComment.trim() || null,
        }).select().single();
        if (insertErr) {
          setManualError(formatErrorMessage(insertErr, "Ошибка сохранения позиции."));
        } else if (data) {
          setLines((prev) => [...prev, data as OrderLine]);
          setIsManualLineModalOpen(false);
        }
      }
    } catch (err: unknown) {
      setManualError(formatErrorMessage(err, "Ошибка сохранения позиции."));
    } finally {
      setManualSaving(false);
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
      await dialog.alert({ title: "Ошибка удаления", message: "Ошибка удаления: " + formatErrorMessage(err), variant: "error" });
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
      const { data: updatedLines } = await getSupabase().from("order_lines").select("*").eq("order_id", order.id);
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
    handleOpenPricePicker,
    handleSelectPriceItem,
    handleAddPriceItemToOrder,
    // Manual line modal
    isManualLineModalOpen,
    setIsManualLineModalOpen,
    editingLine,
    manualCategory,
    setManualCategory,
    manualName,
    setManualName,
    manualUnit,
    setManualUnit,
    manualQty,
    setManualQty,
    manualUnitPrice,
    setManualUnitPrice,
    manualWaste,
    setManualWaste,
    manualRounding,
    setManualRounding,
    manualTechnolog,
    setManualTechnolog,
    manualItemId,
    setManualItemId,
    manualComment,
    setManualComment,
    manualSaving,
    manualError,
    handleOpenAddManualLine,
    handleOpenEditLine,
    handleSaveManualLine,
    handleDeleteLine,
    // Price updates
    isPriceDiffModalOpen,
    setIsPriceDiffModalOpen,
    isUpdatingPrices,
    handleConfirmPriceUpdates,
  };
}
