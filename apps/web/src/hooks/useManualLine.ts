import { useState } from "react";
import { formatErrorMessage } from "../lib/errors";
import { validateManualLineInput } from "../lib/orders";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import type {
  BillableQtyRounding,
  Order,
  OrderItem,
  OrderLine,
  PriceCategory,
  PriceUnit,
} from "../types/database";

interface UseManualLineProps {
  order: Order | null;
  items: OrderItem[];
  setLines: React.Dispatch<React.SetStateAction<OrderLine[]>>;
  locked: boolean;
}

export function useManualLine({
  order,
  items,
  setLines,
  locked,
}: UseManualLineProps) {
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

  return {
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
  };
}
