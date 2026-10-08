import { describe, expect, it } from "vitest";

import { assertSingleRowAffected } from "./supabase";

describe("assertSingleRowAffected", () => {
  it("возвращает объект, если в массиве ровно одна строка", () => {
    const row = { id: "123", name: "Тестовая позиция" };
    const result = assertSingleRowAffected({ data: [row], error: null });
    expect(result).toEqual(row);
  });

  it("возвращает объект, если передан одиночный объект", () => {
    const row = { id: "456", name: "Одиночная запись" };
    const result = assertSingleRowAffected({ data: row, error: null });
    expect(result).toEqual(row);
  });

  it("бросает ошибку, если data пустой массив (0 строк затронуто)", () => {
    expect(() =>
      assertSingleRowAffected({ data: [], error: null })
    ).toThrow("0 строк изменено");
  });

  it("бросает ошибку, если data null (0 строк затронуто)", () => {
    expect(() =>
      assertSingleRowAffected({ data: null, error: null })
    ).toThrow("0 строк изменено");
  });

  it("бросает ошибку, если затронуто более одной строки", () => {
    const rows = [{ id: "1" }, { id: "2" }];
    expect(() =>
      assertSingleRowAffected({ data: rows, error: null })
    ).toThrow("Ожидалось изменение ровно 1 строки, но затронуто 2 строк.");
  });

  it("пробрасывает исходную ошибку, если result.error задан", () => {
    const dbErr = new Error("Database connection lost");
    expect(() =>
      assertSingleRowAffected({ data: null, error: dbErr })
    ).toThrow("Database connection lost");
  });
});
