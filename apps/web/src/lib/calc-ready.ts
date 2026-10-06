import { calculate, type CalculationParameters } from "@kuhni/calc";

const smokeParameters: CalculationParameters = {
  targetMarginPct: 0.18,
  assemblyMode: "percent",
  assemblyPct: 0.145,
  assemblyPerMeterKitchen: 35_000,
  assemblyPerMeterWardrobe: 25_000,
  technologMode: "percent",
  technologPct: 0.04,
  technologPerSheet: 4_000,
  riskReservePct: 0,
  priceRounding: 1_000,
};

export function isCalcModuleReady(): boolean {
  const outcome = calculate({
    mode: "quote",
    parameters: smokeParameters,
    lines: [
      {
        category: "materials",
        qty: 1,
        unitPrice: 1_000,
        wastePct: 0,
        billableQtyRounding: "none",
      },
    ],
  });

  return outcome.ok;
}
