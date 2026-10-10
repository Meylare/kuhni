import { useCallback } from "react";
import { getSupabase } from "../lib/supabase";
import type { OrderItem, OrderLine } from "../types/database";
import { useUndoDelete } from "./useUndoDelete";

interface UseOrderDeletionsProps {
  lines: OrderLine[];
  setLines: React.Dispatch<React.SetStateAction<OrderLine[]>>;
  items: OrderItem[];
  setItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  locked: boolean;
}

export function useOrderDeletions({
  lines,
  setLines,
  items,
  setItems,
  locked,
}: UseOrderDeletionsProps) {
  const { pendingAction, scheduleDelete, undoDelete, flushPending } = useUndoDelete();

  const handleDeleteLineWithUndo = useCallback(
    (lineId: string) => {
      if (locked) return;
      const line = lines.find((l) => l.id === lineId);
      if (!line) return;
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      scheduleDelete({
        id: lineId,
        label: `«${line.name}»`,
        executeDelete: async () => {
          await getSupabase().from("order_lines").delete().eq("id", lineId);
        },
        restore: () => {
          setLines((prev) => [...prev, line]);
        },
      });
    },
    [lines, setLines, locked, scheduleDelete],
  );

  const handleDeleteItemWithUndo = useCallback(
    (itemId: string) => {
      if (locked) return;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const itemLines = lines.filter((l) => l.order_item_id === itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setLines((prev) => prev.filter((l) => l.order_item_id !== itemId));
      scheduleDelete({
        id: itemId,
        label: `Изделие «${item.title}»`,
        executeDelete: async () => {
          if (itemLines.length > 0) {
            await getSupabase().from("order_lines").delete().eq("order_item_id", itemId);
          }
          await getSupabase().from("order_items").delete().eq("id", itemId);
        },
        restore: () => {
          setItems((prev) => [...prev, item]);
          setLines((prev) => [...prev, ...itemLines]);
        },
      });
    },
    [items, setItems, lines, setLines, locked, scheduleDelete],
  );

  return {
    pendingAction,
    undoDelete,
    flushPending,
    handleDeleteLineWithUndo,
    handleDeleteItemWithUndo,
  };
}
