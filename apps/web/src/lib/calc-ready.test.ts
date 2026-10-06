import { describe, expect, it } from "vitest";

import { isCalcModuleReady } from "./calc-ready";
import { formatKzt } from "./money";

describe("связь с packages/calc", () => {
  it("вызывает чистую функцию расчёта из workspace-пакета", () => {
    expect(isCalcModuleReady()).toBe(true);
  });
});

describe("формат денег", () => {
  it("форматирует тенге с разделителем тысяч", () => {
    expect(formatKzt(886_000)).toBe("886 000");
  });
});
