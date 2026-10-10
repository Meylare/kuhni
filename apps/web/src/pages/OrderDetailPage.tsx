import { useEffect, useMemo, useState } from "react";

import { FactTab } from "../components/FactTab";
import { useDialog } from "../components/DialogProvider";
import {
  AdjustmentModal,
  ItemModal,
  ManualLineModal,
  PriceDiffModal,
  PricePickerModal,
  UnlockModal,
} from "../components/order/modals";

import { MAX_PRICE_SHARES_SUM } from "@kuhni/calc";
import { formatErrorMessage } from "../lib/errors";
import { formatKzt } from "../lib/money";
import {
  calculateOrderLive,
  checkOrderLoadCriticalErrors,
  computePriceUpdatesDiff,
  formatCalculationOutcomeError,
  getLineCalculationsMap,
  getOrderLineCalculation,
  getPlanCalculation,
  getVisibleAdjustments,
  isOrderLocked,
  mergeOrderParameters,
  normalizeOrderCalculation,
  prepareCalculationSnapshot,
  resolveOrderDisplayCalculation,
  shouldConfirmCalculationSave,
  SnapshotCorruptedError,
  validateAdjustmentInput,
  validateManualLineInput,
  validateOrderInput,
  validateOrderItemInput,
} from "../lib/orders";
import {
  DEFAULT_PARAMETERS,
  formatPercent,
  parametersArrayToMap,
  parsePercent,
  type ParametersMap,
} from "../lib/parameters";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  ORDER_ITEM_KIND_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type ActualExpense,
  type BillableQtyRounding,
  type Order,
  type OrderAdjustment,
  type OrderCalculation,
  type OrderItem,
  type OrderItemKind,
  type OrderLine,
  type OrderStatus,
  type ParameterItem,
  type Payment,
  type PriceCategory,
  type PriceItem,
  type PriceUnit,
} from "../types/database";

interface OrderDetailPageProps {
  orderId: string;
  onBack: () => void;
}

