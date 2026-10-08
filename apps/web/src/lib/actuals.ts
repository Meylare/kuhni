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
 * Расходы по категории, без учёта переделок.
 */
export function sumExpensesByCategory(
  expenses: ActualExpense[],
  category: PriceCategory,
): number {
  return expenses
    .filter((e) => e.category === category && !e.is_rework)
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

/**
 * Общая сумма фактических расходов (без переделок).
 */
export function sumAllExpenses(expenses: ActualExpense[]): number {
  return expenses
    .filter((e) => !e.is_rework)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * Фактическая маржа: поступления минус все расходы (включая переделки).
 * Если нет поступлений, возвращает null.
 */
export function computeActualMargin(
  expenses: ActualExpense[],
  payments: Payment[],
): { margin: number; marginPct: number | null } | null {
  const totalPayments = sumPayments(payments);
  if (totalPayments === 0) return null;
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const margin = totalPayments - totalExpenses;
  const marginPct = totalPayments > 0 ? margin / totalPayments : null;
  return { margin, marginPct };
}

export interface PlanFactRow {
  key: string;
  label: string;
  plan: number;
  fact: number;
  diff: number;
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
 * Формирует строки таблицы «План / Факт».
 * Сумма строк плана строго равна cost_total, так как включает
 * сборку, технолога, резерв на риск и корректировки.
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

  const rawRows: { key: string; label: string; plan: number; fact: number }[] = [
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
      fact: 0,
    },
    {
      key: "adjustments",
      label: "Корректировки",
      plan: adjustmentsPlan,
      fact: 0,
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
    diff: r.fact - r.plan,
  }));
}
