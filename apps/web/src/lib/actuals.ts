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