export function OrderDetailPage({ orderId, onBack }: OrderDetailPageProps) {
  const dialog = useDialog();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [adjustments, setAdjustments] = useState<OrderAdjustment[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [globalParams, setGlobalParams] = useState<ParametersMap>(DEFAULT_PARAMETERS);
  const [expenses, setExpenses] = useState<ActualExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Режим расчёта: "quote" (рассчитать цену) | "check_contract" (проверить договор)
  const [calcMode, setCalcMode] = useState<"quote" | "check_contract">("quote");

  // Активная вкладка заказа: "calc" (расчёт) | "history" (история) | "fact" (факт)
  const [orderTab, setOrderTab] = useState<"calc" | "history" | "fact">("calc");

  // Раскрытие подробной сводки затрат
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Версии расчёта заказа (U5)
  const [calculations, setCalculations] = useState<OrderCalculation[]>([]);
  const [calcSaving, setCalcSaving] = useState(false);
  const [calcSaveSuccess, setCalcSaveSuccess] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Модальные окна U5: обновление цен и разблокировка заказа
  const [isPriceDiffModalOpen, setIsPriceDiffModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockSaving, setUnlockSaving] = useState(false);

  // Редактирование шапки заказа
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");
  const [headerClient, setHeaderClient] = useState("");
  const [headerStatus, setHeaderStatus] = useState<OrderStatus>("draft");
  const [headerContractPrice, setHeaderContractPrice] = useState("");
  const [headerNote, setHeaderNote] = useState("");
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // Добавление / редактирование изделия
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemKind, setItemKind] = useState<OrderItemKind>("kitchen");
  const [itemMeters, setItemMeters] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

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

  // Добавление корректировки
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjKind, setAdjKind] = useState<"cost" | "price">("price");
  const [adjLabel, setAdjLabel] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjComment, setAdjComment] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  // Переопределение параметров заказа (аккордеон)
  const [isParamsAccordionOpen, setIsParamsAccordionOpen] = useState(false);
  const [customMargin, setCustomMargin] = useState("");
  const [customAssemblyMode, setCustomAssemblyMode] = useState<"default" | "percent" | "per_meter">("default");
  const [customAssemblyPct, setCustomAssemblyPct] = useState("");
  const [customTechnologMode, setCustomTechnologMode] = useState<"default" | "percent" | "per_sheet">("default");
  const [customTechnologPct, setCustomTechnologPct] = useState("");
  const [customRiskReservePct, setCustomRiskReservePct] = useState("");
  const [paramsSaving, setParamsSaving] = useState(false);

  // Копирование сводки в буфер
  const [copySuccess, setCopySuccess] = useState(false);

  // Обновление цен в заказе из актуального прайса
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Ошибка неполной загрузки данных из-за сети (Step B4)
  const [networkError, setNetworkError] = useState<string | null>(null);

  async function loadOrderData() {
    try {
      setLoading(true);
      setError(null);
      setNetworkError(null);
      const supabase = getSupabase();

      // Загрузка заказа
      const { data: ordData, error: ordErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (ordErr || !ordData) {
        throw new Error(ordErr?.message ?? "Заказ не найден");
      }

      setOrder(ordData as Order);

      // Загрузка связанных таблиц параллельно
      const [itemsRes, linesRes, adjRes, pricesRes, paramsRes, calcsRes, expensesRes, paymentsRes] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId).order("title"),
        supabase.from("order_lines").select("*").eq("order_id", orderId),
        supabase.from("adjustments").select("*").eq("order_id", orderId),
        supabase.from("price_items").select("*").order("name"),
        supabase.from("parameters").select("*"),
        supabase.from("calculations").select("*").eq("order_id", orderId).order("version", { ascending: false }),
        supabase.from("actual_expenses").select("*").eq("order_id", orderId).order("expense_date", { ascending: false }),
        supabase.from("payments").select("*").eq("order_id", orderId).order("paid_at", { ascending: false }),
      ]);

      const loadStatus = checkOrderLoadCriticalErrors({
        itemsError: itemsRes.error,
        linesError: linesRes.error,
        adjustmentsError: adjRes.error,
        pricesError: pricesRes.error,
        parametersError: paramsRes.error,
        calculationsError: calcsRes.error,
        expensesError: expensesRes.error,
        paymentsError: paymentsRes.error,
      });

      if (loadStatus.hasError) {
        setNetworkError(loadStatus.errorMessage);
        console.error("Order data partially failed to load due to network error:", {
          items: itemsRes.error,
          lines: linesRes.error,
          adjustments: adjRes.error,
          prices: pricesRes.error,
          parameters: paramsRes.error,
          calculations: calcsRes.error,
          expenses: expensesRes.error,
          payments: paymentsRes.error,
        });
      } else {
        setNetworkError(null);
      }

      setItems((itemsRes.data as OrderItem[]) || []);
      setLines((linesRes.data as OrderLine[]) || []);
      setAdjustments((adjRes.data as OrderAdjustment[]) || []);
      setPriceItems((pricesRes.data as PriceItem[]) || []);
      setCalculations((calcsRes.data as OrderCalculation[]) || []);
      setExpenses((expensesRes.data as ActualExpense[]) || []);
      setPayments((paymentsRes.data as Payment[]) || []);

      if (paramsRes.data) {
        const map = parametersArrayToMap(paramsRes.data as ParameterItem[]);
        setGlobalParams(map);
      }

      // Инициализируем локальные поля настроек заказа
      const s = (ordData.settings || {}) as Record<string, unknown>;
      setCustomMargin(
        typeof s.target_margin_pct === "number" ? formatPercent(s.target_margin_pct) : ""
      );
      setCustomAssemblyMode(
        s.assembly_mode === "percent" || s.assembly_mode === "per_meter"
          ? s.assembly_mode
          : "default"
      );
      setCustomAssemblyPct(
        typeof s.assembly_pct === "number" ? formatPercent(s.assembly_pct) : ""
      );
      setCustomTechnologMode(
        s.technolog_mode === "percent" || s.technolog_mode === "per_sheet"
          ? s.technolog_mode
          : "default"
      );
      setCustomTechnologPct(
        typeof s.technolog_pct === "number" ? formatPercent(s.technolog_pct) : ""
      );
      setCustomRiskReservePct(
        typeof s.risk_reserve_pct === "number" ? formatPercent(s.risk_reserve_pct) : ""
      );
    } catch (err: unknown) {
      setError(formatErrorMessage(err, "Не удалось загрузить данные заказа."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrderData();
  }, [orderId]);

  // Заказ заблокирован?
  const locked = order ? isOrderLocked(order.status) : false;

  // Карта справочника цен для проверки изменений снимков
  const priceItemsById = useMemo(() => {
    return new Map(priceItems.map((p) => [p.id, p]));
  }, [priceItems]);

  // Базовый расчёт сметы позиций (в режиме quote), чтобы подытоги и строки
  // всегда брались из пакета packages/calc, даже если в check_contract не введена сумма договора
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

  // Вычисление живого расчёта для активного режима
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

  // Определение расчёта для отображения в сводке (Step A6, A7, Q2, Q7)
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

  // Карта расчётов строк из чистого модуля packages/calc
  const lineCalculationsById = useMemo(() => {
    if (displayCalc && displayCalc.lineCalculations.length > 0) {
      return getLineCalculationsMap(displayCalc.lineCalculations);
    }
    const outcome = calcOutcome?.ok ? calcOutcome : baseCalcOutcome;
    if (!outcome || !outcome.ok) return new Map();
    return getLineCalculationsMap(outcome.result.lineCalculations);
  }, [displayCalc, calcOutcome, baseCalcOutcome]);

  // Карта подытогов категорий из чистого модуля packages/calc
  const categoryTotals = useMemo(() => {
    if (displayCalc) {
      return displayCalc.categoryTotals;
    }
    const outcome = calcOutcome?.ok ? calcOutcome : baseCalcOutcome;
    return outcome?.ok ? outcome.result.categoryTotals : null;
  }, [displayCalc, calcOutcome, baseCalcOutcome]);

  // Проверка и расчёт разницы цен с актуальным справочником (U5)
  const priceDiff = useMemo(() => {
    return computePriceUpdatesDiff(lines, priceItemsById);
  }, [lines, priceItemsById]);

  // Переключение режима расчёта (Step A7, Q7)
  function handleSelectCalcMode(mode: "quote" | "check_contract") {
    setCalcMode(mode);
    if (mode === "check_contract") {
      setAdjKind("cost");
    }
    const hasSavedMatching = calculations.some((c) => c.mode === mode);
    if (!hasSavedMatching && calculations.length > 0) {
      setShowLivePreview(true);
    }
  }

  // Открытие редактирования шапки
  function handleOpenEditHeader() {
    if (!order) return;
    setHeaderName(order.name);
    setHeaderClient(order.client_label || "");
    setHeaderStatus(order.status);
    setHeaderContractPrice(
      order.contract_price !== null ? String(order.contract_price) : ""
    );
    setHeaderNote(order.note || "");
    setHeaderError(null);
    setIsEditingHeader(true);
  }

  // Сохранение шапки заказа
  async function handleSaveHeader(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    const contractPriceNum = headerContractPrice.trim()
      ? Number(headerContractPrice.replace(/\s+/g, ""))
      : null;

    const validation = validateOrderInput({
      name: headerName,
      contract_price: contractPriceNum,
    });

    if (!validation.valid) {
      setHeaderError(validation.error ?? "Проверьте введённые данные.");
      return;
    }

    try {
      setHeaderSaving(true);
      setHeaderError(null);
      const supabase = getSupabase();

      const res = await supabase
        .from("orders")
        .update({
          name: headerName.trim(),
          client_label: headerClient.trim() || null,
          status: headerStatus,
          contract_price: contractPriceNum,
          note: headerNote.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select();

      const updatedOrder = assertSingleRowAffected<Order>(res);
      setOrder(updatedOrder);
      setIsEditingHeader(false);
    } catch (err: unknown) {
      setHeaderError(formatErrorMessage(err, "Ошибка при сохранении."));
    } finally {
      setHeaderSaving(false);
    }
  }

  // Сохранение переопределённых параметров заказа
  async function handleSaveOrderSettings() {
    if (!order || locked) return;

    try {
      setParamsSaving(true);
      const newSettings: Record<string, unknown> = {};

      const marginParsed = parsePercent(customMargin);
      if (marginParsed !== null) newSettings.target_margin_pct = marginParsed;

      if (customAssemblyMode !== "default") {
        newSettings.assembly_mode = customAssemblyMode;
      }
      const assemblyParsed = parsePercent(customAssemblyPct);
      if (assemblyParsed !== null) newSettings.assembly_pct = assemblyParsed;

      if (customTechnologMode !== "default") {
        newSettings.technolog_mode = customTechnologMode;
      }
      const techParsed = parsePercent(customTechnologPct);
      if (techParsed !== null) newSettings.technolog_pct = techParsed;

      const riskParsed = parsePercent(customRiskReservePct);
      if (riskParsed !== null) newSettings.risk_reserve_pct = riskParsed;

      // Валидация суммарной доли MAX_PRICE_SHARES_SUM (Step A3)
      const mergedParams = mergeOrderParameters(globalParams, newSettings);
      const assemblyShare =
        mergedParams.assemblyMode === "percent" ? mergedParams.assemblyPct : 0;
      const technologShare =
        mergedParams.technologMode === "percent" ? mergedParams.technologPct : 0;
      const sumShares =
        mergedParams.targetMarginPct + assemblyShare + technologShare + mergedParams.riskReservePct;

      if (sumShares > MAX_PRICE_SHARES_SUM) {
        await dialog.alert({
          title: "Ошибка",
          message: `Сумма процентных ставок (${(sumShares * 100).toFixed(1)}%) превышает максимально допустимые ${(MAX_PRICE_SHARES_SUM * 100).toFixed(0)}%. Уменьшите маржу или другие ставки.`,
          variant: "error",
        });
        return;
      }

      const supabase = getSupabase();
      const res = await supabase
        .from("orders")
        .update({
          settings: newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select();

      const updatedOrder = assertSingleRowAffected<Order>(res);
      setOrder(updatedOrder);
    } catch (err) {
      await dialog.alert({
        title: "Ошибка",
        message: "Ошибка сохранения параметров: " + formatErrorMessage(err),
        variant: "error",
      });
    } finally {
      setParamsSaving(false);
    }
  }

  // Добавление / редактирование изделия
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
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? updated : i))
        );
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
      const supabase = getSupabase();
      const res = await supabase
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

  // Добавление позиции из справочника цен
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
    // Предзаполняем отход: если кромка - берём waste_edge_pct из параметров, иначе 0
    if (pi.waste_applicable) {
      const edgeWaste = globalParams.waste_edge_pct * 100;
      setPickerWaste(String(edgeWaste));
    } else {
      setPickerWaste("0");
    }
  }

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
      const supabase = getSupabase();

      // Вставка позиции
      const { data, error: insertErr } = await supabase
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
        setIsPricePickerOpen(false);
      }
    } catch (err: unknown) {
      setPickerError(formatErrorMessage(err, "Ошибка добавления позиции."));
    } finally {
      setPickerSaving(false);
    }
  }

  // Добавление / редактирование ручной позиции
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
    const wasteNum = manualWaste.trim()
      ? Number(manualWaste.replace(/,/g, ".").trim()) / 100
      : 0;

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

        const res = await supabase
          .from("order_lines")
          .update(updatePayload)
          .eq("id", editingLine.id)
          .select();

        const updated = assertSingleRowAffected<OrderLine>(res);
        setLines((prev) =>
          prev.map((l) => (l.id === editingLine.id ? updated : l))
        );
        setIsManualLineModalOpen(false);
      } else {
        const { data, error: insertErr } = await supabase
          .from("order_lines")
          .insert({
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
          })
          .select()
          .single();

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
      const supabase = getSupabase();
      const res = await supabase
        .from("order_lines")
        .delete()
        .eq("id", lineId)
        .select();

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

  // Подтверждение и применение обновлений цен из справочника
  async function handleConfirmPriceUpdates() {
    if (locked || priceDiff.lines.length === 0) return;

    try {
      setIsUpdatingPrices(true);
      const supabase = getSupabase();

      // Массовое обновление цен в единой транзакции через RPC-функцию apply_price_updates_to_order (Step B2)
      const { error: rpcErr } = await supabase.rpc("apply_price_updates_to_order", {
        p_order_id: order!.id,
        p_updates: priceDiff.lines.map((item) => ({
          line_id: item.lineId,
          unit_price: item.newUnitPrice,
        })),
      });

      if (rpcErr) {
        throw new Error(formatErrorMessage(rpcErr, "Ошибка при обновлении цен."));
      }

      // Перезагрузка строк
      const { data: updatedLines } = await supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", order!.id);
      if (updatedLines) {
        setLines(updatedLines as OrderLine[]);
      }
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

  // Сохранение новой неизменяемой версии расчёта (U5, Step B4)
  async function handleSaveCalculation() {
    if (!order || !calcOutcome || !calcOutcome.ok || Boolean(networkError)) return;

    // Запретить сохранение расчёта, если в заказе 0 позиций, итоговая цена равна 0 или маржа отрицательная, без явного подтверждения (Step B4, A3)
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

  // Назначение версии расчёта как базовой для договора (is_contract_baseline) - атомарно (Step A5)
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

  // Разблокировка заблокированного заказа для создания новой версии (U5)
  async function handleConfirmCreateNewVersion() {
    if (!order || Boolean(networkError)) return;
    try {
      setUnlockSaving(true);
      const supabase = getSupabase();

      // Если расчёт валиден и ещё не сохранён, зафиксируем текущий
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

      // Переводим заказ в статус 'quoted' для возможности редактирования
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

  // Добавление корректировки
  function handleOpenAddAdjustment() {
    setAdjKind(calcMode === "check_contract" ? "cost" : "price");
    setAdjLabel("");
    setAdjAmount("");
    setAdjComment("");
    setAdjError(null);
    setIsAdjustmentModalOpen(true);
  }

  async function handleSaveAdjustment(e: React.FormEvent) {
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
      const supabase = getSupabase();

      const { data, error: insertErr } = await supabase
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
      const supabase = getSupabase();
      const res = await supabase
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

  // Копирование сводки расчёта в буфер обмена
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

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center py-20 text-stone-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-900 border-t-transparent" />
        <span className="mt-3 text-sm">Загрузка данных заказа…</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8">
        <button
          type="button"
          onClick={onBack}
          className="self-start min-h-11 rounded-xl border border-stone-300 bg-white/70 px-4 text-sm font-medium text-stone-700 hover:bg-white"
        >
          ← К списку заказов
        </button>
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h2 className="text-base font-bold">Не удалось открыть заказ</h2>
          <p className="mt-1 text-sm">{error || "Заказ не найден"}</p>
        </div>
      </div>
    );
  }

  const statusConfig = ORDER_STATUS_COLORS[order.status] ?? ORDER_STATUS_COLORS.draft;
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;

  // Фильтрация позиций прайса в модалке выбора
  const filteredCatalogItems = priceItems.filter((p) => {
    if (!p.active) return false;
    if (pickerCategory !== "all" && p.category !== pickerCategory) return false;
    if (pickerSearch.trim()) {
      return p.name.toLowerCase().includes(pickerSearch.trim().toLowerCase());
    }
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-4 pb-48 md:pb-32">
      {/* Верхняя навигация и статус */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white/80 px-3.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-white active:scale-98"
        >
          <span>←</span>
          <span>Заказы</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={handleOpenEditHeader}
            className="min-h-10 rounded-xl border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Изменить заказ
          </button>
        </div>
      </div>

      {/* Баннер сетевой ошибки загрузки заказа (Step B4) */}
      {networkError && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <strong className="text-sm font-bold text-rose-900 block">
                {networkError}
              </strong>
              <p className="mt-0.5 text-rose-700">
                Редактирование, добавление позиций и сохранение расчёта заблокированы для предотвращения потери данных.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadOrderData()}
            className="self-start sm:self-auto min-h-10 whitespace-nowrap rounded-xl bg-rose-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-900 active:scale-98 cursor-pointer"
          >
            🔄 Повторить загрузку
          </button>
        </div>
      )}

      {/* Предупреждение о блокировке (U5) */}
      {locked && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">🔒</span>
            <div>
              <strong className="text-sm font-bold text-amber-950">Заказ заблокирован от случайных правок</strong>
              <p className="mt-0.5 text-amber-800">
                Заказ находится в статусе «{statusLabel}». Позиции и параметры защищены от изменений.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsUnlockModalOpen(true)}
            className="self-start sm:self-auto min-h-10 whitespace-nowrap rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-950 active:scale-98"
          >
            Создать новую версию расчёта
          </button>
        </div>
      )}

      {/* Карточка заказа: название, клиент, сумма */}
      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900 md:text-2xl">
              {order.name}
            </h1>
            {order.client_label && (
              <p className="mt-0.5 text-xs text-stone-500">
                Клиент: <span className="font-semibold text-stone-800">{order.client_label}</span>
              </p>
            )}
            {order.note && (
              <p className="mt-1 text-xs text-stone-600 bg-stone-50 p-2 rounded-lg italic">
                {order.note}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {order.contract_price !== null && (
              <div className="rounded-xl bg-stone-100 px-3 py-1.5 text-right">
                <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                  Договор
                </span>
                <span className="text-sm font-bold text-stone-900">
                  {formatKzt(order.contract_price)} ₸
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleCopySummary}
              className="min-h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700 hover:bg-stone-100"
              title="Копировать сводку расчёта"
            >
              {copySuccess ? "✓ Скопировано" : "📋 Скопировать"}
            </button>
          </div>
        </div>

        {/* Вкладки: Расчёт / История / Факт */}
        <div className="mt-4 flex items-center gap-1 border-t border-stone-100 pt-3">
          <button
            type="button"
            onClick={() => setOrderTab("calc")}
            className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all ${
              orderTab === "calc"
                ? "bg-emerald-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            1. Расчёт ({lines.length} поз.)
          </button>
          <button
            type="button"
            onClick={() => setOrderTab("history")}
            className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all ${
              orderTab === "history"
                ? "bg-emerald-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            2. История версий ({calculations.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderTab("fact")}
            className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all ${
              orderTab === "fact"
                ? "bg-emerald-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            3. Факт ({expenses.length + payments.length})
          </button>
        </div>
      </div>

      {orderTab === "history" && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">История расчётов</h2>
              <p className="text-xs text-stone-500">
                Зафиксированные неизменяемые версии расчёта с исходными параметрами и снимками
              </p>
            </div>
            {!locked && calcOutcome && calcOutcome.ok && (
              <button
                type="button"
                disabled={calcSaving || Boolean(networkError)}
                onClick={handleSaveCalculation}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                title={networkError ? "Сохранение заблокировано из-за сетевой ошибки" : undefined}
              >
                <span>💾</span>
                <span>{calcSaving ? "Сохранение…" : "Сохранить текущий расчёт"}</span>
              </button>
            )}
          </div>

          {calcSaveSuccess && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
              ✓ {calcSaveSuccess}
            </div>
          )}

          {calculations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-10 text-center text-sm text-stone-600">
              <span className="text-3xl">📜</span>
              <h3 className="mt-2 font-bold text-stone-800">Нет сохранённых расчётов</h3>
              <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                В этом заказе пока нет зафиксированных версий. Нажмите «Сохранить расчёт», чтобы зафиксировать версию 1.
              </p>
              {!locked && calcOutcome && calcOutcome.ok && (
                <button
                  type="button"
                  disabled={calcSaving || Boolean(networkError)}
                  onClick={handleSaveCalculation}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={networkError ? "Сохранение заблокировано из-за сетевой ошибки" : undefined}
                >
                  <span>💾 Сохранить версию 1</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {calculations.map((calc) => {
                const isExpanded = expandedVersionId === calc.id;
                const formattedDate = new Date(calc.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                let normalized: ReturnType<typeof normalizeOrderCalculation> | null = null;
                let corruptionField: string | null = null;
                try {
                  normalized = normalizeOrderCalculation(calc);
                } catch (err) {
                  if (err instanceof SnapshotCorruptedError) {
                    corruptionField = err.missingField;
                  } else {
                    corruptionField = "данные";
                  }
                }

                if (corruptionField || !normalized) {
                  return (
                    <div
                      key={calc.id}
                      className="overflow-hidden rounded-2xl border border-rose-300 bg-rose-50/60 p-4 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-rose-900">
                            Версия #{calc.version}: данные повреждены (поле {corruptionField})
                          </span>
                          <span className="text-xs text-rose-600">{formattedDate}</span>
                        </div>
                        <span className="rounded-md bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                          Недоступна для отображения
                        </span>
                      </div>
                    </div>
                  );
                }

                const paramsSnap = normalized.parameters;
                const resSnap = normalized.result;
                const inputLines = normalized.input.lines;
                const catTotals = resSnap.categoryTotals;
                const warnings = resSnap.warnings;

                return (
                  <div
                    key={calc.id}
                    className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition-shadow hover:shadow-sm"
                  >
                    {/* Заголовок версии */}
                    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 bg-stone-50/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-stone-900">
                          Версия #{calc.version}
                        </span>
                        <span className="text-xs text-stone-500">{formattedDate}</span>
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                          {calc.mode === "quote" ? "Рассчитать цену" : "Проверить договор"}
                        </span>
                        {calc.is_contract_baseline && (
                          <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            ⭐ Подписанный договор
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!calc.is_contract_baseline && (
                          <button
                            type="button"
                            onClick={() => void handleSetBaseline(calc.id)}
                            className="min-h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                            title="Сделать этот расчёт базовым для договора"
                          >
                            Сделать договорным
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedVersionId(isExpanded ? null : calc.id)}
                          className="min-h-8 rounded-lg bg-stone-100 px-3 text-[11px] font-semibold text-stone-700 hover:bg-stone-200"
                        >
                          {isExpanded ? "Свернуть ▲" : "Подробнее ▼"}
                        </button>
                      </div>
                    </div>

                    {/* Ключевые показатели */}
                    <div className="grid grid-cols-3 divide-x divide-stone-100 p-4 text-center">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-stone-400">
                          Итоговая цена
                        </span>
                        <span className="mt-0.5 block text-base font-extrabold text-stone-900 sm:text-lg">
                          {formatKzt(calc.price_total)} ₸
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-stone-400">
                          Себестоимость
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-stone-700 sm:text-base">
                          {formatKzt(calc.cost_total)} ₸
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-stone-400">
                          Маржа
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-baseline justify-center gap-1">
                          <span className="text-sm font-bold text-emerald-900 sm:text-base">
                            {formatKzt(calc.price_total - calc.cost_total)} ₸
                          </span>
                          {calc.margin_pct !== null && (
                            <span className="text-xs font-semibold text-emerald-700">
                              ({formatPercent(calc.margin_pct)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Раскрывающийся подробный снимок */}
                    {isExpanded && (
                      <div className="border-t border-stone-100 bg-stone-50/40 p-4 text-xs flex flex-col gap-4">
                        {warnings.length > 0 && (
                          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                            ⚠️ {warnings.join("; ")}
                          </div>
                        )}

                        {/* Параметры */}
                        <div>
                          <h4 className="font-bold text-stone-800 mb-1.5">
                            ⚙️ Параметры на момент фиксации:
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] text-stone-700">
                            <div>
                              <span className="text-stone-400 block">Целевая маржа:</span>
                              <span className="font-semibold">
                                {typeof paramsSnap.targetMarginPct === "number"
                                  ? formatPercent(paramsSnap.targetMarginPct)
                                  : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Сборка:</span>
                              <span className="font-semibold">
                                {paramsSnap.assemblyMode === "per_meter"
                                  ? "за пог. метр"
                                  : typeof paramsSnap.assemblyPct === "number"
                                  ? formatPercent(paramsSnap.assemblyPct)
                                  : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Технолог:</span>
                              <span className="font-semibold">
                                {paramsSnap.technologMode === "per_sheet"
                                  ? "за лист"
                                  : typeof paramsSnap.technologPct === "number"
                                  ? formatPercent(paramsSnap.technologPct)
                                  : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Резерв на риск:</span>
                              <span className="font-semibold">
                                {typeof paramsSnap.riskReservePct === "number"
                                  ? formatPercent(paramsSnap.riskReservePct)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Разделение затрат по статьям */}
                        <div>
                          <h4 className="font-bold text-stone-800 mb-1.5">
                            📊 Затраты по категориям:
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-stone-200 bg-white p-3 text-[11px]">
                            {ALL_CATEGORIES.map((cat) => (
                              <div key={cat}>
                                <span className="text-stone-400 block">{CATEGORY_LABELS[cat]}:</span>
                                <span className="font-semibold text-stone-800">
                                  {formatKzt((catTotals as Record<string, number>)[cat] || 0)} ₸
                                </span>
                              </div>
                            ))}
                            <div>
                              <span className="text-stone-400 block">Сборка:</span>
                              <span className="font-semibold text-stone-800">
                                {formatKzt(resSnap.assembly)} ₸
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Технолог:</span>
                              <span className="font-semibold text-stone-800">
                                {formatKzt(resSnap.technolog)} ₸
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Резерв на риск:</span>
                              <span className="font-semibold text-stone-800">
                                {formatKzt(resSnap.riskReserve)} ₸
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Мин. цена для маржи:</span>
                              <span className="font-semibold text-stone-800">
                                {formatKzt(resSnap.minPriceForTargetMargin)} ₸
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Зафиксированные позиции */}
                        {inputLines.length > 0 && (
                          <div>
                            <h4 className="font-bold text-stone-800 mb-1.5">
                              📋 Позиции расчёта ({inputLines.length}):
                            </h4>
                            <div className="max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
                              {inputLines.map((l, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 text-[11px]">
                                  <div>
                                    <div className="font-semibold text-stone-900">
                                      {l.name}
                                    </div>
                                    <div className="text-stone-500">
                                      {l.qty} {l.unit} × {formatKzt(l.unitPrice)} ₸
                                      {l.wastePct > 0 && ` (+${(l.wastePct * 100).toFixed(0)}% отход)`}
                                    </div>
                                  </div>
                                  <div className="font-bold text-stone-900">
                                    {formatKzt(l.qty * l.unitPrice * (1 + (l.wastePct || 0)))} ₸
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {orderTab === "fact" && order && (
        <FactTab
          order={order}
          expenses={expenses}
          payments={payments}
          calculations={calculations}
          onExpensesChange={setExpenses}
          onPaymentsChange={setPayments}
        />
      )}

      {orderTab === "calc" && (
        <>
          {/* Переключатель режима расчёта */}
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-stone-700">
              Режим расчёта:
            </span>
            <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => handleSelectCalcMode("quote")}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-all ${
                  calcMode === "quote"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Рассчитать цену (quote)
              </button>
              <button
                type="button"
                onClick={() => handleSelectCalcMode("check_contract")}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-all ${
                  calcMode === "check_contract"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Проверить договор (check_contract)
              </button>
            </div>
          </div>

          {/* Предупреждение о не указанной цене договора в режиме check_contract */}
          {calcMode === "check_contract" && order.contract_price === null && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              ⚠️ В режиме проверки договора требуется указать цену по договору. Нажмите «Изменить заказ» вверху и введите сумму.
            </div>
          )}

          {/* Баннер изменившихся цен в справочнике */}
          {priceDiff.lines.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50/80 p-3 sm:flex-row sm:items-center sm:justify-between text-xs text-amber-900">
              <div>
                <strong>Внимание:</strong> в справочнике цен изменились цены для {priceDiff.lines.length} поз. из этого заказа.
              </div>
              {!locked && (
                <button
                  type="button"
                  disabled={isUpdatingPrices}
                  onClick={() => setIsPriceDiffModalOpen(true)}
                  className="self-start whitespace-nowrap rounded-lg bg-amber-800 px-3 py-1.5 font-semibold text-white shadow-xs hover:bg-amber-900 disabled:opacity-50"
                >
                  {isUpdatingPrices ? "Обновление…" : `Обновить цены (${priceDiff.totalDiff > 0 ? "+" : ""}${formatKzt(priceDiff.totalDiff)} ₸)`}
                </button>
              )}
            </div>
          )}

          {/* СЕКЦИЯ 1: ИЗДЕЛИЯ */}
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Изделия заказа
                </h2>
                <p className="text-xs text-stone-500">
                  Кухни, шкафы и другие модули проекта
                </p>
              </div>

              {!locked && (
                <button
                  type="button"
                  disabled={Boolean(networkError)}
                  onClick={handleOpenAddItem}
                  className="flex min-h-10 items-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
                >
                  <span>+</span>
                  <span>Добавить изделие</span>
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-4 text-center text-xs text-stone-500">
                В заказе пока нет изделий (например: Кухня 3м). Изделия нужны для расчёта сборки по погонным метрам.
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const kindLabel = ORDER_ITEM_KIND_LABELS[item.kind];
                  const linkedLinesCount = lines.filter((l) => l.order_item_id === item.id).length;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">
                            {item.title}
                          </span>
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                            {kindLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                          {item.linear_meters !== null && (
                            <span>{item.linear_meters} пог. м</span>
                          )}
                          <span>Позиций: {linkedLinesCount}</span>
                        </div>
                      </div>

                      {!locked && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 text-xs text-stone-500 hover:text-stone-800"
                            title="Редактировать"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item.id)}
                            className="p-1.5 text-xs text-rose-500 hover:text-rose-800"
                            title="Удалить"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* СЕКЦИЯ 2: ПОЗИЦИИ И СМЕТА */}
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Позиции и затраты ({lines.length})
                </h2>
                <p className="text-xs text-stone-500">
                  Материалы, фасады, цех, фурнитура, транспорт и монтаж
                </p>
              </div>

              {!locked && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(networkError)}
                    onClick={handleOpenPricePicker}
                    className="flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
                  >
                    <span>+</span>
                    <span>Из справочника</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(networkError)}
                    onClick={handleOpenAddManualLine}
                    className="flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
                  >
                    <span>+</span>
                    <span>Ручная позиция</span>
                  </button>
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
                Позиций пока нет. Добавьте материалы и услуги из прайс-листа или создайте ручную позицию (например, доставку).
              </div>
            ) : (
              <div className="mt-4 flex flex-col divide-y divide-stone-100">
                {ALL_CATEGORIES.map((cat) => {
                  const catLines = lines.filter((l) => l.category === cat);
                  if (catLines.length === 0) return null;

                  const catTotal = categoryTotals ? ((categoryTotals as Record<string, number>)[cat] ?? 0) : 0;

                  return (
                    <div key={cat} className="py-3 first:pt-0 last:pb-0">
                      {/* Заголовок категории */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                          {CATEGORY_LABELS[cat]} ({catLines.length})
                        </span>
                        <span className="text-xs font-bold text-stone-900">
                          {formatKzt(catTotal)} ₸
                        </span>
                      </div>

                      {/* Список строк категории */}
                      <div className="mt-1 flex flex-col gap-1.5">
                        {catLines.map((line) => {
                          const lineCalc =
                            lineCalculationsById.get(line.id) ?? getOrderLineCalculation(line);
                          const billableQty = lineCalc.billableQty;
                          const lineTotal = lineCalc.total;

                          // Проверка изменения цены в каталоге
                          const currentCatItem = line.price_item_id
                            ? priceItemsById.get(line.price_item_id)
                            : null;
                          const hasPriceChange =
                            currentCatItem && currentCatItem.price !== Number(line.unit_price);

                          return (
                            <div
                              key={line.id}
                              className="group flex flex-col justify-between rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 text-xs transition-colors hover:bg-stone-100/60 sm:flex-row sm:items-center"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-stone-900">
                                    {line.name}
                                  </span>
                                  {line.is_manual && (
                                    <span className="rounded-md bg-stone-200/80 px-1.5 py-0.2 text-[10px] font-medium text-stone-600">
                                      ручная
                                    </span>
                                  )}
                                  {line.counts_for_technolog && (
                                    <span className="rounded-md bg-blue-100 px-1.5 py-0.2 text-[10px] font-medium text-blue-700">
                                      технолог
                                    </span>
                                  )}
                                  {line.waste_pct > 0 && (
                                    <span className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[10px] font-medium text-amber-800">
                                      +{(Number(line.waste_pct) * 100).toFixed(0)}% отход
                                    </span>
                                  )}
                                </div>

                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                                  <span>
                                    {line.qty} {line.unit} × {formatKzt(line.unit_price)} ₸
                                  </span>
                                  {line.billable_qty_rounding === "ceil_to_unit" && (
                                    <span>(округление до целого: {billableQty} {line.unit})</span>
                                  )}
                                  {line.comment && (
                                    <span className="italic text-stone-400 truncate max-w-[200px]">
                                      «{line.comment}»
                                    </span>
                                  )}
                                </div>

                                {hasPriceChange && (
                                  <div className="mt-1 text-[11px] font-semibold text-amber-700">
                                    ⚠️ В прайсе сейчас {formatKzt(currentCatItem.price)} ₸
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-200/40 pt-1.5 sm:mt-0 sm:border-0 sm:pt-0">
                                <span className="font-bold text-stone-900 text-sm">
                                  {formatKzt(lineTotal)} ₸
                                </span>

                                {!locked && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditLine(line)}
                                      className="p-1 text-stone-400 hover:text-stone-700"
                                      title="Редактировать"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteLine(line.id)}
                                      className="p-1 text-rose-400 hover:text-rose-700"
                                      title="Удалить"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* СЕКЦИЯ 3: КОРРЕКТИРОВКИ (СКИДКИ, СРОЧНОСТЬ, РИСК) */}
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  {calcMode === "check_contract"
                    ? `Корректировки себестоимости (${getVisibleAdjustments(adjustments, calcMode).length})`
                    : `Корректировки (${adjustments.length})`}
                </h2>
                <p className="text-xs text-stone-500">
                  {calcMode === "check_contract"
                    ? "Дополнительные затраты (к себестоимости). Скидки к цене в режиме договора скрыты."
                    : "Скидки клиенту, наценка за срочность, непредвиденные расходы"}
                </p>
              </div>

              {!locked && (
                <button
                  type="button"
                  disabled={Boolean(networkError)}
                  onClick={handleOpenAddAdjustment}
                  className="flex min-h-10 items-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
                >
                  <span>+</span>
                  <span>{calcMode === "check_contract" ? "Корректировка затрат" : "Корректировка"}</span>
                </button>
              )}
            </div>

            {getVisibleAdjustments(adjustments, calcMode).length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-3 text-center text-xs text-stone-400">
                {calcMode === "check_contract"
                  ? "Корректировок себестоимости нет"
                  : "Корректировок нет"}
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {getVisibleAdjustments(adjustments, calcMode).map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900">{adj.label}</span>
                        <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-700">
                          {adj.kind === "price" ? "к цене" : "к затратам"}
                        </span>
                      </div>
                      {adj.comment && (
                        <p className="text-[11px] text-stone-500 italic">{adj.comment}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-sm ${
                          adj.amount < 0 ? "text-emerald-700" : "text-stone-900"
                        }`}
                      >
                        {adj.amount > 0 ? `+${formatKzt(adj.amount)}` : formatKzt(adj.amount)} ₸
                      </span>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteAdjustment(adj.id)}
                          className="p-1 text-rose-400 hover:text-rose-700"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* СЕКЦИЯ 4: ПЕРЕОПРЕДЕЛЕНИЕ ПАРАМЕТРОВ ДЛЯ ЭТОГО ЗАКАЗА */}
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <button
              type="button"
              onClick={() => setIsParamsAccordionOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left text-xs font-bold text-stone-800"
            >
              <span>⚙️ Индивидуальные параметры расчёта заказа</span>
              <span>{isParamsAccordionOpen ? "▲ Скрыть" : "▼ Настроить"}</span>
            </button>

            {isParamsAccordionOpen && (
              <div className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-3">
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Целевая маржа (по умолч. {formatPercent(globalParams.target_margin_pct)})
                    </label>
                    <input
                      type="text"
                      placeholder="18%"
                      value={customMargin}
                      onChange={(e) => setCustomMargin(e.target.value)}
                      disabled={locked}
                      className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Режим сборки
                    </label>
                    <select
                      value={customAssemblyMode}
                      onChange={(e) =>
                        setCustomAssemblyMode(
                          e.target.value as "default" | "percent" | "per_meter"
                        )
                      }
                      disabled={locked}
                      className="min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 focus:border-emerald-800"
                    >
                      <option value="default">
                        По умолчанию ({globalParams.assembly_mode === "percent" ? "Процент" : "За метр"})
                      </option>
                      <option value="percent">Процент от цены</option>
                      <option value="per_meter">За погонный метр</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Сборка, % (по умолч. {formatPercent(globalParams.assembly_pct)})
                    </label>
                    <input
                      type="text"
                      placeholder="14,5%"
                      value={customAssemblyPct}
                      onChange={(e) => setCustomAssemblyPct(e.target.value)}
                      disabled={locked}
                      className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Технолог, % (по умолч. {formatPercent(globalParams.technolog_pct)})
                    </label>
                    <input
                      type="text"
                      placeholder="4%"
                      value={customTechnologPct}
                      onChange={(e) => setCustomTechnologPct(e.target.value)}
                      disabled={locked}
                      className="min-h-10 w-full rounded-xl border border-stone-300 px-3 py-1.5 focus:border-emerald-800"
                    />
                  </div>
                </div>

                {!locked && (
                  <button
                    type="button"
                    disabled={paramsSaving}
                    onClick={handleSaveOrderSettings}
                    className="self-end min-h-10 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
                  >
                    {paramsSaving ? "Сохранение…" : "Применить параметры к заказу"}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ЗАКРЕПЛЁННАЯ СВОДКА РАСЧЁТА (STICKY BOTTOM BAR) */}
      {orderTab === "calc" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-300/80 bg-white/95 backdrop-blur-md shadow-2xl safe-bottom">
          <div className="mx-auto max-w-4xl px-4 py-3">
            {/* Результаты или Ошибка расчёта */}
            {!displayCalc ? (
              calcOutcome && !calcOutcome.ok ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <strong>Ошибка расчёта:</strong>{" "}
                  {formatCalculationOutcomeError(calcOutcome.error)}
                </div>
              ) : null
            ) : (
              <div>
                {/* Предупреждения расчёта */}
                {displayCalc.warnings.length > 0 && (
                  <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-medium text-amber-900">
                    ⚠️ {displayCalc.warnings.join("; ")}
                  </div>
                )}

                {/* Несоответствие цены договора в заказе и сохранённой версии (Step A1) */}
                {displayCalc.contractPriceMismatch && (
                  <div className="mb-2 rounded-lg border border-amber-400 bg-amber-50 p-2 text-xs font-semibold text-amber-950">
                    ⚠️ Цена договора в заказе ({formatKzt(displayCalc.contractPriceMismatch.current)} ₸) отличается от версии №{displayCalc.version} ({formatKzt(displayCalc.contractPriceMismatch.snapshot)} ₸). Сохраните новую версию или пересчитайте по актуальным данным.
                  </div>
                )}

                {/* Сообщение об успешном сохранении (U5) */}
                {calcSaveSuccess && (
                  <div className="mb-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs font-bold text-emerald-900">
                    ✓ {calcSaveSuccess}
                  </div>
                )}

                {/* Основные цифры (крупно) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 items-baseline gap-2 sm:gap-4">
                    <div>
                      <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                        Цена ({calcMode === "quote" ? "расчёт" : "договор"})
                      </span>
                      <span className="text-lg sm:text-2xl font-extrabold text-stone-900">
                        {formatKzt(displayCalc.priceTotal)} ₸
                      </span>
                    </div>

                    <div className="border-l border-stone-200 pl-2 sm:pl-4">
                      <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                        Себестоимость
                      </span>
                      <span className="text-sm sm:text-base font-bold text-stone-700">
                        {formatKzt(displayCalc.costTotal)} ₸
                      </span>
                    </div>

                    <div className="border-l border-stone-200 pl-2 sm:pl-4">
                      <span className="block text-[10px] text-stone-500 uppercase tracking-wide">
                        Маржа
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm sm:text-base font-bold text-emerald-900">
                          {formatKzt(displayCalc.margin)} ₸
                        </span>
                        {displayCalc.marginPct !== null && (
                          <span className="text-xs font-semibold text-emerald-700">
                            ({formatPercent(displayCalc.marginPct)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Кнопки действий: Сохранить расчёт и Сводка */}
                  <div className="flex items-center gap-1.5">
                    {!locked ? (
                      <button
                        type="button"
                        disabled={calcSaving || Boolean(networkError)}
                        onClick={handleSaveCalculation}
                        className="min-h-11 rounded-xl bg-emerald-900 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-950 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={networkError ? "Сохранение заблокировано из-за сетевой ошибки" : "Зафиксировать версию расчёта в базе"}
                      >
                        {calcSaving ? "Сохранение…" : "💾 Сохранить"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsUnlockModalOpen(true)}
                        className="min-h-11 rounded-xl bg-amber-900 px-3 text-xs font-bold text-white shadow-xs hover:bg-amber-950 active:scale-95"
                        title="Создать новую версию расчёта"
                      >
                        🔒 Новая версия
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowBreakdown((prev) => !prev)}
                      className="min-h-11 rounded-xl border border-stone-300 bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-95"
                    >
                      {showBreakdown ? "Скрыть ▲" : "Сводка ▼"}
                    </button>
                  </div>
                </div>

                {/* Плашка источника расчёта (Step A6, Q2) */}
                {calculations.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/90 px-3 py-1.5 text-xs text-stone-700">
                    <div className="flex items-center gap-1.5">
                      {displayCalc.source === "saved" ? (
                        <>
                          <span>📌</span>
                          <span>
                            Отображается расчёт из версии №{displayCalc.version} от{" "}
                            {displayCalc.createdAt
                              ? new Date(displayCalc.createdAt).toLocaleDateString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                            {displayCalc.isContractBaseline && " (договорная)"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span className="font-semibold text-amber-900">
                            Превью расчёта по актуальным параметрам (не сохранено в истории)
                          </span>
                        </>
                      )}
                    </div>

                    <div>
                      {displayCalc.source === "saved" ? (
                        <button
                          type="button"
                          onClick={() => setShowLivePreview(true)}
                          className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-50 active:scale-95 transition-all"
                        >
                          🔄 Пересчитать по актуальным параметрам
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowLivePreview(false)}
                          className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 active:scale-95 transition-all"
                        >
                          Вернуться к версии №{getPlanCalculation(calculations)?.version}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Раскрывающаяся подробная сводка */}
                {showBreakdown && (
                  <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs divide-y divide-stone-200">
                    <div className="pb-2">
                      <span className="font-bold text-stone-800">
                        Фиксированные расходы: {formatKzt(displayCalc.fixedCost)} ₸
                      </span>
                      <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-stone-600">
                        <span>Материалы: {formatKzt(displayCalc.categoryTotals.materials)} ₸</span>
                        <span>Фасады: {formatKzt(displayCalc.categoryTotals.facades)} ₸</span>
                        <span>Цех: {formatKzt(displayCalc.categoryTotals.workshop)} ₸</span>
                        <span>Фурнитура: {formatKzt(displayCalc.categoryTotals.hardware)} ₸</span>
                        <span>Транспорт: {formatKzt(displayCalc.categoryTotals.transport)} ₸</span>
                        <span>Работа: {formatKzt(displayCalc.categoryTotals.labor)} ₸</span>
                        <span>Остальное: {formatKzt(displayCalc.categoryTotals.other)} ₸</span>
                        <span>Корректировки: {formatKzt(displayCalc.categoryTotals.adjustments)} ₸</span>
                      </div>
                    </div>

                    <div className="py-2 text-[11px] text-stone-700 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Сборка: {formatKzt(displayCalc.assembly)} ₸</span>
                      <span>Технолог: {formatKzt(displayCalc.technolog)} ₸</span>
                      <span>Резерв на риск: {formatKzt(displayCalc.riskReserve)} ₸</span>
                      <span className="font-semibold">
                        Мин. цена для целевой маржи: {formatKzt(displayCalc.minPriceForTargetMargin)} ₸
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* МОДАЛКА 1: РЕДАКТИРОВАНИЕ ШАПКИ ЗАКАЗА */}
      {isEditingHeader && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Изменение заказа</h3>
              <button
                type="button"
                onClick={() => setIsEditingHeader(false)}
                className="text-stone-400 hover:text-stone-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {headerError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {headerError}
              </div>
            )}

            <form onSubmit={handleSaveHeader} className="mt-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Название заказа <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Клиент / метка
                </label>
                <input
                  type="text"
                  value={headerClient}
                  onChange={(e) => setHeaderClient(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Статус заказа
                </label>
                <select
                  value={headerStatus}
                  onChange={(e) => setHeaderStatus(e.target.value as OrderStatus)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {ORDER_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Цена по договору (₸)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={headerContractPrice}
                  onChange={(e) => setHeaderContractPrice(e.target.value)}
                  placeholder="850 000"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Заметка
                </label>
                <textarea
                  rows={2}
                  value={headerNote}
                  onChange={(e) => setHeaderNote(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>

              <div className="mt-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingHeader(false)}
                  disabled={headerSaving}
                  className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={headerSaving}
                  className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
                >
                  {headerSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* МОДАЛКИ (U0) */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        editingItem={editingItem}
        itemKind={itemKind}
        setItemKind={setItemKind}
        itemTitle={itemTitle}
        setItemTitle={setItemTitle}
        itemMeters={itemMeters}
        setItemMeters={setItemMeters}
        itemDesc={itemDesc}
        setItemDesc={setItemDesc}
        itemError={itemError}
        itemSaving={itemSaving}
        onSave={handleSaveItem}
      />

      <PricePickerModal
        isOpen={isPricePickerOpen}
        onClose={() => setIsPricePickerOpen(false)}
        selectedPriceItem={selectedPriceItem}
        setSelectedPriceItem={setSelectedPriceItem}
        pickerSearch={pickerSearch}
        setPickerSearch={setPickerSearch}
        pickerCategory={pickerCategory}
        setPickerCategory={setPickerCategory}
        filteredCatalogItems={filteredCatalogItems}
        handleSelectPriceItem={handleSelectPriceItem}
        pickerQty={pickerQty}
        setPickerQty={setPickerQty}
        pickerWaste={pickerWaste}
        setPickerWaste={setPickerWaste}
        items={items}
        pickerItemId={pickerItemId}
        setPickerItemId={setPickerItemId}
        pickerComment={pickerComment}
        setPickerComment={setPickerComment}
        pickerError={pickerError}
        pickerSaving={pickerSaving}
        onAdd={handleAddPriceItemToOrder}
      />

      <ManualLineModal
        isOpen={isManualLineModalOpen}
        onClose={() => setIsManualLineModalOpen(false)}
        editingLine={editingLine}
        manualCategory={manualCategory}
        setManualCategory={setManualCategory}
        manualName={manualName}
        setManualName={setManualName}
        manualUnit={manualUnit}
        setManualUnit={setManualUnit}
        manualUnitPrice={manualUnitPrice}
        setManualUnitPrice={setManualUnitPrice}
        manualQty={manualQty}
        setManualQty={setManualQty}
        manualWaste={manualWaste}
        setManualWaste={setManualWaste}
        manualTechnolog={manualTechnolog}
        setManualTechnolog={setManualTechnolog}
        manualRounding={manualRounding}
        setManualRounding={setManualRounding}
        items={items}
        manualItemId={manualItemId}
        setManualItemId={setManualItemId}
        manualComment={manualComment}
        setManualComment={setManualComment}
        manualError={manualError}
        manualSaving={manualSaving}
        onSave={handleSaveManualLine}
      />

      <AdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        calcMode={calcMode}
        adjKind={adjKind}
        setAdjKind={setAdjKind}
        adjLabel={adjLabel}
        setAdjLabel={setAdjLabel}
        adjAmount={adjAmount}
        setAdjAmount={setAdjAmount}
        adjComment={adjComment}
        setAdjComment={setAdjComment}
        adjError={adjError}
        adjSaving={adjSaving}
        onSave={handleSaveAdjustment}
      />

      <PriceDiffModal
        isOpen={isPriceDiffModalOpen}
        onClose={() => setIsPriceDiffModalOpen(false)}
        priceDiff={priceDiff}
        isUpdating={isUpdatingPrices}
        onConfirm={handleConfirmPriceUpdates}
      />

      <UnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        statusLabel={statusLabel}
        isSaving={unlockSaving}
        onConfirm={handleConfirmCreateNewVersion}
      />
    </div>
  );
}
