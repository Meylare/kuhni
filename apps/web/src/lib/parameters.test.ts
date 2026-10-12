import { describe, expect, it } from "vitest";

import {
  DEFAULT_PARAMETERS,
  evaluateDenominator,
  formatPercent,
  formatMarginPercent,
  formatPercentInput,
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

  it("форматирует отрицательные и экстремально отрицательные значения маржи", () => {
    expect(formatPercent(-0.18)).toBe("-18 %");
    expect(formatPercent(-0.5)).toBe("-50 %");
    expect(formatPercent(-8.27)).toBe("-827 %");
    expect(formatPercent(-9.99)).toBe("-999 %");
    expect(formatPercent(-9.99185)).toBe("< −999 %");
    expect(formatPercent(-100)).toBe("< −999 %");
  });
});

describe("formatMarginPercent", () => {
  it("форматирует маржу с округлением до 1 знака или без знаков при целых числах", () => {
    expect(formatMarginPercent(0.18)).toBe("18 %");
    expect(formatMarginPercent(0.15)).toBe("15 %");
    expect(formatMarginPercent(0.15029)).toBe("15 %");
    expect(formatMarginPercent(0.152)).toBe("15,2 %");
    expect(formatMarginPercent(0.145)).toBe("14,5 %");
    expect(formatMarginPercent(0.04)).toBe("4 %");
    expect(formatMarginPercent(0)).toBe("0 %");
    expect(formatMarginPercent(null)).toBe("—");
    expect(formatMarginPercent(undefined)).toBe("—");
    expect(formatMarginPercent(-0.052)).toBe("-5,2 %");
    expect(formatMarginPercent(-100)).toBe("< −999 %");
  });
});

describe("formatPercentInput", () => {
  it("преобразует долю в чистое строковое значение поля ввода без мусора IEEE-754", () => {
    // 0.145 * 100 в JS дает 14.499999999999998
    expect(formatPercentInput(0.145)).toBe("14,5");
    expect(formatPercentInput(0.18)).toBe("18");
    expect(formatPercentInput(0.04)).toBe("4");
    expect(formatPercentInput(0.10)).toBe("10");
    expect(formatPercentInput(0)).toBe("0");
    expect(formatPercentInput(null)).toBe("0");
    expect(formatPercentInput(undefined)).toBe("0");
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

  it("выдаёт предупреждение на границе суммы долей ровно 80% и ошибку при превышении 80%", () => {
    const resBoundary = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.5,
      assembly_pct: 0.2,
      technolog_pct: 0.1, // sum = 0.80
    });
    expect(resBoundary.status).toBe("warning");
    expect(resBoundary.message).toContain("70%");

    const resOver = evaluateDenominator({
      ...DEFAULT_PARAMETERS,
      target_margin_pct: 0.501,
      assembly_pct: 0.2,
      technolog_pct: 0.1, // sum = 0.801 > 0.80
    });
    expect(resOver.status).toBe("error");
    expect(resOver.message).toContain("превышает максимально допустимые 80%");
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
