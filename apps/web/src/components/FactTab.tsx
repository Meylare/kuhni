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
}

export function FactTab({
  order,
  expenses,
  payments,
  calculations,
  onExpensesChange,
  onPaymentsChange,
}: FactTabProps) {
  const dialog = useDialog();

  // --- Добавление расхода ---
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

  // --- Добавление поступления ---
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [payDate, setPayDate] = useState(() => getLocalTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // --- План: опорная договорная версия или последняя сохранённая (Step A5, Q3) ---
  const planCalc = useMemo(() => {
    return getPlanCalculation(calculations);
  }, [calculations]);

  const planFactRows = useMemo(() => {
    if (!planCalc) return [];
    return buildPlanFactRows(toCalculationResultLike(planCalc.result), expenses);
  }, [planCalc, expenses]);

  const riskReservePlan = useMemo(() => {
    const row = planFactRows.find((r) => r.key === "risk_reserve");
    return row ? row.plan : 0;
  }, [planFactRows]);

  const planCostTotal = planCalc ? Number(planCalc.cost_total) : 0;

  // --- Факт: финансовые итоги и кассовый баланс (Step A4, Q4) ---
  const financialSummary = useMemo(() => {
    return computeOrderFinancialSummary({
      contractPrice: order.contract_price,
      expenses,
      payments,
    });
  }, [order.contract_price, expenses, payments]);

  // --- Обработчики ---
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

  return (
    <div className="mt-4 flex flex-col gap-4 text-zinc-100">
      {/* Подсказка */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-300 font-medium">
        💡 Сюда вносятся только расходы по этому заказу. Личные траты не вносить.
      </div>

      {/* ========== СВОДКА ПЛАН / ФАКТ ========== */}
      <div className="rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-2xl backdrop-blur-xl md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] pb-3">
          <h2 className="text-base font-medium tracking-tight text-white">
            📊 {planCalc
              ? planCalc.is_contract_baseline
                ? `План: версия №${planCalc.version} (договорная)`
                : `План: версия №${planCalc.version}`
              : "План / Факт"}
          </h2>
        </div>
        {!planCalc ? (
          <p className="mt-3 text-xs text-zinc-500">
            Нет сохранённых версий расчёта. Сохраните расчёт на вкладке «Расчёт», чтобы увидеть сравнение план/факт.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-0">
            {/* Таблица по категориям */}
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-zinc-900/30">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="px-3.5 py-2.5">Категория</th>
                    <th className="px-3.5 py-2.5 text-right">План</th>
                    <th className="px-3.5 py-2.5 text-right">Факт</th>
                    <th className="px-3.5 py-2.5 text-right">Разница</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {planFactRows.map((row) => (
                    <tr key={row.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-zinc-200">
                        {row.label}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-zinc-400 tabular-nums">
                        {row.plan > 0 ? `${formatKzt(row.plan)} ₸` : "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-white tabular-nums">
                        {row.fact !== null && row.fact > 0 ? `${formatKzt(row.fact)} ₸` : "—"}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-semibold tabular-nums ${
                        row.diff !== null
                          ? row.diff > 0
                            ? "text-rose-400"
                            : row.diff < 0
                            ? "text-emerald-400"
                            : "text-zinc-500"
                          : "text-zinc-500"
                      }`}>
                        {row.diff !== null && (row.fact! > 0 || row.plan > 0)
                          ? `${row.diff > 0 ? "+" : ""}${formatKzt(row.diff)} ₸`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-white/[0.08] bg-zinc-950/80 text-xs font-semibold text-white">
                  <tr>
                    <td className="px-3.5 py-2.5 text-white">
                      Итого расходы
                      {riskReservePlan > 0 && (
                        <span className="block text-[10px] font-normal text-zinc-400">
                          в плане учтён резерв {formatKzt(riskReservePlan)} ₸
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-zinc-300 tabular-nums">
                      {formatKzt(planCostTotal)} ₸
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-white tabular-nums">
                      {financialSummary.totalExpenses > 0
                        ? `${formatKzt(financialSummary.totalExpenses)} ₸`
                        : "—"}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right tabular-nums ${
                      financialSummary.totalExpenses - planCostTotal > 0
                        ? "text-rose-400 font-semibold"
                        : financialSummary.totalExpenses - planCostTotal < 0
                        ? "text-emerald-400 font-semibold"
                        : "text-zinc-500"
                    }`}>
                      {financialSummary.totalExpenses > 0
                        ? `${financialSummary.totalExpenses - planCostTotal > 0 ? "+" : ""}${formatKzt(financialSummary.totalExpenses - planCostTotal)} ₸`
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Переделки отдельной информационной строкой (Q4) */}
            {financialSummary.reworkTotal > 0 && (
              <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs text-zinc-300">
                <span>из них переделки:</span>
                <span className="font-semibold text-rose-400 tabular-nums">
                  {formatKzt(financialSummary.reworkTotal)} ₸
                </span>
              </div>
            )}

            {/* Финансовые карточки (Q4): Договор, Оплачено клиентом, Остаток долга, Фактическая прибыль, Кассовый баланс */}
            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {/* 1. Договор */}
              <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] px-3.5 py-3 text-center">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Договор
                </span>
                <span className="mt-1 block text-sm font-semibold tracking-tight text-white tabular-nums">
                  {financialSummary.contractPrice > 0
                    ? `${formatKzt(financialSummary.contractPrice)} ₸`
                    : "—"}
                </span>
              </div>

              {/* 2. Оплачено клиентом */}
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-3 text-center">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  Оплачено клиентом
                </span>
                <span className="mt-1 block text-sm font-semibold tracking-tight text-emerald-300 tabular-nums">
                  {financialSummary.paymentsTotal > 0
                    ? `${formatKzt(financialSummary.paymentsTotal)} ₸`
                    : "—"}
                </span>
              </div>

              {/* 3. Остаток долга */}
              <div className={`rounded-2xl px-3.5 py-3 text-center border ${
                financialSummary.contractPrice > 0 && financialSummary.paymentRemaining > 0
                  ? "bg-amber-500/10 border-amber-500/20"
                  : financialSummary.contractPrice > 0 && financialSummary.paymentRemaining <= 0
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-zinc-900/60 border-white/[0.05]"
              }`}>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Остаток долга
                </span>
                <span className={`mt-1 block text-sm font-semibold tracking-tight tabular-nums ${
                  financialSummary.contractPrice > 0 && financialSummary.paymentRemaining > 0
                    ? "text-amber-300"
                    : financialSummary.contractPrice > 0 && financialSummary.paymentRemaining <= 0
                    ? "text-emerald-300"
                    : "text-white"
                }`}>
                  {financialSummary.contractPrice > 0
                    ? `${formatKzt(financialSummary.paymentRemaining)} ₸`
                    : "—"}
                </span>
              </div>

              {/* 4. Фактическая прибыль */}
              <div className={`rounded-2xl px-3.5 py-3 text-center border ${
                financialSummary.contractPrice > 0 && financialSummary.actualProfit >= 0
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : financialSummary.contractPrice > 0 && financialSummary.actualProfit < 0
                  ? "bg-rose-500/10 border-rose-500/20"
                  : "bg-zinc-900/60 border-white/[0.05]"
              }`}>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Фактическая прибыль
                </span>
                <span className={`mt-1 block text-sm font-semibold tracking-tight tabular-nums ${
                  financialSummary.contractPrice > 0 && financialSummary.actualProfit >= 0
                    ? "text-emerald-300"
                    : financialSummary.contractPrice > 0 && financialSummary.actualProfit < 0
                    ? "text-rose-300"
                    : "text-white"
                }`}>
                  {financialSummary.contractPrice > 0 ? (
                    <>
                      {financialSummary.actualProfit > 0 ? "+" : ""}
                      {formatKzt(financialSummary.actualProfit)} ₸
                      {financialSummary.profitMarginPct !== null && (
                        <span className="text-xs font-normal ml-1 opacity-80">
                          ({formatPercent(financialSummary.profitMarginPct)})
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>

              {/* 5. Кассовый баланс */}
              <div className={`rounded-2xl px-3.5 py-3 text-center border ${
                financialSummary.cashBalance >= 0
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-rose-500/10 border-rose-500/20"
              }`}>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Кассовый баланс
                </span>
                <span className={`mt-1 block text-sm font-semibold tracking-tight tabular-nums ${
                  financialSummary.cashBalance >= 0
                    ? "text-emerald-300"
                    : "text-rose-300"
                }`}>
                  {financialSummary.cashBalance > 0 ? "+" : ""}
                  {formatKzt(financialSummary.cashBalance)} ₸
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== РАСХОДЫ ========== */}
      <div className="rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-2xl backdrop-blur-xl md:p-6">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h2 className="text-base font-medium tracking-tight text-white">💸 Расходы</h2>
            <p className="text-xs text-zinc-400">
              Фактические расходы по заказу
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetExpenseForm();
              setIsExpenseFormOpen(true);
            }}
            className="flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer shadow-md"
          >
            <span>+</span>
            <span>Добавить расход</span>
          </button>
        </div>

        {/* Форма добавления расхода */}
        {isExpenseFormOpen && (
          <form
            onSubmit={(e) => void handleSaveExpense(e)}
            className="mt-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 flex flex-col gap-3 text-zinc-100"
          >
            {expError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {expError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Дата расхода
                </label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Категория
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as PriceCategory)}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none transition-colors"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-zinc-900 text-white">
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Название
              </label>
              <input
                type="text"
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                placeholder="Например: ЛДСП Egger 18мм"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Сумма (₸)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="15 000"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>

            {/* Переключатель переделки */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expIsRework}
                  onChange={(e) => setExpIsRework(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-rose-500 focus:ring-rose-500"
                />
                <span className="text-xs font-medium text-zinc-300">
                  🔧 Переделка
                </span>
              </label>
              {expIsRework && (
                <div>
                  <label className="block text-xs font-medium text-rose-300 mb-1">
                    Причина переделки *
                  </label>
                  <input
                    type="text"
                    value={expReworkReason}
                    onChange={(e) => setExpReworkReason(e.target.value)}
                    placeholder="Обязательно укажите причину"
                    className="min-h-11 w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-white placeholder-rose-400 focus:border-rose-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Примечание
              </label>
              <input
                type="text"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="Дополнительная информация"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExpenseFormOpen(false)}
                disabled={expSaving}
                className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={expSaving}
                className="min-h-10 rounded-xl bg-white px-5 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-40 transition-all cursor-pointer shadow-md"
              >
                {expSaving ? "Сохранение…" : "Добавить расход"}
              </button>
            </div>
          </form>
        )}

        {/* Список расходов */}
        {expenses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-zinc-900/20 p-6 text-center text-xs text-zinc-500">
            Пока нет фактических расходов по этому заказу.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.04] rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
            {expenses.map((exp) => {
              const dateStr = new Date(exp.expense_date).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "short",
              });
              return (
                <div
                  key={exp.id}
                  className={`flex items-center justify-between p-3.5 text-xs ${
                    exp.is_rework ? "bg-rose-500/5" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white truncate">
                        {exp.name}
                      </span>
                      <span className="rounded-md bg-white/[0.06] border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        {CATEGORY_LABELS[exp.category]}
                      </span>
                      {exp.is_rework && (
                        <span className="rounded-md bg-rose-500/20 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                          🔧 Переделка
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-zinc-500 flex items-center gap-2 flex-wrap">
                      <span>{dateStr}</span>
                      {exp.is_rework && exp.rework_reason && (
                        <span className="text-rose-400 italic">
                          Причина: {exp.rework_reason}
                        </span>
                      )}
                      {exp.note && (
                        <span className="text-zinc-500 italic">{exp.note}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className={`font-semibold tabular-nums whitespace-nowrap ${
                      exp.is_rework ? "text-rose-300" : "text-white"
                    }`}>
                      {formatKzt(exp.amount)} ₸
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExpense(exp.id)}
                      className="rounded-lg p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Итого расходов */}
            <div className="flex items-center justify-between bg-zinc-950/60 px-3.5 py-2.5 text-xs font-semibold border-t border-white/[0.06]">
              <span className="text-zinc-400">
                Итого расходов: {expenses.length}
              </span>
              <span className="text-white tabular-nums">
                {formatKzt(financialSummary.totalExpenses)} ₸
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========== ПОСТУПЛЕНИЯ ========== */}
      <div className="rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-2xl backdrop-blur-xl md:p-6">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h2 className="text-base font-medium tracking-tight text-white">💰 Поступления</h2>
            <p className="text-xs text-zinc-400">
              Оплаты от клиента
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetPaymentForm();
              setIsPaymentFormOpen(true);
            }}
            className="flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer shadow-md"
          >
            <span>+</span>
            <span>Добавить поступление</span>
          </button>
        </div>

        {/* Форма добавления поступления */}
        {isPaymentFormOpen && (
          <form
            onSubmit={(e) => void handleSavePayment(e)}
            className="mt-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 flex flex-col gap-3 text-zinc-100"
          >
            {payError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {payError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Дата поступления
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Сумма (₸)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="300 000"
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Примечание
              </label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Например: Предоплата 50%"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentFormOpen(false)}
                disabled={paySaving}
                className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={paySaving}
                className="min-h-10 rounded-xl bg-white px-5 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-40 transition-all cursor-pointer shadow-md"
              >
                {paySaving ? "Сохранение…" : "Добавить поступление"}
              </button>
            </div>
          </form>
        )}

        {/* Список поступлений */}
        {payments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-zinc-900/20 p-6 text-center text-xs text-zinc-500">
            Пока нет оплат от клиента.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.04] rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
            {payments.map((pay) => {
              const dateStr = new Date(pay.paid_at).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "short",
              });
              return (
                <div
                  key={pay.id}
                  className="flex items-center justify-between p-3.5 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-400">
                        Оплата
                      </span>
                      <span className="text-zinc-500">{dateStr}</span>
                    </div>
                    {pay.note && (
                      <div className="mt-0.5 text-zinc-500 italic truncate">
                        {pay.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                      +{formatKzt(pay.amount)} ₸
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeletePayment(pay.id)}
                      className="rounded-lg p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Итого поступлений */}
            <div className="flex items-center justify-between bg-zinc-950/60 px-3.5 py-2.5 text-xs font-semibold border-t border-white/[0.06]">
              <span className="text-zinc-400">
                Итого поступлений: {payments.length}
              </span>
              <span className="text-emerald-400 tabular-nums">
                {formatKzt(financialSummary.paymentsTotal)} ₸
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
