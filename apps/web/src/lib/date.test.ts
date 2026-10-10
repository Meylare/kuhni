import { describe, expect, it } from "vitest";
import { getLocalTodayDateString } from "./date";

describe("getLocalTodayDateString", () => {
  it("возвращает корректную дату YYYY-MM-DD для ночного времени в Казахстане (GMT+5)", () => {
    // В 20:30 UTC 10 октября в Казахстане (UTC+5) уже 01:30 11 октября.
    // Стандартный toISOString().slice(0, 10) вернул бы 2026-10-10.
    const lateNightUtc = new Date("2026-10-10T20:30:00Z");
    expect(getLocalTodayDateString(lateNightUtc)).toBe("2026-10-11");
  });

  it("возвращает корректную дату для дневного времени", () => {
    const middayUtc = new Date("2026-10-10T10:00:00Z");
    expect(getLocalTodayDateString(middayUtc)).toBe("2026-10-10");
  });

  it("соответствует формату YYYY-MM-DD", () => {
    const today = getLocalTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
