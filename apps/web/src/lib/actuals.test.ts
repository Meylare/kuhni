import { describe, expect, it } from "vitest";

import {
  computeActualMargin,
  sumAllExpenses,
  sumExpensesByCategory,
  sumPayments,
  sumReworks,
  validateExpenseInput,
  validatePaymentInput,
} from "./actuals";
import type { ActualExpense, Payment } from "../types/database";

function makeExpense(overrides: Partial<ActualExpense> = {}): ActualExpense {
  return {
    id: "exp-1",
    order_id: "order-1",
    expense_date: "2026-10-01",
    category: "materials",
    name: "ЛДСП",
    amount: 10000,
    is_rework: false,
    rework_reason: null,
    note: null,
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    order_id: "order-1",
    paid_at: "2026-10-01",
    amount: 50000,
    note: null,
    ...overrides,
  };
}

describe("validateExpenseInput", () => {
  it("rejects empty name", () => {
    const res = validateExpenseInput({
      name: "",
      amount: 1000,
      category: "materials",
      is_rework: false,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("обязательно");
  });

  it("rejects zero amount", () => {
    const res = validateExpenseInput({
      name: "Test",
      amount: 0,
      category: "materials",
      is_rework: false,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("больше 0");
  });

  it("rejects negative amount", () => {
    const res = validateExpenseInput({
      name: "Test",
      amount: -100,
      category: "materials",
      is_rework: false,
    });
    expect(res.valid).toBe(false);
  });

  it("rejects rework without reason", () => {
    const res = validateExpenseInput({
      name: "Test",
      amount: 1000,
      category: "materials",
      is_rework: true,
      rework_reason: "",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("причину");
  });

  it("accepts rework with reason", () => {
    const res = validateExpenseInput({
      name: "Test",
      amount: 1000,
      category: "materials",
      is_rework: true,
      rework_reason: "Брак поставщика",
    });
    expect(res.valid).toBe(true);
  });

  it("accepts valid non-rework expense", () => {
    const res = validateExpenseInput({
      name: "ЛДСП",
      amount: 15000,
      category: "materials",
      is_rework: false,
    });
    expect(res.valid).toBe(true);
  });
});

describe("validatePaymentInput", () => {
  it("rejects zero amount", () => {
    expect(validatePaymentInput({ amount: 0 }).valid).toBe(false);
  });

  it("rejects NaN amount", () => {
    expect(validatePaymentInput({ amount: NaN }).valid).toBe(false);
  });

  it("accepts positive amount", () => {
    expect(validatePaymentInput({ amount: 300000 }).valid).toBe(true);
  });
});

describe("sumExpensesByCategory", () => {
  it("sums only matching category, excluding reworks", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", category: "materials", amount: 10000 }),
      makeExpense({ id: "2", category: "materials", amount: 5000 }),
      makeExpense({ id: "3", category: "hardware", amount: 3000 }),
      makeExpense({ id: "4", category: "materials", amount: 2000, is_rework: true }),
    ];
    expect(sumExpensesByCategory(expenses, "materials")).toBe(15000);
    expect(sumExpensesByCategory(expenses, "hardware")).toBe(3000);
    expect(sumExpensesByCategory(expenses, "transport")).toBe(0);
  });
});

describe("sumReworks", () => {
  it("sums only rework expenses", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 10000, is_rework: false }),
      makeExpense({ id: "2", amount: 5000, is_rework: true }),
      makeExpense({ id: "3", amount: 3000, is_rework: true }),
    ];
    expect(sumReworks(expenses)).toBe(8000);
  });

  it("returns 0 when no reworks", () => {
    expect(sumReworks([makeExpense()])).toBe(0);
  });
});

describe("sumAllExpenses", () => {
  it("sums expenses excluding reworks", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 10000, is_rework: false }),
      makeExpense({ id: "2", amount: 5000, is_rework: true }),
      makeExpense({ id: "3", amount: 3000, is_rework: false }),
    ];
    expect(sumAllExpenses(expenses)).toBe(13000);
  });
});

describe("sumPayments", () => {
  it("sums all payments", () => {
    const payments: Payment[] = [
      makePayment({ id: "1", amount: 300000 }),
      makePayment({ id: "2", amount: 200000 }),
    ];
    expect(sumPayments(payments)).toBe(500000);
  });

  it("returns 0 for empty array", () => {
    expect(sumPayments([])).toBe(0);
  });
});

describe("computeActualMargin", () => {
  it("returns null when no payments", () => {
    const expenses = [makeExpense({ amount: 10000 })];
    expect(computeActualMargin(expenses, [])).toBeNull();
  });

  it("computes positive margin", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 100000 }),
      makeExpense({ id: "2", amount: 50000 }),
    ];
    const payments: Payment[] = [
      makePayment({ id: "1", amount: 500000 }),
    ];
    const result = computeActualMargin(expenses, payments);
    expect(result).not.toBeNull();
    expect(result!.margin).toBe(350000); // 500000 - 150000
    expect(result!.marginPct).toBeCloseTo(0.7, 2); // 350000/500000
  });

  it("includes reworks in total expenses for margin calculation", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 100000, is_rework: false }),
      makeExpense({ id: "2", amount: 20000, is_rework: true }),
    ];
    const payments: Payment[] = [
      makePayment({ id: "1", amount: 200000 }),
    ];
    const result = computeActualMargin(expenses, payments);
    expect(result).not.toBeNull();
    // margin = 200000 - 120000 = 80000
    expect(result!.margin).toBe(80000);
  });

  it("computes negative margin (loss)", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 600000 }),
    ];
    const payments: Payment[] = [
      makePayment({ id: "1", amount: 500000 }),
    ];
    const result = computeActualMargin(expenses, payments);
    expect(result).not.toBeNull();
    expect(result!.margin).toBe(-100000);
  });
});
