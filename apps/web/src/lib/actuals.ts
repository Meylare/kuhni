import type { ActualExpense, Payment, PriceCategory } from "../types/database";

/**
 * Валидация добавления фактического расхода.
 */
export function validateExpenseInput(input: {
  name: string;
  amount: number;
  category: PriceCategory;
  is_rework: boolean;
  rework_reason?: string | null;
}): { valid: boolean; error?: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { valid: false, error: "Название расхода обязательно." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: "Сумма расхода должна быть больше 0." };
  }
  if (input.is_rework && (!input.rework_reason || input.rework_reason.trim().length === 0)) {
    return { valid: false, error: "При переделке обязательно укажите причину." };
  }
  return { valid: true };
}

/**
 * Валидация добавления поступления от клиента.
 */
export function validatePaymentInput(input: {
  amount: number;
}): { valid: boolean; error?: string } {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: "Сумма поступления должна быть больше 0." };
  }
  return { valid: true };
}

/**
 * Расходы по категории, включая переделки (сумма категорий = итог = экспорт).
 */
export function sumExpensesByCategory(
  expenses: ActualExpense[],
  category: PriceCategory,
): number {
  return expenses
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * Общая сумма переделок по заказу.
 */
export function sumReworks(expenses: ActualExpense[]): number {
  return expenses
    .filter((e) => e.is_rework)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * Общая сумма поступлений от клиента.
 */
export function sumPayments(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount), 0);
}

export interface OrderFinancialSummary {
  contractPrice: number;
  totalExpenses: number;        // Все расходы, включая переделки
  actualProfit: number;         // contractPrice - totalExpenses
  profitMarginPct: number | null;// actualProfit / contractPrice
  paymentsTotal: number;        // Всего оплачено клиентом
  paymentRemaining: number;     // contractPrice - paymentsTotal
  cashBalance: number;          // paymentsTotal - totalExpenses (касса)
  reworkTotal: number;          // Из них переделки
}

/**
 * Единый расчёт управленческой прибыли и кассового баланса проекта (Q4).
 * Фактическая прибыль = contractPrice - totalExpenses (включая переделки).
 * Рентабельность % = actualProfit / contractPrice.
 * Кассовый баланс = paymentsTotal - totalExpenses.
 */
export function computeOrderFinancialSummary(params: {
  contractPrice: number | null | undefined;
  expenses: ActualExpense[];
  payments: Payment[];
}): OrderFinancialSummary {
  const contractPrice =
    params.contractPrice !== null && params.contractPrice !== undefined
      ? Number(params.contractPrice)
      : 0;

  const totalExpenses = params.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const actualProfit = contractPrice - totalExpenses;
  const profitMarginPct = contractPrice > 0 ? actualProfit / contractPrice : null;
  const paymentsTotal = sumPayments(params.payments);
  const paymentRemaining = contractPrice - paymentsTotal;
  const cashBalance = paymentsTotal - totalExpenses;
  const reworkTotal = sumReworks(params.expenses);

  return {
    contractPrice,
    totalExpenses,
    actualProfit,
    profitMarginPct,
    paymentsTotal,
    paymentRemaining,
    cashBalance,
    reworkTotal,
  };
}

export interface PlanFactRow {
  key: string;
  label: string;
  plan: number;
  fact: number | null;
  diff: number | null;
}

export interface CalculationResultLike {
  categoryTotals?: Record<string, number>;
  assembly?: number;
  fixedAssembly?: number;
  technolog?: number;
  fixedTechnolog?: number;
  riskReserve?: number;
  costTotal?: number;
}

/**
 * Безопасное приведение неизвестного результата расчёта к CalculationResultLike без as any.
 */
export function toCalculationResultLike(result: unknown): CalculationResultLike | null {
  if (!result || typeof result !== "object") return null;
  const obj = result as Record<string, unknown>;
  return {
    categoryTotals:
      obj.categoryTotals && typeof obj.categoryTotals === "object"
        ? (obj.categoryTotals as Record<string, number>)
        : undefined,
    assembly: typeof obj.assembly === "number" ? obj.assembly : undefined,
    fixedAssembly: typeof obj.fixedAssembly === "number" ? obj.fixedAssembly : undefined,
    technolog: typeof obj.technolog === "number" ? obj.technolog : undefined,
    fixedTechnolog: typeof obj.fixedTechnolog === "number" ? obj.fixedTechnolog : undefined,
    riskReserve: typeof obj.riskReserve === "number" ? obj.riskReserve : undefined,
    costTotal: typeof obj.costTotal === "number" ? obj.costTotal : undefined,
  };
}

/**
 * Формирует строки таблицы «План / Факт».
 * Сумма строк плана строго равна cost_total.
 * Для строк «Резерв на риск» и «Корректировки» факт и разница равны null (отображаются как «—»).
 * Сумма строк факта по категориям строго равна totalExpenses.
 */
export function buildPlanFactRows(
  result: CalculationResultLike | null | undefined,
  expenses: ActualExpense[],
): PlanFactRow[] {
  const catTotals = result?.categoryTotals ?? {};
  const assemblyPlan = result
    ? (Number(result.assembly) || Number(result.fixedAssembly) || 0)
    : 0;
  const technologPlan = result
    ? (Number(result.technolog) || Number(result.fixedTechnolog) || 0)
    : 0;
  const riskReservePlan = result ? Number(result.riskReserve || 0) : 0;
  const adjustmentsPlan = result ? Number(catTotals.adjustments || 0) : 0;

  const rawRows: { key: string; label: string; plan: number; fact: number | null }[] = [
    {
      key: "materials",
      label: "Материалы",
      plan: Number(catTotals.materials || 0),
      fact: sumExpensesByCategory(expenses, "materials"),
    },
    {
      key: "workshop",
      label: "Цех",
      plan: Number(catTotals.workshop || 0),
      fact: sumExpensesByCategory(expenses, "workshop"),
    },
    {
      key: "facades",
      label: "Фасады",
      plan: Number(catTotals.facades || 0),
      fact: sumExpensesByCategory(expenses, "facades"),
    },
    {
      key: "hardware",
      label: "Фурнитура",
      plan: Number(catTotals.hardware || 0),
      fact: sumExpensesByCategory(expenses, "hardware"),
    },
    {
      key: "transport",
      label: "Транспорт",
      plan: Number(catTotals.transport || 0),
      fact: sumExpensesByCategory(expenses, "transport"),
    },
    {
      key: "labor",
      label: "Работа",
      plan: Number(catTotals.labor || 0),
      fact: sumExpensesByCategory(expenses, "labor"),
    },
    {
      key: "assembly",
      label: "Сборка",
      plan: assemblyPlan,
      fact: sumExpensesByCategory(expenses, "assembly"),
    },
    {
      key: "technolog",
      label: "Технолог",
      plan: technologPlan,
      fact: sumExpensesByCategory(expenses, "technolog"),
    },
    {
      key: "risk_reserve",
      label: "Резерв на риск",
      plan: riskReservePlan,
      fact: null,
    },
    {
      key: "adjustments",
      label: "Корректировки",
      plan: adjustmentsPlan,
      fact: null,
    },
    {
      key: "other",
      label: "Остальное",
      plan: Number(catTotals.other || 0),
      fact: sumExpensesByCategory(expenses, "other"),
    },
  ];

  return rawRows.map((r) => ({
    ...r,
    diff: r.fact !== null ? r.fact - r.plan : null,
  }));
}
