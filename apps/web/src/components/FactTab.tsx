import { useMemo, useState } from "react";

import { formatErrorMessage } from "../lib/errors";
import { formatKzt } from "../lib/money";
import { formatPercent } from "../lib/parameters";
import { getLocalTodayDateString } from "../lib/date";
import {
  buildPlanFactRows,
  computeOrderFinancialSummary,
  toCalculationResultLike,
  validateExpenseInput,
  validatePaymentInput,
} from "../lib/actuals";
import { getPlanCalculation } from "../lib/orders";
import { assertSingleRowAffected, getSupabase } from "../lib/supabase";
import { useDialog } from "./DialogProvider";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type ActualExpense,
  type Order,
  type OrderCalculation,
  type Payment,
  type PriceCategory,
} from "../types/database";
import {
  isDemoModeActive,
  demoSaveExpense,
  demoDeleteExpense,
  demoSavePayment,
  demoDeletePayment,
} from "../lib/demo-data";

interface FactTabProps {
  order: Order;
  expenses: ActualExpense[];
  payments: Payment[];
  calculations: OrderCalculation[];
  onExpensesChange: (expenses: ActualExpense[]) => void;
  onPaymentsChange: (payments: Payment[]) => void;
  onBackToQuote?: () => void;
}

export function FactTab({
  order,
  expenses,
  payments,
  calculations,
  onExpensesChange,
  onPaymentsChange,
  onBackToQuote,
}: FactTabProps) {
  const dialog = useDialog();

  const [expandedSection, setExpandedSection] = useState<string | null>("plan_fact");

  // --- Добавление расхода (в пространственной шторке) ---
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [expDate, setExpDate] = useState(() => getLocalTodayDateString());
  const [expCategory, setExpCategory] = useState<PriceCategory>("materials");
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expIsRework, setExpIsRework] = useState(false);
  const [expReworkReason, setExpReworkReason] = useState("");
  const [expNote, setExpNote] = useState("");
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // --- Добавление поступления (в пространственной шторке) ---
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [payDate, setPayDate] = useState(() => getLocalTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const planCalc = useMemo(() => {
    return getPlanCalculation(calculations);
  }, [calculations]);

  const planFactRows = useMemo(() => {
    if (!planCalc) return [];
    return buildPlanFactRows(toCalculationResultLike(planCalc.result), expenses);
  }, [planCalc, expenses]);

  const planCostTotal = planCalc ? Number(planCalc.cost_total) : 0;

  const financialSummary = useMemo(() => {
    return computeOrderFinancialSummary({
      contractPrice: order.contract_price,
      expenses,
      payments,
    });
  }, [order.contract_price, expenses, payments]);

  function resetExpenseForm() {
    setExpDate(getLocalTodayDateString());
    setExpCategory("materials");
    setExpName("");
    setExpAmount("");
    setExpIsRework(false);
    setExpReworkReason("");
    setExpNote("");
    setExpError(null);
  }

  function resetPaymentForm() {
    setPayDate(getLocalTodayDateString());
    setPayAmount("");
    setPayNote("");
    setPayError(null);
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(expAmount.replace(/\s+/g, "").replace(/,/g, ".").trim());
    const validation = validateExpenseInput({
      name: expName,
      amount: amountNum,
      category: expCategory,
      is_rework: expIsRework,
      rework_reason: expReworkReason,
    });
    if (!validation.valid) {
      setExpError(validation.error ?? "Проверьте данные.");
      return;
    }

    try {
      setExpSaving(true);
      setExpError(null);

      if (isDemoModeActive()) {
        const newExp: ActualExpense = {
          id: `demo-exp-${Date.now()}`,
          order_id: order.id,
          expense_date: expDate,
          category: expCategory,
          name: expName.trim(),
          amount: amountNum,
          is_rework: expIsRework,
          rework_reason: expIsRework ? expReworkReason.trim() : null,
          note: expNote.trim() || null,
        };
        demoSaveExpense(newExp);
        onExpensesChange([newExp, ...expenses]);
        resetExpenseForm();
        setIsExpenseFormOpen(false);
        setExpandedSection("expenses");
        return;
      }

      const supabase = getSupabase();
      const { data, error: insertErr } = await supabase
        .from("actual_expenses")
        .insert({
          order_id: order.id,
          expense_date: expDate,
          category: expCategory,
          name: expName.trim(),
          amount: amountNum,
          is_rework: expIsRework,
          rework_reason: expIsRework ? expReworkReason.trim() : null,
          note: expNote.trim() || null,
        })
        .select()
        .single();

      if (insertErr) {
        setExpError(formatErrorMessage(insertErr, "Ошибка сохранения расхода."));
      } else if (data) {
        onExpensesChange([...expenses, data as ActualExpense]);
        resetExpenseForm();
        setIsExpenseFormOpen(false);
        setExpandedSection("expenses");
      }
    } catch (err: unknown) {
      setExpError(formatErrorMessage(err, "Ошибка сохранения расхода."));
    } finally {
      setExpSaving(false);
    }
  }

  async function handleDeleteExpense(expId: string) {
    const confirmed = await dialog.confirm({
      title: "Удаление расхода",
      message: "Удалить этот расход?",
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      if (isDemoModeActive()) {
        demoDeleteExpense(order.id, expId);
        onExpensesChange(expenses.filter((e) => e.id !== expId));
        return;
      }

      const supabase = getSupabase();
      const res = await supabase
        .from("actual_expenses")
        .delete()
        .eq("id", expId)
        .select();
      assertSingleRowAffected(res);
      onExpensesChange(expenses.filter((e) => e.id !== expId));
    } catch (err) {
      await dialog.alert({
        title: "Ошибка удаления",
        message: formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(payAmount.replace(/\s+/g, "").replace(/,/g, ".").trim());
    const validation = validatePaymentInput({ amount: amountNum });
    if (!validation.valid) {
      setPayError(validation.error ?? "Проверьте данные.");
      return;
    }

    try {
      setPaySaving(true);
      setPayError(null);

      if (isDemoModeActive()) {
        const newPay: Payment = {
          id: `demo-pay-${Date.now()}`,
          order_id: order.id,
          paid_at: payDate,
          amount: amountNum,
          note: payNote.trim() || null,
        };
        demoSavePayment(newPay);
        onPaymentsChange([newPay, ...payments]);
        resetPaymentForm();
        setIsPaymentFormOpen(false);
        setExpandedSection("payments");
        return;
      }

      const supabase = getSupabase();
      const { data, error: insertErr } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          paid_at: payDate,
          amount: amountNum,
          note: payNote.trim() || null,
        })
        .select()
        .single();

      if (insertErr) {
        setPayError(formatErrorMessage(insertErr, "Ошибка сохранения поступления."));
      } else if (data) {
        onPaymentsChange([...payments, data as Payment]);
        resetPaymentForm();
        setIsPaymentFormOpen(false);
        setExpandedSection("payments");
      }
    } catch (err: unknown) {
      setPayError(formatErrorMessage(err, "Ошибка сохранения поступления."));
    } finally {
      setPaySaving(false);
    }
  }

  async function handleDeletePayment(payId: string) {
    const confirmed = await dialog.confirm({
      title: "Удаление поступления",
      message: "Удалить это поступление?",
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      if (isDemoModeActive()) {
        demoDeletePayment(order.id, payId);
        onPaymentsChange(payments.filter((p) => p.id !== payId));
        return;
      }

      const supabase = getSupabase();
      const res = await supabase
        .from("payments")
        .delete()
        .eq("id", payId)
        .select();
      assertSingleRowAffected(res);
      onPaymentsChange(payments.filter((p) => p.id !== payId));
    } catch (err) {
      await dialog.alert({
        title: "Ошибка удаления",
        message: formatErrorMessage(err),
        variant: "error",
      });
    }
  }

  const anyModalOpen = isExpenseFormOpen || isPaymentFormOpen;

  return (
    <>
      <div
        className={`mx-auto w-full max-w-lg px-5 pt-4 pb-28 sm:py-8 flex flex-col min-h-svh text-zinc-100 select-none ${
          anyModalOpen ? "apple-stage-recessed" : "apple-stage-normal"
        }`}
      >
        {/* 1. Навигационная шапка */}
        <header className="flex items-center justify-between py-2 mb-6">
          {onBackToQuote ? (
            <button
              type="button"
              onClick={onBackToQuote}
              className="inline-flex items-center gap-1 -ml-1.5 px-1.5 py-1 text-[15px] font-normal text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>К смете</span>
            </button>
          ) : (
            <span className="text-[13px] text-zinc-500">План / Факт</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetPaymentForm();
                setIsPaymentFormOpen(true);
              }}
              className="h-8 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[12px] font-medium text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              + Оплата
            </button>
            <button
              type="button"
              onClick={() => {
                resetExpenseForm();
                setIsExpenseFormOpen(true);
              }}
              className="h-8 px-3 rounded-full bg-white text-black hover:bg-zinc-200 text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              + Расход
            </button>
          </div>
        </header>

        {/* 2. Главная цифра: Фактическая прибыль */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="text-[12px] font-medium text-zinc-500 truncate max-w-full">
            {order.name} · План / Факт
          </div>

          <div className="mt-2 inline-flex items-baseline justify-center">
            <span
              className={`text-[46px] sm:text-[52px] leading-[1.04] font-semibold tracking-[-0.035em] tabular-nums ${
                financialSummary.actualProfit >= 0 ? "text-white" : "text-rose-400"
              }`}
            >
              {financialSummary.actualProfit > 0 ? "+" : ""}
              {formatKzt(financialSummary.actualProfit)}
            </span>
            <span className="ml-2 text-[30px] font-light text-zinc-500">₸</span>
          </div>

          <div className="mt-2.5 flex items-center gap-2 text-[13px] text-zinc-400 tabular-nums whitespace-nowrap">
            <span>
              Факт. прибыль{" "}
              {financialSummary.profitMarginPct !== null && (
                <strong className="font-medium text-white">
                  {formatPercent(financialSummary.profitMarginPct)}
                </strong>
              )}
            </span>
            <span className="text-zinc-600">·</span>
            <span>Касса {formatKzt(financialSummary.cashBalance)} ₸</span>
          </div>
        </div>

        {/* 3. Краткая сводка по договору и долгу */}
        <div className="grid grid-cols-3 gap-2 py-3.5 mb-4 border-y border-white/[0.07] text-center">
          <div>
            <span className="block text-[11px] text-zinc-500">Договор</span>
            <span className="mt-0.5 block text-[13px] font-medium text-white tabular-nums whitespace-nowrap">
              {financialSummary.contractPrice > 0
                ? `${formatKzt(financialSummary.contractPrice)} ₸`
                : "—"}
            </span>
          </div>
          <div className="border-x border-white/[0.06]">
            <span className="block text-[11px] text-zinc-500">Оплачено</span>
            <span className="mt-0.5 block text-[13px] font-medium text-emerald-400 tabular-nums whitespace-nowrap">
              {formatKzt(financialSummary.paymentsTotal)} ₸
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-zinc-500">Долг клиента</span>
            <span className="mt-0.5 block text-[13px] font-medium text-amber-300 tabular-nums whitespace-nowrap">
              {financialSummary.contractPrice > 0
                ? `${formatKzt(financialSummary.paymentRemaining)} ₸`
                : "—"}
            </span>
          </div>
        </div>

        {/* 4. Раскрывающиеся разделы (Сверка, Расходы, Оплаты) */}
        <div className="divide-y divide-white/[0.08] border-b border-white/[0.08]">
          {/* РАЗДЕЛ 1: СВЕРКА СО СМЕТОЙ */}
          <div>
            <button
              type="button"
              onClick={() =>
                setExpandedSection((p) => (p === "plan_fact" ? null : "plan_fact"))
              }
              className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 shrink-0" />
                <span className="text-[16px] font-medium text-white">
                  Сверка со сметой
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                <span className="text-[14px] text-zinc-400 tabular-nums">
                  План {formatKzt(planCostTotal)} ₸
                </span>
                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                    expandedSection === "plan_fact" ? "rotate-90 text-zinc-200" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            <div
              className="apple-accordion-grid"
              data-open={expandedSection === "plan_fact"}
            >
              <div className="apple-accordion-inner">
                {expandedSection === "plan_fact" && (
                  <div className="pb-4 pl-5 ml-1 relative divide-y divide-white/[0.05]">
                    <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
                    {!planCalc ? (
                      <div className="py-2 text-[13px] text-zinc-500">
                        Зафиксируйте версию в смете, чтобы сравнить план и факт.
                      </div>
                    ) : (
                      planFactRows.map((row, idx) => {
                        const factVal = row.fact ?? 0;
                        const diffVal = row.diff ?? 0;
                        return (
                          <div
                            key={row.key}
                            style={{ animationDelay: `${idx * 35}ms` }}
                            className="apple-unfold-row py-2.5 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-[14px] text-zinc-200 truncate">
                                {row.label}
                              </div>
                              <div className="text-[11px] text-zinc-500 tabular-nums whitespace-nowrap">
                                План: {formatKzt(row.plan)} ₸ · Факт: {formatKzt(factVal)} ₸
                              </div>
                            </div>
                            <span
                              className={`text-[13px] font-medium tabular-nums whitespace-nowrap shrink-0 ${
                                diffVal > 0
                                  ? "text-rose-400"
                                  : diffVal < 0
                                  ? "text-emerald-400"
                                  : "text-zinc-500"
                              }`}
                            >
                              {diffVal > 0 ? `+${formatKzt(diffVal)} ₸` : diffVal < 0 ? `${formatKzt(diffVal)} ₸` : "0 ₸"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* РАЗДЕЛ 2: ФАКТИЧЕСКИЕ РАСХОДЫ */}
          <div>
            <button
              type="button"
              onClick={() =>
                setExpandedSection((p) => (p === "expenses" ? null : "expenses"))
              }
              className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[16px] font-medium text-white">
                  Расходы
                </span>
                <span className="text-[13px] text-zinc-500 tabular-nums">
                  {expenses.length}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                <span className="text-[16px] font-medium text-white tabular-nums">
                  {formatKzt(financialSummary.totalExpenses)} ₸
                </span>
                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                    expandedSection === "expenses" ? "rotate-90 text-zinc-200" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            <div
              className="apple-accordion-grid"
              data-open={expandedSection === "expenses"}
            >
              <div className="apple-accordion-inner">
                {expandedSection === "expenses" && (
                  <div className="pb-4 pl-5 ml-1 relative divide-y divide-white/[0.05]">
                    <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-amber-400/40 via-white/10 to-transparent" />
                    {expenses.length === 0 ? (
                      <div className="py-2 text-[13px] text-zinc-500">
                        Расходы ещё не внесены
                      </div>
                    ) : (
                      expenses.map((exp, idx) => (
                        <div
                          key={exp.id}
                          style={{ animationDelay: `${idx * 35}ms` }}
                          className="apple-unfold-row py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-[14px] text-zinc-100 truncate">
                              {exp.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 whitespace-nowrap">
                              {CATEGORY_LABELS[exp.category]}
                              {exp.is_rework ? " · Переделка" : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`text-[14px] font-medium tabular-nums whitespace-nowrap ${
                                exp.is_rework ? "text-rose-400" : "text-white"
                              }`}
                            >
                              {formatKzt(exp.amount)} ₸
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleDeleteExpense(exp.id)}
                              className="text-zinc-600 hover:text-rose-400 p-1 text-xs cursor-pointer"
                              title="Удалить"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* РАЗДЕЛ 3: ОПЛАТЫ КЛИЕНТА */}
          <div>
            <button
              type="button"
              onClick={() =>
                setExpandedSection((p) => (p === "payments" ? null : "payments"))
              }
              className="w-full py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[16px] font-medium text-white">
                  Оплаты
                </span>
                <span className="text-[13px] text-zinc-500 tabular-nums">
                  {payments.length}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                <span className="text-[16px] font-medium text-emerald-400 tabular-nums">
                  +{formatKzt(financialSummary.paymentsTotal)} ₸
                </span>
                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                    expandedSection === "payments" ? "rotate-90 text-zinc-200" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            <div
              className="apple-accordion-grid"
              data-open={expandedSection === "payments"}
            >
              <div className="apple-accordion-inner">
                {expandedSection === "payments" && (
                  <div className="pb-4 pl-5 ml-1 relative divide-y divide-white/[0.05]">
                    <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-emerald-400/40 via-white/10 to-transparent" />
                    {payments.length === 0 ? (
                      <div className="py-2 text-[13px] text-zinc-500">
                        Поступлений пока нет
                      </div>
                    ) : (
                      payments.map((pay, idx) => (
                        <div
                          key={pay.id}
                          style={{ animationDelay: `${idx * 35}ms` }}
                          className="apple-unfold-row py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-[14px] text-zinc-100 truncate">
                              {pay.note || "Оплата по договору"}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {new Date(pay.paid_at).toLocaleDateString("ru-RU", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[14px] font-medium text-emerald-400 tabular-nums whitespace-nowrap">
                              +{formatKzt(pay.amount)} ₸
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleDeletePayment(pay.id)}
                              className="text-zinc-600 hover:text-rose-400 p-1 text-xs cursor-pointer"
                              title="Удалить"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ШТОРКА ДОБАВЛЕНИЯ РАСХОДА */}
      {isExpenseFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setIsExpenseFormOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-spatial-sheet apple-glass-glint w-full max-w-md rounded-t-[24px] sm:rounded-[24px] bg-[#141418] border-t sm:border border-white/[0.12] p-6 pb-8 text-zinc-100 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
              <h3 className="text-[17px] font-semibold text-white">Новый расход</h3>
              <button
                type="button"
                onClick={() => setIsExpenseFormOpen(false)}
                className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveExpense(e)} className="mt-4 space-y-4">
              {expError && (
                <div className="border-l-2 border-rose-500 bg-rose-500/5 pl-3 py-2 text-xs text-rose-300">
                  {expError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-zinc-400 mb-1">Категория</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as PriceCategory)}
                    className="w-full h-10 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[13px] text-white focus:outline-hidden"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-zinc-900">
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-zinc-400 mb-1">Дата</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full h-10 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[13px] text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-zinc-400 mb-1">Наименование</label>
                <input
                  type="text"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="Например: Докупка петель Blum"
                  className="w-full h-10 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[14px] text-white placeholder-zinc-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[12px] text-zinc-400 mb-1">Сумма (₸)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="15000"
                  className="w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[18px] font-semibold text-white tabular-nums placeholder-zinc-600 focus:outline-hidden"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={expIsRework}
                  onChange={(e) => setExpIsRework(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-rose-500"
                />
                <span className="text-[13px] text-zinc-300">Это переделка (брак / ошибка)</span>
              </label>

              {expIsRework && (
                <input
                  type="text"
                  value={expReworkReason}
                  onChange={(e) => setExpReworkReason(e.target.value)}
                  placeholder="Укажите причину переделки *"
                  className="w-full h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 text-[13px] text-white placeholder-rose-300/60 focus:outline-hidden"
                />
              )}

              <button
                type="submit"
                disabled={expSaving}
                className="w-full h-11 rounded-xl bg-white text-black font-semibold text-[14px] hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {expSaving ? "Сохранение…" : "Сохранить расход"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ШТОРКА ДОБАВЛЕНИЯ ОПЛАТЫ */}
      {isPaymentFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setIsPaymentFormOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-spatial-sheet apple-glass-glint w-full max-w-md rounded-t-[24px] sm:rounded-[24px] bg-[#141418] border-t sm:border border-white/[0.12] p-6 pb-8 text-zinc-100 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
              <h3 className="text-[17px] font-semibold text-white">Новая оплата клиента</h3>
              <button
                type="button"
                onClick={() => setIsPaymentFormOpen(false)}
                className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleSavePayment(e)} className="mt-4 space-y-4">
              {payError && (
                <div className="border-l-2 border-rose-500 bg-rose-500/5 pl-3 py-2 text-xs text-rose-300">
                  {payError}
                </div>
              )}

              <div>
                <label className="block text-[12px] text-zinc-400 mb-1">Сумма оплаты (₸)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="500000"
                  className="w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[18px] font-semibold text-white tabular-nums placeholder-zinc-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-zinc-400 mb-1">Дата</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full h-10 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[13px] text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-zinc-400 mb-1">Комментарий</label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="Предоплата 50%"
                    className="w-full h-10 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 text-[13px] text-white placeholder-zinc-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={paySaving}
                className="w-full h-11 rounded-xl bg-white text-black font-semibold text-[14px] hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {paySaving ? "Сохранение…" : "Сохранить оплату"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
