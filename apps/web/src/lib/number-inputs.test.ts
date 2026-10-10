import { describe, expect, it } from "vitest";
import {
  formatCurrencyInput,
  formatNumberWithSpaces,
  parseFlexibleNumber,
} from "./number-inputs";

describe("Step U7: number inputs utilities", () => {
  it("parses flexible numbers with comma, dots and spaces", () => {
    expect(parseFlexibleNumber("3,5")).toBe(3.5);
    expect(parseFlexibleNumber("3.5")).toBe(3.5);
    expect(parseFlexibleNumber(" 14,5% ")).toBe(14.5);
    expect(parseFlexibleNumber("850 000")).toBe(850000);
    expect(parseFlexibleNumber("1 250 500,75")).toBe(1250500.75);
    expect(parseFlexibleNumber("")).toBeNull();
    expect(parseFlexibleNumber(null)).toBeNull();
  });

  it("formats numbers with space separators", () => {
    expect(formatNumberWithSpaces(850000)).toBe("850 000");
    expect(formatNumberWithSpaces(1200000)).toBe("1 200 000");
    expect(formatNumberWithSpaces(500)).toBe("500");
    expect(formatNumberWithSpaces(10000000)).toBe("10 000 000");
  });

  it("formats currency live input strings", () => {
    expect(formatCurrencyInput("850000")).toBe("850 000");
    expect(formatCurrencyInput("1200000")).toBe("1 200 000");
    expect(formatCurrencyInput("12000000")).toBe("12 000 000");
    expect(formatCurrencyInput("")).toBe("");
  });
});
