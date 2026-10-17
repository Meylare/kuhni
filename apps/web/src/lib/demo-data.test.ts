import { describe, expect, it } from "vitest";
import { getInitialDemoState, DEMO_PRICE_ITEMS } from "./demo-data";

describe("demo-data", () => {
  it("initializes with 4 realistic demo orders", () => {
    const state = getInitialDemoState();
    expect(state.orders.length).toBe(4);
    expect(state.priceItems.length).toBeGreaterThan(10);
    expect(state.orders[0].name).toContain("Highvill");
  });

  it("contains valid lines and items for the kitchen order", () => {
    const state = getInitialDemoState();
    const order1Id = state.orders[0].id;
    const items = state.items[order1Id];
    const lines = state.lines[order1Id];

    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.some((l) => l.name.toLowerCase().includes("egger"))).toBe(true);
    expect(lines.some((l) => l.name.toLowerCase().includes("blum"))).toBe(true);
  });

  it("catalog includes materials, facades, hardware and services", () => {
    const categories = new Set(DEMO_PRICE_ITEMS.map((p) => p.category));
    expect(categories.has("materials")).toBe(true);
    expect(categories.has("facades")).toBe(true);
    expect(categories.has("hardware")).toBe(true);
    expect(categories.has("transport")).toBe(true);
  });

  it("includes demo templates with lines", () => {
    const state = getInitialDemoState();
    expect(state.templates.length).toBeGreaterThanOrEqual(2);
    const kitchenTpl = state.templates.find((t) => t.name.includes("Кухня"));
    expect(kitchenTpl).toBeDefined();
    expect(kitchenTpl!.lines?.length).toBeGreaterThan(0);
  });
});
