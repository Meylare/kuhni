import { describe, expect, it } from "vitest";

import { formatErrorMessage } from "./errors";

describe("formatErrorMessage", () => {
  it("formats RLS errors into friendly Russian text", () => {
    const rlsError = new Error("new row violates row-level security policy for table 'orders'");
    expect(formatErrorMessage(rlsError)).toBe(
      "Доступ ограничен. Только владелец имеет право изменять эти данные.",
    );
  });

  it("formats permission denied errors", () => {
    expect(formatErrorMessage("permission denied for table price_items")).toBe(
      "Доступ ограничен. Только владелец имеет право изменять эти данные.",
    );
  });

  it("formats network / failed to fetch errors", () => {
    expect(formatErrorMessage(new Error("Failed to fetch"))).toBe(
      "Нет связи с сервером. Проверьте интернет-соединение.",
    );
  });

  it("formats unique constraint errors", () => {
    expect(formatErrorMessage("duplicate key value violates unique constraint")).toBe(
      "Запись с такими данными уже существует.",
    );
  });

  it("preserves other clear messages", () => {
    expect(formatErrorMessage(new Error("Цена должна быть больше нуля"))).toBe(
      "Цена должна быть больше нуля",
    );
  });

  it("formats order locked errors into friendly Russian text", () => {
    expect(formatErrorMessage("order_locked: Заказ утверждён и заблокирован для правок")).toBe(
      "Заказ утверждён и заблокирован для правок.",
    );
    expect(
      formatErrorMessage(
        new Error("order_locked: Заказ утверждён и заблокирован для правок: редактирование состава запрещено")
      )
    ).toBe("Заказ утверждён и заблокирован для правок.");
  });

  it("uses fallback on empty input", () => {
    expect(formatErrorMessage(null, "Что-то пошло не так")).toBe("Что-то пошло не так");
  });
});
