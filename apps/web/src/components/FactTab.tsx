import { useMemo, useState } from "react";

import { formatErrorMessage } from "../lib/errors";
import { formatKzt } from "../lib/money";
import { formatPercent } from "../lib/parameters";
import {
  buildPlanFactRows,
  sumReworks,
  sumPayments,
  sumAllExpenses,
  computeActualMargin,
  validateExpenseInput,
  validatePaymentInput,
} from "../lib/actuals";
import { getSupabase } from "../lib/supabase";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type ActualExpense,
  type Order,
  type OrderCalculation,
  type Payment,
  type PriceCategory,
} from "../types/database";

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
  // --- Добавление расхода ---
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
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
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // --- План из последней сохранённой версии расчёта ---
  const latestCalc = useMemo(() => {
    if (calculations.length === 0) return null;
    return [...calculations].sort((a, b) => b.version - a.version)[0] ?? null;
  }, [calculations]);

  const planFactRows = useMemo(() => {
    if (!latestCalc) return [];
    const res = latestCalc.result as Record<string, unknown>;
    return buildPlanFactRows(res as any, expenses);
  }, [latestCalc, expenses]);

  const planCostTotal = latestCalc ? Number(latestCalc.cost_total) : 0;

  // --- Факт: сводные данные ---
  const factExpensesTotal = sumAllExpenses(expenses);
  const factReworksTotal = sumReworks(expenses);
  const factAllExpensesTotal = factExpensesTotal + factReworksTotal;
  const factPaymentsTotal = sumPayments(payments);
  const actualMarginData = computeActualMargin(expenses, payments);
  const contractPrice = order.contract_price !== null ? Number(order.contract_price) : null;
  const paymentRemaining = contractPrice !== null ? contractPrice - factPaymentsTotal : null;

  // --- Обработчики ---
  function resetExpenseForm() {
    setExpDate(new Date().toISOString().slice(0, 10));
    setExpCategory("materials");
    setExpName("");
    setExpAmount("");
    setExpIsRework(false);
    setExpReworkReason("");
    setExpNote("");
    setExpError(null);
  }

  function resetPaymentForm() {
    setPayDate(new Date().toISOString().slice(0, 10));
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
    if (!confirm("Удалить этот расход?")) return;
    try {
      const supabase = getSupabase();
      const { error: delErr } = await supabase
        .from("actual_expenses")
        .delete()
        .eq("id", expId);
      if (delErr) {
        alert("Ошибка удаления: " + formatErrorMessage(delErr));
      } else {
        onExpensesChange(expenses.filter((e) => e.id !== expId));
      }
    } catch (err) {
      alert("Ошибка удаления: " + formatErrorMessage(err));
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
    if (!confirm("Удалить это поступление?")) return;
    try {
      const supabase = getSupabase();
      const { error: delErr } = await supabase
        .from("payments")
        .delete()
        .eq("id", payId);
      if (delErr) {
        alert("Ошибка удаления: " + formatErrorMessage(delErr));
      } else {
        onPaymentsChange(payments.filter((p) => p.id !== payId));
      }
    } catch (err) {
      alert("Ошибка удаления: " + formatErrorMessage(err));
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Подсказка */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
        💡 Сюда вносятся только расходы по этому заказу. Личные траты не вносить.
      </div>

      {/* ========== СВОДКА ПЛАН / ФАКТ ========== */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
        <h2 className="text-base font-bold text-stone-900">📊 План / Факт</h2>
        {!latestCalc ? (
          <p className="mt-2 text-xs text-stone-500">
            Нет сохранённых версий расчёта. Сохраните расчёт на вкладке «Расчёт», чтобы увидеть сравнение план/факт.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-0">
            {/* Таблица по категориям */}
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 text-left text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
                    <th className="px-3 py-2">Категория</th>
                    <th className="px-3 py-2 text-right">План</th>
                    <th className="px-3 py-2 text-right">Факт</th>
                    <th className="px-3 py-2 text-right">Разница</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {planFactRows.map((row) => (
                    <tr key={row.key} className="hover:bg-stone-50/50">
                      <td className="px-3 py-2 font-medium text-stone-800">
                        {row.label}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-600">
                        {row.plan > 0 ? `${formatKzt(row.plan)} ₸` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-stone-900">
                        {row.fact > 0 ? `${formatKzt(row.fact)} ₸` : "—"}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        row.diff > 0
                          ? "text-rose-700"
                          : row.diff < 0
                          ? "text-emerald-700"
                          : "text-stone-400"
                      }`}>
                        {row.fact > 0 || row.plan > 0
                          ? `${row.diff > 0 ? "+" : ""}${formatKzt(row.diff)} ₸`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-stone-300 bg-stone-50/80 text-xs font-bold">
                  <tr>
                    <td className="px-3 py-2 text-stone-900">Итого расходы</td>
                    <td className="px-3 py-2 text-right text-stone-700">
                      {formatKzt(planCostTotal)} ₸
                    </td>
                    <td className="px-3 py-2 text-right text-stone-900">
                      {factExpensesTotal > 0 ? `${formatKzt(factExpensesTotal)} ₸` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right ${
                      factExpensesTotal - planCostTotal > 0
                        ? "text-rose-700"
                        : factExpensesTotal - planCostTotal < 0
                        ? "text-emerald-700"
                        : "text-stone-400"
                    }`}>
                      {factExpensesTotal > 0
                        ? `${factExpensesTotal - planCostTotal > 0 ? "+" : ""}${formatKzt(factExpensesTotal - planCostTotal)} ₸`
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Переделки отдельно */}
            {factReworksTotal > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
                <span className="font-semibold text-rose-800">
                  🔧 Переделки (сверх расходов)
                </span>
                <span className="font-extrabold text-rose-900">
                  {formatKzt(factReworksTotal)} ₸
                </span>
              </div>
            )}

            {/* Оплата и остаток */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-stone-100 px-3 py-2.5 text-center">
                <span className="block text-[10px] uppercase tracking-wide text-stone-500">
                  Договор
                </span>
                <span className="mt-0.5 block text-sm font-extrabold text-stone-900">
                  {contractPrice !== null ? `${formatKzt(contractPrice)} ₸` : "—"}
                </span>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-center">
                <span className="block text-[10px] uppercase tracking-wide text-emerald-600">
                  Оплачено
                </span>
                <span className="mt-0.5 block text-sm font-extrabold text-emerald-900">
                  {factPaymentsTotal > 0 ? `${formatKzt(factPaymentsTotal)} ₸` : "—"}
                </span>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-center border ${
                paymentRemaining !== null && paymentRemaining > 0
                  ? "bg-amber-50 border-amber-200"
                  : paymentRemaining !== null && paymentRemaining <= 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-stone-100 border-stone-200"
              }`}>
                <span className="block text-[10px] uppercase tracking-wide text-stone-500">
                  Остаток оплаты
                </span>
                <span className={`mt-0.5 block text-sm font-extrabold ${
                  paymentRemaining !== null && paymentRemaining > 0
                    ? "text-amber-900"
                    : paymentRemaining !== null && paymentRemaining <= 0
                    ? "text-emerald-900"
                    : "text-stone-900"
                }`}>
                  {paymentRemaining !== null ? `${formatKzt(paymentRemaining)} ₸` : "—"}
                </span>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-center border ${
                actualMarginData && actualMarginData.margin >= 0
                  ? "bg-emerald-50 border-emerald-200"
                  : actualMarginData && actualMarginData.margin < 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-stone-100 border-stone-200"
              }`}>
                <span className="block text-[10px] uppercase tracking-wide text-stone-500">
                  Факт. маржа
                </span>
                <span className={`mt-0.5 block text-sm font-extrabold ${
                  actualMarginData && actualMarginData.margin >= 0
                    ? "text-emerald-900"
                    : actualMarginData && actualMarginData.margin < 0
                    ? "text-rose-900"
                    : "text-stone-900"
                }`}>
                  {actualMarginData
                    ? `${formatKzt(actualMarginData.margin)} ₸`
                    : "—"}
                  {actualMarginData?.marginPct !== null && actualMarginData?.marginPct !== undefined && (
                    <span className="text-xs font-semibold ml-1">
                      ({formatPercent(actualMarginData.marginPct)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== РАСХОДЫ ========== */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">💸 Расходы</h2>
            <p className="text-xs text-stone-500">
              Фактические расходы по заказу
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetExpenseForm();
              setIsExpenseFormOpen(true);
            }}
            className="flex min-h-10 items-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-98"
          >
            <span>+</span>
            <span>Добавить расход</span>
          </button>
        </div>

        {/* Форма добавления расхода */}
        {isExpenseFormOpen && (
          <form
            onSubmit={(e) => void handleSaveExpense(e)}
            className="mt-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 flex flex-col gap-3"
          >
            {expError && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">
                {expError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Дата расхода
                </label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Категория
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as PriceCategory)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Название
              </label>
              <input
                type="text"
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                placeholder="Например: ЛДСП Egger 18мм"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Сумма (₸)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="15 000"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>

            {/* Переключатель переделки */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expIsRework}
                  onChange={(e) => setExpIsRework(e.target.checked)}
                  className="h-5 w-5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs font-semibold text-stone-700">
                  🔧 Переделка
                </span>
              </label>
              {expIsRework && (
                <div>
                  <label className="block text-xs font-semibold text-rose-700 mb-1">
                    Причина переделки *
                  </label>
                  <input
                    type="text"
                    value={expReworkReason}
                    onChange={(e) => setExpReworkReason(e.target.value)}
                    placeholder="Обязательно укажите причину"
                    className="min-h-11 w-full rounded-xl border border-rose-300 bg-rose-50/50 px-3 py-2 text-sm text-stone-900 focus:border-rose-600"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Примечание
              </label>
              <input
                type="text"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="Дополнительная информация"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsExpenseFormOpen(false)}
                disabled={expSaving}
                className="min-h-10 rounded-xl border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={expSaving}
                className="min-h-10 rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
              >
                {expSaving ? "Сохранение…" : "Добавить расход"}
              </button>
            </div>
          </form>
        )}

        {/* Список расходов */}
        {expenses.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-6 text-center text-xs text-stone-500">
            Пока нет фактических расходов по этому заказу.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
            {expenses.map((exp) => {
              const dateStr = new Date(exp.expense_date).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "short",
              });
              return (
                <div
                  key={exp.id}
                  className={`flex items-center justify-between p-3 text-xs ${
                    exp.is_rework ? "bg-rose-50/50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-stone-900 truncate">
                        {exp.name}
                      </span>
                      <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                        {CATEGORY_LABELS[exp.category]}
                      </span>
                      {exp.is_rework && (
                        <span className="rounded-md bg-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                          🔧 Переделка
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-stone-500 flex items-center gap-2 flex-wrap">
                      <span>{dateStr}</span>
                      {exp.is_rework && exp.rework_reason && (
                        <span className="text-rose-700 italic">
                          Причина: {exp.rework_reason}
                        </span>
                      )}
                      {exp.note && (
                        <span className="text-stone-400 italic">{exp.note}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={`font-extrabold whitespace-nowrap ${
                      exp.is_rework ? "text-rose-900" : "text-stone-900"
                    }`}>
                      {formatKzt(exp.amount)} ₸
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExpense(exp.id)}
                      className="rounded-lg p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Итого расходов */}
            <div className="flex items-center justify-between bg-stone-50 px-3 py-2.5 text-xs font-bold">
              <span className="text-stone-700">
                Итого расходов: {expenses.length}
              </span>
              <span className="text-stone-900">
                {formatKzt(factAllExpensesTotal)} ₸
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========== ПОСТУПЛЕНИЯ ========== */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">💰 Поступления</h2>
            <p className="text-xs text-stone-500">
              Оплаты от клиента
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetPaymentForm();
              setIsPaymentFormOpen(true);
            }}
            className="flex min-h-10 items-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-98"
          >
            <span>+</span>
            <span>Добавить поступление</span>
          </button>
        </div>

        {/* Форма добавления поступления */}
        {isPaymentFormOpen && (
          <form
            onSubmit={(e) => void handleSavePayment(e)}
            className="mt-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 flex flex-col gap-3"
          >
            {payError && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">
                {payError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Дата поступления
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Сумма (₸)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="300 000"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Примечание
              </label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Например: Предоплата 50%"
                className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsPaymentFormOpen(false)}
                disabled={paySaving}
                className="min-h-10 rounded-xl border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={paySaving}
                className="min-h-10 rounded-xl bg-emerald-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
              >
                {paySaving ? "Сохранение…" : "Добавить поступление"}
              </button>
            </div>
          </form>
        )}

        {/* Список поступлений */}
        {payments.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-6 text-center text-xs text-stone-500">
            Пока нет оплат от клиента.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
            {payments.map((pay) => {
              const dateStr = new Date(pay.paid_at).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "short",
              });
              return (
                <div
                  key={pay.id}
                  className="flex items-center justify-between p-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-900">
                        Оплата
                      </span>
                      <span className="text-stone-500">{dateStr}</span>
                    </div>
                    {pay.note && (
                      <div className="mt-0.5 text-stone-400 italic truncate">
                        {pay.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="font-extrabold text-emerald-900 whitespace-nowrap">
                      +{formatKzt(pay.amount)} ₸
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeletePayment(pay.id)}
                      className="rounded-lg p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Итого поступлений */}
            <div className="flex items-center justify-between bg-stone-50 px-3 py-2.5 text-xs font-bold">
              <span className="text-stone-700">
                Итого поступлений: {payments.length}
              </span>
              <span className="text-emerald-900">
                {formatKzt(factPaymentsTotal)} ₸
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
