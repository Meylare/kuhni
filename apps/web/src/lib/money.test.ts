import { describe, expect, it } from "vitest";
import { formatKzt } from "./money";

describe("formatKzt", () => {
  it("форматирует целые положительные числа с разделением тысяч", () => {
    expect(formatKzt(861000)).toBe("861 000");
    expect(formatKzt(706025)).toBe("706 025");
    expect(formatKzt(0)).toBe("0");
  });

  it("округляет дробные числа до целого", () => {
    expect(formatKzt(1234.56)).toBe("1 235");
    expect(formatKzt(1234.2)).toBe("1 234");
  });

  it("возвращает символ тире при получении NaN, null, undefined или бесконечности", () => {
    expect(formatKzt(NaN)).toBe("—");
    expect(formatKzt(null)).toBe("—");
    expect(formatKzt(undefined)).toBe("—");
    expect(formatKzt(Infinity)).toBe("—");
    expect(formatKzt(-Infinity)).toBe("—");
  });
});
