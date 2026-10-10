import { useEffect, useMemo, useState } from "react";

import { FactTab } from "../components/FactTab";
import {
  AdjustmentsSection,
  HistoryTab,
  ItemsSection,
  LinesSection,
  OrderHeader,
  OrderParametersAccordion,
  SummaryBar,
} from "../components/order";
import { useDialog } from "../components/DialogProvider";
import {
  AdjustmentModal,
  ItemModal,
  ManualLineModal,
  OrderHeaderModal,
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
  getLineCalculationsMap,
  isOrderLocked,
  mergeOrderParameters,
  prepareCalculationSnapshot,
  resolveOrderDisplayCalculation,
  shouldConfirmCalculationSave,
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
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
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
      {/* Верхняя навигация, статус, ошибки и вкладки */}
      <OrderHeader
        order={order}
        statusConfig={statusConfig}
        statusLabel={statusLabel}
        locked={locked}
        networkError={networkError}
        copySuccess={copySuccess}
        orderTab={orderTab}
        linesCount={lines.length}
        calculationsCount={calculations.length}
        factCount={expenses.length + payments.length}
        onBack={onBack}
        onOpenEditHeader={handleOpenEditHeader}
        onRetryLoad={() => void loadOrderData()}
        onOpenUnlockModal={() => setIsUnlockModalOpen(true)}
        onCopySummary={handleCopySummary}
        onSelectTab={setOrderTab}
      />

      {orderTab === "history" && (
        <HistoryTab
          calculations={calculations}
          locked={locked}
          calcSaving={calcSaving}
          networkError={networkError}
          calcSaveSuccess={calcSaveSuccess}
          calcOutcome={calcOutcome}
          expandedVersionId={expandedVersionId}
          setExpandedVersionId={setExpandedVersionId}
          onSaveCalculation={handleSaveCalculation}
          onSetBaseline={handleSetBaseline}
        />
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

          <ItemsSection
            items={items}
            lines={lines}
            locked={locked}
            networkError={networkError}
            onOpenAddItem={handleOpenAddItem}
            onOpenEditItem={handleOpenEditItem}
            onDeleteItem={(id) => void handleDeleteItem(id)}
          />

          <LinesSection
            lines={lines}
            categoryTotals={categoryTotals as Record<string, number> | null | undefined}
            lineCalculationsById={lineCalculationsById}
            priceItemsById={priceItemsById}
            locked={locked}
            networkError={networkError}
            onOpenPricePicker={handleOpenPricePicker}
            onOpenAddManualLine={handleOpenAddManualLine}
            onOpenEditLine={handleOpenEditLine}
            onDeleteLine={(id) => void handleDeleteLine(id)}
          />

          <AdjustmentsSection
            adjustments={adjustments}
            calcMode={calcMode}
            locked={locked}
            networkError={networkError}
            onOpenAddAdjustment={handleOpenAddAdjustment}
            onDeleteAdjustment={(id) => void handleDeleteAdjustment(id)}
          />

          <OrderParametersAccordion
            isOpen={isParamsAccordionOpen}
            setIsOpen={setIsParamsAccordionOpen}
            globalParams={globalParams}
            customMargin={customMargin}
            setCustomMargin={setCustomMargin}
            customAssemblyMode={customAssemblyMode}
            setCustomAssemblyMode={setCustomAssemblyMode}
            customAssemblyPct={customAssemblyPct}
            setCustomAssemblyPct={setCustomAssemblyPct}
            customTechnologPct={customTechnologPct}
            setCustomTechnologPct={setCustomTechnologPct}
            locked={locked}
            paramsSaving={paramsSaving}
            onSaveOrderSettings={handleSaveOrderSettings}
          />
        </>
      )}

      {/* ЗАКРЕПЛЁННАЯ СВОДКА РАСЧЁТА (STICKY BOTTOM BAR) */}
      {orderTab === "calc" && (
        <SummaryBar
          displayCalc={displayCalc}
          calcOutcome={calcOutcome}
          calcMode={calcMode}
          calcSaveSuccess={calcSaveSuccess}
          locked={locked}
          calcSaving={calcSaving}
          networkError={networkError}
          showBreakdown={showBreakdown}
          setShowBreakdown={setShowBreakdown}
          calculations={calculations}
          onSaveCalculation={handleSaveCalculation}
          onOpenUnlockModal={() => setIsUnlockModalOpen(true)}
          onSetShowLivePreview={setShowLivePreview}
        />
      )}

      {/* МОДАЛКА 1: РЕДАКТИРОВАНИЕ ШАПКИ ЗАКАЗА */}
      <OrderHeaderModal
        isOpen={isEditingHeader}
        onClose={() => setIsEditingHeader(false)}
        headerName={headerName}
        setHeaderName={setHeaderName}
        headerClient={headerClient}
        setHeaderClient={setHeaderClient}
        headerStatus={headerStatus}
        setHeaderStatus={setHeaderStatus}
        headerContractPrice={headerContractPrice}
        setHeaderContractPrice={setHeaderContractPrice}
        headerNote={headerNote}
        setHeaderNote={setHeaderNote}
        headerSaving={headerSaving}
        headerError={headerError}
        onSave={handleSaveHeader}
      />
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
