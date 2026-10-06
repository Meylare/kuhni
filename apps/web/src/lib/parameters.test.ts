import { describe, expect, it } from "vitest";

import {
  DEFAULT_PARAMETERS,
  evaluateDenominator,
  formatPercent,
  parsePercent,
} from "./parameters";

describe("formatPercent", () => {
  it("форматирует десятичную долю в человеческий процент с запятой", () => {
    expect(formatPercent(0.18)).toBe("18 %");
    expect(formatPercent(0.145)).toBe("14,5 %");
    expect(formatPercent(0.04)).toBe("4 %");
    expect(formatPercent(0)).toBe("0 %");
    expect(formatPercent(null)).toBe("0 %");
    expect(formatPercent(undefined)).toBe("0 %");
  });
});

describe("parsePercent", () => {
  it("парсит процентные строки с точкой, запятой и знаком %", () => {
    expect(parsePercent("18")).toBe(0.18);
    expect(parsePercent("18%")).toBe(0.18);
    expect(parsePercent("14,5")).toBe(0.145);
    expect(parsePercent("14.5%")).toBe(0.145);
    expect(parsePercent(" 4 % ")).toBe(0.04);
    expect(parsePercent("0")).toBe(0);
    expect(parsePercent("0,5")).toBe(0.005);
  });

  it("возвращает null для некорректных строк", () => {
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
    expect(parsePercent("-5")).toBeNull();
  });
});

describe("evaluateDenominator", () => {
  it("возвращает статус ok для стандартных параметров", () => {
    const res = evaluateDenominator(DEFAULT_PARAMETERS);
    expect(res.status).toBe("ok");
    // 1 - 0.18 - 0.145 - 0.04 - 0 = 0.635
    expect(res.denominator).toBeCloseTo(0.635, 3);
  });

  it("выдаёт предупреждение, когда знаменатель ≤ 0.05", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.5,
      assembly_pct: 0.3,
      technolog_pct: 0.16, // sum = 0.96 => denominator = 0.04
    });
    expect(res.status).toBe("warning");
    expect(res.message).toContain("знаменатель формулы");
  });

  it("выдаёт критическую ошибку, когда знаменатель ≤ 0", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.6,
      assembly_pct: 0.3,
      technolog_pct: 0.15, // sum = 1.05 => denominator = -0.05
    });
    expect(res.status).toBe("error");
    expect(res.message).toContain("Критическая ошибка");
  });

  it("учитывает режим сборки per_meter (вклад сборки в процент равен 0)", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      assembly_mode: "per_meter",
      technolog_mode: "per_sheet",
      target_margin_pct: 0.18,
    });
    expect(res.status).toBe("ok");
    // 1 - 0.18 = 0.82
    expect(res.denominator).toBeCloseTo(0.82, 3);
  });
});
