import { useEffect, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { formatErrorMessage } from "../lib/errors";
import {
  checkOrderLoadCriticalErrors,
  isOrderLocked,
  mergeOrderParameters,
  validateOrderInput,
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
  type Order,
  type OrderAdjustment,
  type OrderCalculation,
  type OrderItem,
  type OrderLine,
  type OrderStatus,
  type ParameterItem,
  type Payment,
  type PriceItem,
} from "../types/database";
import { MAX_PRICE_SHARES_SUM } from "@kuhni/calc";

export function useOrderData(orderId: string) {
  const dialog = useDialog();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [adjustments, setAdjustments] = useState<OrderAdjustment[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [globalParams, setGlobalParams] = useState<ParametersMap>(DEFAULT_PARAMETERS);
  const [expenses, setExpenses] = useState<ActualExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [calculations, setCalculations] = useState<OrderCalculation[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Шапка заказа
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");
  const [headerClient, setHeaderClient] = useState("");
  const [headerStatus, setHeaderStatus] = useState<OrderStatus>("draft");
  const [headerContractPrice, setHeaderContractPrice] = useState("");
  const [headerNote, setHeaderNote] = useState("");
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // Параметры заказа
  const [isParamsAccordionOpen, setIsParamsAccordionOpen] = useState(false);
  const [customMargin, setCustomMargin] = useState("");
  const [customAssemblyMode, setCustomAssemblyMode] = useState<"default" | "percent" | "per_meter">("default");
  const [customAssemblyPct, setCustomAssemblyPct] = useState("");
  const [customTechnologMode, setCustomTechnologMode] = useState<"default" | "percent" | "per_sheet">("default");
  const [customTechnologPct, setCustomTechnologPct] = useState("");
  const [customRiskReservePct, setCustomRiskReservePct] = useState("");
  const [paramsSaving, setParamsSaving] = useState(false);

  async function loadOrderData() {
    try {
      setLoading(true);
      setError(null);
      setNetworkError(null);
      const supabase = getSupabase();

      const { data: ordData, error: ordErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (ordErr || !ordData) {
        throw new Error(ordErr?.message ?? "Заказ не найден");
      }

      setOrder(ordData as Order);

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
        setGlobalParams(parametersArrayToMap(paramsRes.data as ParameterItem[]));
      }

      const s = (ordData.settings || {}) as Record<string, unknown>;
      setCustomMargin(typeof s.target_margin_pct === "number" ? formatPercent(s.target_margin_pct) : "");
      setCustomAssemblyMode(s.assembly_mode === "percent" || s.assembly_mode === "per_meter" ? s.assembly_mode : "default");
      setCustomAssemblyPct(typeof s.assembly_pct === "number" ? formatPercent(s.assembly_pct) : "");
      setCustomTechnologMode(s.technolog_mode === "percent" || s.technolog_mode === "per_sheet" ? s.technolog_mode : "default");
      setCustomTechnologPct(typeof s.technolog_pct === "number" ? formatPercent(s.technolog_pct) : "");
      setCustomRiskReservePct(typeof s.risk_reserve_pct === "number" ? formatPercent(s.risk_reserve_pct) : "");
    } catch (err: unknown) {
      setError(formatErrorMessage(err, "Не удалось загрузить данные заказа."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrderData();
  }, [orderId]);

  const locked = order ? isOrderLocked(order.status) : false;
  const statusConfig = (order && ORDER_STATUS_COLORS[order.status]) ?? ORDER_STATUS_COLORS.draft;
  const statusLabel = (order && ORDER_STATUS_LABELS[order.status]) ?? (order?.status ?? "draft");

  function handleOpenEditHeader() {
    if (!order) return;
    setHeaderName(order.name);
    setHeaderClient(order.client_label || "");
    setHeaderStatus(order.status);
    setHeaderContractPrice(order.contract_price !== null ? String(order.contract_price) : "");
    setHeaderNote(order.note || "");
    setHeaderError(null);
    setIsEditingHeader(true);
  }

  async function handleSaveHeader(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const contractPriceNum = headerContractPrice.trim() ? Number(headerContractPrice.replace(/\s+/g, "")) : null;
    const validation = validateOrderInput({ name: headerName, contract_price: contractPriceNum });
    if (!validation.valid) {
      setHeaderError(validation.error ?? "Проверьте введённые данные.");
      return;
    }
    try {
      setHeaderSaving(true);
      setHeaderError(null);
      const res = await getSupabase()
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
      setOrder(assertSingleRowAffected<Order>(res));
      setIsEditingHeader(false);
    } catch (err: unknown) {
      setHeaderError(formatErrorMessage(err, "Ошибка при сохранении."));
    } finally {
      setHeaderSaving(false);
    }
  }

  async function handleSaveOrderSettings() {
    if (!order || locked) return;
    try {
      setParamsSaving(true);
      const newSettings: Record<string, unknown> = {};
      const marginParsed = parsePercent(customMargin);
      if (marginParsed !== null) newSettings.target_margin_pct = marginParsed;
      if (customAssemblyMode !== "default") newSettings.assembly_mode = customAssemblyMode;
      const assemblyParsed = parsePercent(customAssemblyPct);
      if (assemblyParsed !== null) newSettings.assembly_pct = assemblyParsed;
      if (customTechnologMode !== "default") newSettings.technolog_mode = customTechnologMode;
      const techParsed = parsePercent(customTechnologPct);
      if (techParsed !== null) newSettings.technolog_pct = techParsed;
      const riskParsed = parsePercent(customRiskReservePct);
      if (riskParsed !== null) newSettings.risk_reserve_pct = riskParsed;

      const mergedParams = mergeOrderParameters(globalParams, newSettings);
      const assemblyShare = mergedParams.assemblyMode === "percent" ? mergedParams.assemblyPct : 0;
      const technologShare = mergedParams.technologMode === "percent" ? mergedParams.technologPct : 0;
      const sumShares = mergedParams.targetMarginPct + assemblyShare + technologShare + mergedParams.riskReservePct;

      if (sumShares > MAX_PRICE_SHARES_SUM) {
        await dialog.alert({
          title: "Ошибка",
          message: `Сумма процентных ставок (${(sumShares * 100).toFixed(1)}%) превышает максимально допустимые ${(MAX_PRICE_SHARES_SUM * 100).toFixed(0)}%. Уменьшите маржу или другие ставки.`,
          variant: "error",
        });
        return;
      }

      const res = await getSupabase()
        .from("orders")
        .update({ settings: newSettings, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .select();
      setOrder(assertSingleRowAffected<Order>(res));
    } catch (err) {
      await dialog.alert({ title: "Ошибка", message: "Ошибка сохранения параметров: " + formatErrorMessage(err), variant: "error" });
    } finally {
      setParamsSaving(false);
    }
  }

  return {
    order,
    setOrder,
    items,
    setItems,
    lines,
    setLines,
    adjustments,
    setAdjustments,
    priceItems,
    globalParams,
    expenses,
    setExpenses,
    payments,
    setPayments,
    calculations,
    setCalculations,
    loading,
    error,
    networkError,
    locked,
    statusConfig,
    statusLabel,
    loadOrderData,
    // Header modal & state
    isEditingHeader,
    setIsEditingHeader,
    headerName,
    setHeaderName,
    headerClient,
    setHeaderClient,
    headerStatus,
    setHeaderStatus,
    headerContractPrice,
    setHeaderContractPrice,
    headerNote,
    setHeaderNote,
    headerSaving,
    headerError,
    handleOpenEditHeader,
    handleSaveHeader,
    // Settings state
    isParamsAccordionOpen,
    setIsParamsAccordionOpen,
    customMargin,
    setCustomMargin,
    customAssemblyMode,
    setCustomAssemblyMode,
    customAssemblyPct,
    setCustomAssemblyPct,
    customTechnologMode,
    setCustomTechnologMode,
    customTechnologPct,
    setCustomTechnologPct,
    customRiskReservePct,
    paramsSaving,
    handleSaveOrderSettings,
  };
}
