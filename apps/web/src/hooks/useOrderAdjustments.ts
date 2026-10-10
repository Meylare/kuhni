import { useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { formatErrorMessage } from "../lib/errors";
import { validateAdjustmentInput } from "../lib/orders";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  type Order,
  type OrderAdjustment,
} from "../types/database";

interface UseOrderAdjustmentsProps {
  order: Order | null;
  adjustments: OrderAdjustment[];
  setAdjustments: React.Dispatch<React.SetStateAction<OrderAdjustment[]>>;
  locked: boolean;
}

export function useOrderAdjustments({
  order,
  setAdjustments,
  locked,
}: UseOrderAdjustmentsProps) {
  const dialog = useDialog();
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjKind, setAdjKind] = useState<"cost" | "price">("price");
  const [adjLabel, setAdjLabel] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjComment, setAdjComment] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  function handleOpenAddAdjustment(calcMode: "quote" | "check_contract") {
    setAdjKind(calcMode === "check_contract" ? "cost" : "price");
    setAdjLabel("");
    setAdjAmount("");
    setAdjComment("");
    setAdjError(null);
    setIsAdjustmentModalOpen(true);
  }

  async function handleSaveAdjustment(
    e: React.FormEvent,
    calcMode: "quote" | "check_contract"
  ) {
    e.preventDefault();
    if (!order || locked) return;

    const amountNum = Number(adjAmount.replace(/\s+/g, "").trim());
    const validation = validateAdjustmentInput({
      label: adjLabel,
      amount: amountNum,
    });

    if (!validation.valid) {
      setAdjError(validation.error ?? "Проверьте данные корректировки.");
      return;
    }

    const effectiveKind = calcMode === "check_contract" ? "cost" : adjKind;

    try {
      setAdjSaving(true);
      setAdjError(null);
      const { data, error: insertErr } = await getSupabase()
        .from("adjustments")
        .insert({
          order_id: order.id,
          kind: effectiveKind,
          category: "adjustments",
          label: adjLabel.trim(),
          amount: amountNum,
          comment: adjComment.trim() || null,
        })
        .select()
        .single();

      if (insertErr) {
        setAdjError(formatErrorMessage(insertErr, "Ошибка добавления корректировки."));
      } else if (data) {
        setAdjustments((prev) => [...prev, data as OrderAdjustment]);
        setIsAdjustmentModalOpen(false);
      }
    } catch (err: unknown) {
      setAdjError(formatErrorMessage(err, "Ошибка добавления корректировки."));
    } finally {
      setAdjSaving(false);
    }
  }

  async function handleDeleteAdjustment(adjId: string) {
    if (locked) return;
    const confirmed = await dialog.confirm({
      title: "Удаление корректировки",
      message: "Удалить эту корректировку?",
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await getSupabase()
        .from("adjustments")
        .delete()
        .eq("id", adjId)
        .select();
      assertSingleRowAffected(res);
      setAdjustments((prev) => prev.filter((a) => a.id !== adjId));
    } catch (err) {
      await dialog.alert({
        title: "Ошибка удаления",
        message: "Ошибка удаления: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  return {
    isAdjustmentModalOpen,
    setIsAdjustmentModalOpen,
    adjKind,
    setAdjKind,
    adjLabel,
    setAdjLabel,
    adjAmount,
    setAdjAmount,
    adjComment,
    setAdjComment,
    adjSaving,
    adjError,
    handleOpenAddAdjustment,
    handleSaveAdjustment,
    handleDeleteAdjustment,
  };
}
