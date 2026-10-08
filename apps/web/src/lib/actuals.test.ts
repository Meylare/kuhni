import { describe, expect, it } from "vitest";

import {
  buildPlanFactRows,
  computeActualMargin,
  computeOrderFinancialSummary,
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

describe("Step A3: Plan/Fact rows and categories (assembly & technolog)", () => {
  it("sums expenses for assembly and technolog categories", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", category: "assembly", amount: 35000 }),
      makeExpense({ id: "2", category: "technolog", amount: 15000 }),
    ];
    expect(sumExpensesByCategory(expenses, "assembly")).toBe(35000);
    expect(sumExpensesByCategory(expenses, "technolog")).toBe(15000);
  });

  it("buildPlanFactRows produces rows whose plan sum strictly equals cost_total for benchmark kitchen 3m", () => {
    // Benchmark order calculation result (SPEC Example A)
    const benchmarkResult = {
      categoryTotals: {
        materials: 163_240,
        facades: 168_000,
        workshop: 133_000,
        hardware: 47_500,
        transport: 20_000,
        labor: 15_000,
        other: 0,
        adjustments: 0,
      },
      fixedAssembly: 0,
      fixedTechnolog: 0,
      assembly: 124_845,
      technolog: 34_440,
      riskReserve: 0,
      costTotal: 706_025,
      priceTotal: 861_000,
    };

    const rows = buildPlanFactRows(benchmarkResult, []);
    expect(rows).toHaveLength(11);

    const planSum = rows.reduce((acc, row) => acc + row.plan, 0);
    expect(planSum).toBe(706_025);
    expect(planSum).toBe(benchmarkResult.costTotal);

    // Verify presence of assembly and technolog
    const assemblyRow = rows.find((r) => r.key === "assembly");
    expect(assemblyRow).toBeDefined();
    expect(assemblyRow!.plan).toBe(124_845);

    const technologRow = rows.find((r) => r.key === "technolog");
    expect(technologRow).toBeDefined();
    expect(technologRow!.plan).toBe(34_440);
  });
});

describe("Step A4: OrderFinancialSummary (Q4 financial totals and cash balance)", () => {
  it("calculates profit from contract price and separates cash balance under 50% prepayment", () => {
    // Contract 800 000, expenses 500 000 (including 50 000 rework), prepayment 400 000
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 450_000, is_rework: false }),
      makeExpense({ id: "2", amount: 50_000, is_rework: true, rework_reason: "Брак" }),
    ];
    const payments: Payment[] = [
      makePayment({ id: "1", amount: 400_000 }),
    ];

    const summary = computeOrderFinancialSummary({
      contractPrice: 800_000,
      expenses,
      payments,
    });

    expect(summary.contractPrice).toBe(800_000);
    expect(summary.totalExpenses).toBe(500_000);
    expect(summary.reworkTotal).toBe(50_000);
    expect(summary.actualProfit).toBe(300_000); // 800 000 - 500 000
    expect(summary.profitMarginPct).toBeCloseTo(0.375, 4); // 37.5%
    expect(summary.paymentsTotal).toBe(400_000);
    expect(summary.paymentRemaining).toBe(400_000); // 800 000 - 400 000
    expect(summary.cashBalance).toBe(-100_000); // 400 000 - 500 000
  });

  it("handles zero payments correctly: shows positive profit from contract and negative cash balance", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 200_000 }),
    ];

    const summary = computeOrderFinancialSummary({
      contractPrice: 500_000,
      expenses,
      payments: [],
    });

    expect(summary.contractPrice).toBe(500_000);
    expect(summary.totalExpenses).toBe(200_000);
    expect(summary.actualProfit).toBe(300_000);
    expect(summary.profitMarginPct).toBeCloseTo(0.6, 2);
    expect(summary.paymentsTotal).toBe(0);
    expect(summary.paymentRemaining).toBe(500_000);
    expect(summary.cashBalance).toBe(-200_000);
  });

  it("handles null or undefined contract price safely", () => {
    const expenses: ActualExpense[] = [
      makeExpense({ id: "1", amount: 100_000 }),
    ];
    const payments: Payment[] = [
      makePayment({ id: "1", amount: 60_000 }),
    ];

    const summary = computeOrderFinancialSummary({
      contractPrice: null,
      expenses,
      payments,
    });

    expect(summary.contractPrice).toBe(0);
    expect(summary.profitMarginPct).toBeNull();
    expect(summary.actualProfit).toBe(-100_000);
    expect(summary.paymentRemaining).toBe(-60_000);
    expect(summary.cashBalance).toBe(-40_000);
  });
});

