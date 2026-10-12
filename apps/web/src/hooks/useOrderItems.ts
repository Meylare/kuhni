import { useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { formatErrorMessage } from "../lib/errors";
import { validateOrderItemInput } from "../lib/orders";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  type Order,
  type OrderItem,
  type OrderItemKind,
  type OrderLine,
} from "../types/database";
import { demoDeleteItem, demoSaveItem, isDemoModeActive } from "../lib/demo-data";

interface UseOrderItemsProps {
  order: Order | null;
  items: OrderItem[];
  lines?: OrderLine[];
  setItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  setLines: React.Dispatch<React.SetStateAction<OrderLine[]>>;
  locked: boolean;
}

export function useOrderItems({
  order,
  items: _items,
  lines = [],
  setItems,
  setLines,
  locked,
}: UseOrderItemsProps) {
  const dialog = useDialog();
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemKind, setItemKind] = useState<OrderItemKind>("kitchen");
  const [itemMeters, setItemMeters] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  function handleOpenAddItem() {
    setEditingItem(null);
    setItemTitle("");
    setItemKind("kitchen");
    setItemMeters("3");
    setItemDesc("");
    setItemError(null);
    setIsItemModalOpen(true);
  }

  function handleOpenEditItem(item: OrderItem) {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemKind(item.kind);
    setItemMeters(item.linear_meters !== null ? String(item.linear_meters) : "");
    setItemDesc(item.description || "");
    setItemError(null);
    setIsItemModalOpen(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!order || locked) return;
    const metersNum =
      itemKind !== "other" && itemMeters.trim()
        ? Number(itemMeters.replace(/,/g, ".").trim())
        : null;
    const validation = validateOrderItemInput({
      title: itemTitle,
      kind: itemKind,
      linear_meters: metersNum,
    });
    if (!validation.valid) {
      setItemError(validation.error ?? "Проверьте данные изделия.");
      return;
    }
    try {
      setItemSaving(true);
      setItemError(null);

      if (isDemoModeActive()) {
        if (editingItem) {
          const updated: OrderItem = {
            ...editingItem,
            title: itemTitle.trim(),
            kind: itemKind,
            linear_meters: metersNum,
            description: itemDesc.trim() || null,
          };
          demoSaveItem(updated);
          setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
        } else {
          const newItem: OrderItem = {
            id: `demo-item-${Date.now()}`,
            order_id: order.id,
            title: itemTitle.trim(),
            kind: itemKind,
            linear_meters: metersNum,
            description: itemDesc.trim() || null,
            dims: {},
          };
          demoSaveItem(newItem);
          setItems((prev) => [...prev, newItem]);
        }
        setIsItemModalOpen(false);
        return;
      }

      const supabase = getSupabase();
      if (editingItem) {
        const res = await supabase
          .from("order_items")
          .update({
            title: itemTitle.trim(),
            kind: itemKind,
            linear_meters: metersNum,
            description: itemDesc.trim() || null,
          })
          .eq("id", editingItem.id)
          .select();
        const updated = assertSingleRowAffected<OrderItem>(res);
        setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
        setIsItemModalOpen(false);
      } else {
        const { data, error: insertErr } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            title: itemTitle.trim(),
            kind: itemKind,
            linear_meters: metersNum,
            description: itemDesc.trim() || null,
            dims: {},
          })
          .select()
          .single();
        if (insertErr) {
          setItemError(formatErrorMessage(insertErr, "Ошибка при сохранении изделия."));
        } else if (data) {
          setItems((prev) => [...prev, data as OrderItem]);
          setIsItemModalOpen(false);
        }
      }
    } catch (err: unknown) {
      setItemError(formatErrorMessage(err, "Ошибка при сохранении изделия."));
    } finally {
      setItemSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (locked) return;
    const confirmed = await dialog.confirm({
      title: "Удаление изделия",
      message: "Удалить это изделие и все привязанные к нему позиции?",
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      if (isDemoModeActive()) {
        if (order) demoDeleteItem(order.id, itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setLines((prev) => prev.filter((l) => l.order_item_id !== itemId));
        return;
      }

      const res = await getSupabase()
        .from("order_items")
        .delete()
        .eq("id", itemId)
        .select();
      assertSingleRowAffected(res);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setLines((prev) => prev.filter((l) => l.order_item_id !== itemId));
    } catch (err) {
      await dialog.alert({
        title: "Ошибка удаления",
        message: "Ошибка удаления изделия: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleDuplicateItem(item: OrderItem) {
    if (!order || locked) return;
    try {
      if (isDemoModeActive()) {
        const newItem: OrderItem = {
          ...item,
          id: `demo-item-${Date.now()}`,
          title: `${item.title} (копия)`,
        };
        demoSaveItem(newItem);
        setItems((prev) => [...prev, newItem]);
        return;
      }

      const supabase = getSupabase();
      const { data: newItem, error: itemErr } = await supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          title: `${item.title} (копия)`,
          kind: item.kind,
          linear_meters: item.linear_meters,
          description: item.description,
          dims: item.dims || {},
        })
        .select()
        .single();
      if (itemErr) throw itemErr;
      if (!newItem) return;

      const linkedLines = lines.filter((l) => l.order_item_id === item.id);
      if (linkedLines.length > 0) {
        const copies = linkedLines.map((l) => ({
          order_id: order.id,
          order_item_id: newItem.id,
          price_item_id: l.price_item_id,
          category: l.category,
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          unit_price: l.unit_price,
          waste_pct: l.waste_pct,
          billable_qty_rounding: l.billable_qty_rounding,
          counts_for_technolog: l.counts_for_technolog,
          is_manual: l.is_manual,
          comment: l.comment,
        }));
        const { data: newLines, error: linesErr } = await supabase
          .from("order_lines")
          .insert(copies)
          .select();
        if (linesErr) throw linesErr;
        if (newLines) {
          setLines((prev) => [...prev, ...(newLines as OrderLine[])]);
        }
      }

      setItems((prev) => [...prev, newItem as OrderItem]);
    } catch (err) {
      console.error("Ошибка дублирования изделия:", err);
      await dialog.alert({
        title: "Ошибка",
        message: "Не удалось продублировать изделие: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  return {
    isItemModalOpen,
    setIsItemModalOpen,
    editingItem,
    itemTitle,
    setItemTitle,
    itemKind,
    setItemKind,
    itemMeters,
    setItemMeters,
    itemDesc,
    setItemDesc,
    itemSaving,
    itemError,
    handleOpenAddItem,
    handleOpenEditItem,
    handleSaveItem,
    handleDuplicateItem,
    handleDeleteItem,
  };
}
