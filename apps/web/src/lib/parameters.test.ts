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
    expect(parsePercent("0%")).toBe(0);
    expect(parsePercent("1")).toBe(0.01);
    expect(parsePercent("1%")).toBe(0.01);
  });

  it("интерпретирует число в диапазоне (0, 1) без знака % как десятичную долю (0.18 -> 0.18)", () => {
    expect(parsePercent("0.18")).toBe(0.18);
    expect(parsePercent("0,18")).toBe(0.18);
    expect(parsePercent("0.04")).toBe(0.04);
    expect(parsePercent("0,04")).toBe(0.04);
    expect(parsePercent("0.145")).toBe(0.145);
    expect(parsePercent("0.5")).toBe(0.5);
  });

  it("сохраняет явное указание знака % для малых долей (0.18% -> 0.0018)", () => {
    expect(parsePercent("0.18%")).toBe(0.0018);
    expect(parsePercent("0,5%")).toBe(0.005);
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

  it("выдаёт предупреждение, когда маржа > 50%", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.55,
      assembly_pct: 0.05,
      technolog_pct: 0.02,
    });
    expect(res.status).toBe("warning");
    expect(res.message).toContain("маржа");
  });

  it("выдаёт предупреждение, когда сумма процентных ставок > 70%", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.40,
      assembly_pct: 0.25,
      technolog_pct: 0.10, // sum = 0.75 > 0.70
    });
    expect(res.status).toBe("warning");
    expect(res.message).toContain("70%");
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

  it("выдаёт критическую ошибку, когда знаменатель ≤ 0 (сумма ставок >= 100%)", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.6,
      assembly_pct: 0.3,
      technolog_pct: 0.15, // sum = 1.05 => denominator = -0.05
    });
    expect(res.status).toBe("error");
    expect(res.message).toContain("Критическая ошибка");
  });

  it("выдаёт критическую ошибку ровно при 100% сумме ставок (знаменатель = 0)", () => {
    const res = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.5,
      assembly_pct: 0.4,
      technolog_pct: 0.1, // sum = 1.0 => denominator = 0
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
