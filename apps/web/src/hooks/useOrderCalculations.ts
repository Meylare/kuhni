import { useMemo, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { formatErrorMessage } from "../lib/errors";
import { formatKzt } from "../lib/money";
import {
  calculateOrderLive,
  getLineCalculationsMap,
  prepareCalculationSnapshot,
  resolveOrderDisplayCalculation,
  shouldConfirmCalculationSave,
} from "../lib/orders";
import { formatPercent, type ParametersMap } from "../lib/parameters";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  type Order,
  type OrderAdjustment,
  type OrderCalculation,
  type OrderItem,
  type OrderLine,
} from "../types/database";

interface UseOrderCalculationsProps {
  order: Order | null;
  setOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  items: OrderItem[];
  lines: OrderLine[];
  adjustments: OrderAdjustment[];
  globalParams: ParametersMap;
  calculations: OrderCalculation[];
  setCalculations: React.Dispatch<React.SetStateAction<OrderCalculation[]>>;
  networkError: string | null;
  locked: boolean;
}

export function useOrderCalculations({
  order,
  setOrder,
  items,
  lines,
  adjustments,
  globalParams,
  calculations,
  setCalculations,
  networkError,
}: UseOrderCalculationsProps) {
  const dialog = useDialog();

  // Режим расчёта: "quote" | "check_contract"
  const [calcMode, setCalcMode] = useState<"quote" | "check_contract">("quote");

  // Версии расчёта
  const [calcSaving, setCalcSaving] = useState(false);
  const [calcSaveSuccess, setCalcSaveSuccess] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Разблокировка заказа
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockSaving, setUnlockSaving] = useState(false);

  // Копирование сводки
  const [copySuccess, setCopySuccess] = useState(false);

  // Базовый расчёт в режиме quote
  const baseCalcOutcome = useMemo(() => {
    if (!order) return null;
    return calculateOrderLive({
      order,
      items,
      lines,
      adjustments,
      globalParams,
      mode: "quote",
    });
  }, [order, items, lines, adjustments, globalParams]);

  // Живой расчёт для текущего режима
  const calcOutcome = useMemo(() => {
    if (!order) return null;
    if (calcMode === "quote") return baseCalcOutcome;
    return calculateOrderLive({
      order,
      items,
      lines,
      adjustments,
      globalParams,
      mode: "check_contract",
    });
  }, [order, items, lines, adjustments, globalParams, calcMode, baseCalcOutcome]);

  // Расчёт для отображения в сводке
  const displayCalc = useMemo(() => {
    if (!order) return null;
    return resolveOrderDisplayCalculation({
      order,
      calculations,
      liveOutcome: calcOutcome,
      mode: calcMode,
      showLivePreview,
    });
  }, [order, calculations, calcOutcome, calcMode, showLivePreview]);

  // Карта расчётов строк
  const lineCalculationsById = useMemo(() => {
    if (displayCalc && displayCalc.lineCalculations.length > 0) {
      return getLineCalculationsMap(displayCalc.lineCalculations);
    }
    const outcome = calcOutcome?.ok ? calcOutcome : baseCalcOutcome;
    if (!outcome || !outcome.ok) return new Map();
    return getLineCalculationsMap(outcome.result.lineCalculations);
  }, [displayCalc, calcOutcome, baseCalcOutcome]);

  // Подытоги категорий
  const categoryTotals = useMemo(() => {
    if (displayCalc) {
      return displayCalc.categoryTotals;
    }
    const outcome = calcOutcome?.ok ? calcOutcome : baseCalcOutcome;
    return outcome?.ok ? outcome.result.categoryTotals : null;
  }, [displayCalc, calcOutcome, baseCalcOutcome]);

  function handleSelectCalcMode(mode: "quote" | "check_contract") {
    setCalcMode(mode);
    const hasSavedMatching = calculations.some((c) => c.mode === mode);
    if (!hasSavedMatching && calculations.length > 0) {
      setShowLivePreview(true);
    }
  }

  async function handleSaveCalculation() {
    if (!order || !calcOutcome || !calcOutcome.ok || Boolean(networkError)) return;

    const saveCheck = shouldConfirmCalculationSave({
      linesCount: lines.length,
      priceTotal: calcOutcome.result.priceTotal,
      margin: calcOutcome.result.margin,
    });

    if (saveCheck.needsConfirmation) {
      const confirmed = await dialog.confirm({
        title: "Внимание",
        message: `${saveCheck.reason} Вы действительно хотите сохранить этот расчёт в истории?`,
        confirmLabel: "Сохранить",
        destructive: false,
      });
      if (!confirmed) return;
    }

    try {
      setCalcSaving(true);
      setCalcSaveSuccess(null);
      const payload = prepareCalculationSnapshot({
        order,
        items,
        lines,
        adjustments,
        globalParams,
        mode: calcMode,
        outcome: calcOutcome,
        isContractBaseline: false,
      });

      const supabase = getSupabase();
      const { data, error: insertErr } = await supabase
        .from("calculations")
        .insert(payload)
        .select()
        .single();

      if (insertErr) {
        await dialog.alert({
          title: "Ошибка сохранения",
          message: "Ошибка сохранения расчёта: " + formatErrorMessage(insertErr),
          variant: "error",
        });
      } else if (data) {
        const saved = data as OrderCalculation;
        setCalculations((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
        setCalcSaveSuccess(`Версия №${saved.version} успешно сохранена в истории`);
        setShowLivePreview(false);
        setTimeout(() => setCalcSaveSuccess(null), 4000);
      } else {
        await dialog.alert({
          title: "Ошибка сохранения",
          message: "Не удалось сохранить расчёт: сервер не вернул созданную запись.",
          variant: "error",
        });
      }
    } catch (err: unknown) {
      await dialog.alert({
        title: "Ошибка сохранения",
        message: "Ошибка при сохранении расчёта: " + formatErrorMessage(err),
        variant: "error",
      });
    } finally {
      setCalcSaving(false);
    }
  }

  async function handleSetBaseline(calcId: string) {
    if (!order) return;
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("set_contract_baseline", {
        p_order_id: order.id,
        p_calc_id: calcId,
      });

      if (rpcErr) {
        await dialog.alert({
          title: "Ошибка",
          message: "Ошибка назначения базового расчёта: " + formatErrorMessage(rpcErr),
          variant: "error",
        });
        return;
      }

      setCalculations((prev) =>
        prev.map((c) => ({
          ...c,
          is_contract_baseline: c.id === calcId,
        }))
      );
    } catch (err) {
      await dialog.alert({
        title: "Ошибка",
        message: "Ошибка назначения базового расчёта: " + formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleConfirmCreateNewVersion() {
    if (!order || Boolean(networkError)) return;
    try {
      setUnlockSaving(true);
      const supabase = getSupabase();

      if (calcOutcome && calcOutcome.ok) {
        try {
          const payload = prepareCalculationSnapshot({
            order,
            items,
            lines,
            adjustments,
            globalParams,
            mode: calcMode,
            outcome: calcOutcome,
          });
          const { data: savedCalc, error: insertErr } = await supabase
            .from("calculations")
            .insert(payload)
            .select()
            .single();

          if (insertErr) {
            console.error("Ошибка фиксации версии расчёта:", insertErr);
            await dialog.alert({
              title: "Предупреждение",
              message: "Предупреждение: не удалось зафиксировать версию расчёта: " + formatErrorMessage(insertErr),
              variant: "warning",
            });
            return;
          } else if (savedCalc) {
            setCalculations((prev) => [savedCalc as OrderCalculation, ...prev]);
          }
        } catch (calcErr) {
          console.error("Ошибка при сохранении версии расчёта:", calcErr);
          await dialog.alert({
            title: "Предупреждение",
            message: "Предупреждение: ошибка сохранения версии: " + formatErrorMessage(calcErr),
            variant: "warning",
          });
          return;
        }
      }

      const res = await supabase
        .from("orders")
        .update({
          status: "quoted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select();

      const updatedOrder = assertSingleRowAffected<Order>(res);
      setOrder(updatedOrder);
      setIsUnlockModalOpen(false);
    } catch (err) {
      await dialog.alert({
        title: "Ошибка",
        message: "Ошибка смены статуса: " + formatErrorMessage(err),
        variant: "error",
      });
    } finally {
      setUnlockSaving(false);
    }
  }

  function handleCopySummary() {
    if (!order || !displayCalc) return;
    const text = [
      `Расчёт заказа: ${order.name}`,
      order.client_label ? `Клиент: ${order.client_label}` : "",
      `Режим: ${calcMode === "quote" ? "Рассчитать цену" : "Проверить договор"}`,
      displayCalc.version ? `Версия: №${displayCalc.version}` : "Превью по актуальным параметрам",
      `Итоговая цена: ${formatKzt(displayCalc.priceTotal)} ₸`,
      `Себестоимость: ${formatKzt(displayCalc.costTotal)} ₸`,
      `Маржа: ${formatKzt(displayCalc.margin)} ₸ (${formatPercent(displayCalc.marginPct)})`,
      `Мин. цена для маржи: ${formatKzt(displayCalc.minPriceForTargetMargin)} ₸`,
      "",
      "Затраты по категориям:",
      `• Материалы: ${formatKzt(displayCalc.categoryTotals.materials)} ₸`,
      `• Фасады: ${formatKzt(displayCalc.categoryTotals.facades)} ₸`,
      `• Цех: ${formatKzt(displayCalc.categoryTotals.workshop)} ₸`,
      `• Фурнитура: ${formatKzt(displayCalc.categoryTotals.hardware)} ₸`,
      `• Транспорт: ${formatKzt(displayCalc.categoryTotals.transport)} ₸`,
      `• Работа: ${formatKzt(displayCalc.categoryTotals.labor)} ₸`,
      `• Сборка: ${formatKzt(displayCalc.assembly)} ₸`,
      `• Технолог: ${formatKzt(displayCalc.technolog)} ₸`,
      `• Остальное: ${formatKzt(displayCalc.categoryTotals.other)} ₸`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  return {
    calcMode,
    setCalcMode,
    handleSelectCalcMode,
    calcOutcome,
    displayCalc,
    categoryTotals,
    lineCalculationsById,
    // History & preview
    calcSaving,
    calcSaveSuccess,
    expandedVersionId,
    setExpandedVersionId,
    showLivePreview,
    setShowLivePreview,
    handleSaveCalculation,
    handleSetBaseline,
    // Unlock modal
    isUnlockModalOpen,
    setIsUnlockModalOpen,
    unlockSaving,
    handleConfirmCreateNewVersion,
    // Copy
    copySuccess,
    handleCopySummary,
  };
}
