import { describe, expect, it } from "vitest";

import {
  checkOrderLoadCriticalErrors,
  ORDER_LOAD_NETWORK_ERROR_MESSAGE,
  shouldConfirmCalculationSave,
} from "./orders";

describe("Step B4: Order loading error guard and zero-line save protection", () => {
  describe("checkOrderLoadCriticalErrors", () => {
    it("returns hasError: false when all queries succeed without error", () => {
      const result = checkOrderLoadCriticalErrors({
        itemsError: null,
        linesError: null,
        adjustmentsError: null,
        pricesError: null,
        parametersError: null,
        calculationsError: null,
        expensesError: null,
        paymentsError: null,
      });

      expect(result.hasError).toBe(false);
      expect(result.errorMessage).toBeNull();
    });

    it("detects lines query error and returns proper error message", () => {
      const result = checkOrderLoadCriticalErrors({
        linesError: { message: "Failed to fetch order_lines (network error)" },
      });

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe(ORDER_LOAD_NETWORK_ERROR_MESSAGE);
    });

    it("detects items query error", () => {
      const result = checkOrderLoadCriticalErrors({
        itemsError: new Error("Network timeout"),
      });

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe(ORDER_LOAD_NETWORK_ERROR_MESSAGE);
    });

    it("detects price items query error", () => {
      const result = checkOrderLoadCriticalErrors({
        pricesError: { code: "500", message: "Internal server error" },
      });

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe(ORDER_LOAD_NETWORK_ERROR_MESSAGE);
    });

    it("detects parameters query error", () => {
      const result = checkOrderLoadCriticalErrors({
        parametersError: { message: "Connection refused" },
      });

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe(ORDER_LOAD_NETWORK_ERROR_MESSAGE);
    });
  });

  describe("shouldConfirmCalculationSave", () => {
    it("requires confirmation when order has 0 lines", () => {
      const check = shouldConfirmCalculationSave({
        linesCount: 0,
        priceTotal: 500_000,
      });

      expect(check.needsConfirmation).toBe(true);
      expect(check.reason).toContain("В заказе нет позиций");
    });

    it("requires confirmation when order has 0 total price", () => {
      const check = shouldConfirmCalculationSave({
        linesCount: 5,
        priceTotal: 0,
      });

      expect(check.needsConfirmation).toBe(true);
      expect(check.reason).toContain("Итоговая цена заказа равна 0");
    });

    it("requires confirmation when order has 0 lines and 0 total price", () => {
      const check = shouldConfirmCalculationSave({
        linesCount: 0,
        priceTotal: 0,
      });

      expect(check.needsConfirmation).toBe(true);
      expect(check.reason).toContain("В заказе нет позиций и итоговая цена равна 0");
    });

    it("allows save without confirmation when lines > 0 and price > 0", () => {
      const check = shouldConfirmCalculationSave({
        linesCount: 3,
        priceTotal: 861_000,
      });

      expect(check.needsConfirmation).toBe(false);
      expect(check.reason).toBeNull();
    });
  });
});
