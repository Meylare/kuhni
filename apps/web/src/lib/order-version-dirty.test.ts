import { describe, expect, it } from "vitest";
import type { CalculationParameters } from "@kuhni/calc";
import type { OrderCalculation } from "../types/database";
import { getVersionSyncStatus, isDirtySince } from "./calculation-versions";

describe("Step U4: isDirtySince and getVersionSyncStatus", () => {
  const baseParams: CalculationParameters = {
    targetMarginPct: 0.18,
    assemblyMode: "percent",
    assemblyPct: 0.145,
    assemblyPerMeterKitchen: 35000,
    assemblyPerMeterWardrobe: 25000,
    technologMode: "percent",
    technologPct: 0.04,
    technologPerSheet: 4000,
    riskReservePct: 0.02,
    priceRounding: 1000,
  };

  const sampleCalcVersion: OrderCalculation = {
    id: "calc-ver-1",
    order_id: "ord-1",
    version: 3,
    mode: "quote",
    is_contract_baseline: false,
    params_snapshot: baseParams as unknown as Record<string, unknown>,
    input_snapshot: {
      contractPrice: null,
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
          wastePct: 0.1,
          billableQtyRounding: "ceil",
          countsForTechnolog: true,
          isManual: false,
          comment: "",
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
          wastePct: 0,
          billableQtyRounding: "none",
          countsForTechnolog: false,
          isManual: false,
          comment: null,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    },
    result: {
      costTotal: 250000,
      priceTotal: 340000,
      margin: 90000,
      marginPct: 0.26,
      fixedCost: 30000,
      fixedAssembly: 20000,
      fixedTechnolog: 10000,
      assembly: 20000,
      technolog: 10000,
      riskReserve: 0,
      minPriceForTargetMargin: 310000,
      warnings: [],
      categoryTotals: {},
      lineCalculations: [],
    },
    cost_total: 250000,
    price_total: 340000,
    margin_pct: 0.26,
    created_at: "2026-10-05T12:00:00Z",
  };

  it("returns false and 'synced' status when current input is identical to version", () => {
    const currentInput = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: { ...baseParams },
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
          wastePct: 0.1,
          billableQtyRounding: "ceil",
          countsForTechnolog: true,
          isManual: false,
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
          wastePct: 0,
          billableQtyRounding: "none",
          countsForTechnolog: false,
          isManual: false,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(false);

    const status = getVersionSyncStatus(sampleCalcVersion, currentInput);
    expect(status.type).toBe("synced");
    expect(status.label).toBe("Совпадает с версией 3");
    expect(status.isDirty).toBe(false);
  });

  it("order of lines does not affect comparison (order-independent)", () => {
    const currentInputReordered = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: { ...baseParams },
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      // lines are reversed in array
      lines: [
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
          wastePct: 0,
          billableQtyRounding: "none",
          countsForTechnolog: false,
          isManual: false,
        },
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
          wastePct: 0.1,
          billableQtyRounding: "ceil",
          countsForTechnolog: true,
          isManual: false,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInputReordered)).toBe(false);
  });

  it("detects changes in line quantity", () => {
    const currentInput = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: { ...baseParams },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 7, // was 6
          unitPrice: 16500,
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(true);

    const status = getVersionSyncStatus(sampleCalcVersion, currentInput);
    expect(status.type).toBe("dirty");
    expect(status.label).toBe("Есть изменения после версии 3");
    expect(status.isDirty).toBe(true);
  });

  it("detects changes in line price", () => {
    const currentInput = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: { ...baseParams },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 18000, // was 16500
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(true);
  });

  it("detects added line", () => {
    const currentInput = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: { ...baseParams },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
        },
        {
          id: "line-3",
          name: "Ручка профиль Gola",
          category: "hardware",
          unit: "пог. м",
          qty: 4,
          unitPrice: 3200,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(true);
  });

  it("detects removed line", () => {
    const currentInput = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: { ...baseParams },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(true);
  });

  it("detects mode change from quote to check_contract", () => {
    const currentInput = {
      mode: "check_contract" as const, // was quote
      contractPrice: 340000,
      parameters: { ...baseParams },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(true);
  });

  it("detects contract price change", () => {
    const contractVersion: OrderCalculation = {
      ...sampleCalcVersion,
      mode: "check_contract",
      input_snapshot: {
        ...sampleCalcVersion.input_snapshot,
        contractPrice: 350000,
      },
    };

    const currentInputWithDifferentPrice = {
      mode: "check_contract" as const,
      contractPrice: 360000, // was 350000
      parameters: { ...baseParams },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(contractVersion, currentInputWithDifferentPrice)).toBe(true);
  });

  it("detects parameter change (e.g. targetMarginPct)", () => {
    const currentInput = {
      mode: "quote" as const,
      contractPrice: null,
      parameters: {
        ...baseParams,
        targetMarginPct: 0.22, // was 0.18
      },
      lines: [
        {
          id: "line-1",
          priceItemId: "pi-ldsp",
          orderItemId: "item-1",
          name: "ЛДСП Дуб Вотан",
          category: "materials",
          unit: "лист",
          qty: 6,
          unitPrice: 16500,
        },
        {
          id: "line-2",
          priceItemId: "pi-petli",
          orderItemId: "item-1",
          name: "Петля Blum с доводчиком",
          category: "hardware",
          unit: "шт",
          qty: 24,
          unitPrice: 1850,
        },
      ],
      items: [
        {
          id: "item-1",
          title: "Кухонный гарнитур",
          kind: "kitchen",
          linearMeters: 3.5,
        },
      ],
      adjustments: [
        {
          id: "adj-1",
          kind: "price",
          label: "Скидка новосёлам",
          amount: -15000,
        },
      ],
    };

    expect(isDirtySince(sampleCalcVersion, currentInput)).toBe(true);
  });

  it("returns 'no_versions' status when there is no saved calculation", () => {
    const currentInput = {
      mode: "quote" as const,
      parameters: { ...baseParams },
      lines: [],
      items: [],
      adjustments: [],
    };

    expect(isDirtySince(null, currentInput)).toBe(false);

    const status = getVersionSyncStatus(null, currentInput);
    expect(status.type).toBe("no_versions");
    expect(status.label).toBe("Версий пока нет");
    expect(status.isDirty).toBe(false);
  });
});
