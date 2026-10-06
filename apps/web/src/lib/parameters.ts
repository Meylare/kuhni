import type { ParameterItem } from "../types/database";

export type ParameterType = "percent" | "currency" | "select" | "number";

export interface ParameterDefinition {
  key: string;
  name: string;
  description: string;
  group: "margin_rounding" | "assembly" | "technolog" | "waste_risk";
  type: ParameterType;
  unit: string;
  options?: { value: string; label: string }[];
}

export const PARAMETER_GROUPS: Record<
  ParameterDefinition["group"],
  { title: string; description: string }
> = {
  margin_rounding: {
    title: "Маржа и округление",
    description: "Целевая рентабельность проекта и шаг округления итоговой цены.",
  },
  assembly: {
    title: "Сборка",
    description: "Настройки оплаты сборщикам: процент от цены или фиксированная ставка за метр.",
  },
  technolog: {
    title: "Технолог (Базис)",
    description: "Оплата услуг технолога: процент от цены или ставка за лист ЛДСП.",
  },
  waste_risk: {
    title: "Отходы и риски",
    description: "Плановый процент технологических отходов кромки и финансовый резерв.",
  },
};

export const PARAMETER_DEFINITIONS: Record<string, ParameterDefinition> = {
  target_margin_pct: {
    key: "target_margin_pct",
    name: "Целевая маржа",
    description: "Доля маржи в цене договора (по умолчанию 18%).",
    group: "margin_rounding",
    type: "percent",
    unit: "%",
  },
  price_rounding: {
    key: "price_rounding",
    name: "Округление цены",
    description: "Округление цены до ближайшего кратного значения (по умолчанию 1 000 ₸).",
    group: "margin_rounding",
    type: "currency",
    unit: "₸",
  },
  assembly_mode: {
    key: "assembly_mode",
    name: "Режим расчёта сборки",
    description: "Способ начисления сборки: процент от цены договора или за погонный метр изделия.",
    group: "assembly",
    type: "select",
    unit: "",
    options: [
      { value: "percent", label: "Процент от цены" },
      { value: "per_meter", label: "За погонный метр" },
    ],
  },
  assembly_pct: {
    key: "assembly_pct",
    name: "Сборка, доля от цены",
    description: "Процент на сборку при процентном режиме (по умолчанию 14,5%).",
    group: "assembly",
    type: "percent",
    unit: "%",
  },
  assembly_per_meter_kitchen: {
    key: "assembly_per_meter_kitchen",
    name: "Сборка кухни за пог. метр",
    description: "Ставка за 1 погонный метр кухни при расчёте по метражу.",
    group: "assembly",
    type: "currency",
    unit: "₸/м",
  },
  assembly_per_meter_wardrobe: {
    key: "assembly_per_meter_wardrobe",
    name: "Сборка шкафа за пог. метр",
    description: "Ставка за 1 погонный метр шкафа при расчёте по метражу.",
    group: "assembly",
    type: "currency",
    unit: "₸/м",
  },
  technolog_mode: {
    key: "technolog_mode",
    name: "Режим расчёта технолога",
    description: "Способ начисления технологу: процент от цены договора или за каждый лист ЛДСП.",
    group: "technolog",
    type: "select",
    unit: "",
    options: [
      { value: "percent", label: "Процент от цены" },
      { value: "per_sheet", label: "За лист ЛДСП" },
    ],
  },
  technolog_pct: {
    key: "technolog_pct",
    name: "Технолог, доля от цены",
    description: "Процент на технолога при процентном режиме (по умолчанию 4%).",
    group: "technolog",
    type: "percent",
    unit: "%",
  },
  technolog_per_sheet: {
    key: "technolog_per_sheet",
    name: "Технолог за лист ЛДСП",
    description: "Ставка технологу за лист ЛДСП в проекте (по умолчанию 4 000 ₸).",
    group: "technolog",
    type: "currency",
    unit: "₸/лист",
  },
  waste_edge_pct: {
    key: "waste_edge_pct",
    name: "Отход кромки",
    description: "Плановый процент запаса кромки на подрезку (по умолчанию 10%).",
    group: "waste_risk",
    type: "percent",
    unit: "%",
  },
  risk_reserve_pct: {
    key: "risk_reserve_pct",
    name: "Резерв на риск",
    description: "Дополнительный страховой резерв от цены (по умолчанию 0%).",
    group: "waste_risk",
    type: "percent",
    unit: "%",
  },
};

/**
 * Преобразует долю (0.145) в человеческий процент ("14,5%").
 */
export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
    return "0 %";
  }
  const pct = fraction * 100;
  // Округляем до 3 знаков после запятой максимум, убирая лишние хвостовые нули
  const formatted = Number(pct.toFixed(3))
    .toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    .replace(/\u00A0/g, " ");
  return `${formatted} %`;
}

/**
 * Парсит пользовательский ввод процента ("14,5", "14.5%", "18") в десятичную долю (0.145, 0.18).
 */
export function parsePercent(input: string): number | null {
  const cleaned = input
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .trim();

  if (cleaned === "") {
    return null;
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }

  // Человеческий ввод: 14.5 -> 0.145
  // Округляем для исключения артефактов IEEE-754
  return Math.round(num * 10000) / 1000000;
}

export interface ParametersMap {
  target_margin_pct: number;
  assembly_mode: "percent" | "per_meter";
  assembly_pct: number;
  assembly_per_meter_kitchen: number;
  assembly_per_meter_wardrobe: number;
  technolog_mode: "percent" | "per_sheet";
  technolog_pct: number;
  technolog_per_sheet: number;
  waste_edge_pct: number;
  risk_reserve_pct: number;
  price_rounding: number;
}

export const DEFAULT_PARAMETERS: ParametersMap = {
  target_margin_pct: 0.18,
  assembly_mode: "percent",
  assembly_pct: 0.145,
  assembly_per_meter_kitchen: 35000,
  assembly_per_meter_wardrobe: 25000,
  technolog_mode: "percent",
  technolog_pct: 0.04,
  technolog_per_sheet: 4000,
  waste_edge_pct: 0.10,
  risk_reserve_pct: 0,
  price_rounding: 1000,
};

export function parametersArrayToMap(rows: ParameterItem[]): ParametersMap {
  const map: ParametersMap = { ...DEFAULT_PARAMETERS };

  for (const row of rows) {
    if (row.key === "target_margin_pct" && row.value_num !== null) {
      map.target_margin_pct = Number(row.value_num);
    } else if (
      row.key === "assembly_mode" &&
      (row.value_text === "percent" || row.value_text === "per_meter")
    ) {
      map.assembly_mode = row.value_text;
    } else if (row.key === "assembly_pct" && row.value_num !== null) {
      map.assembly_pct = Number(row.value_num);
    } else if (row.key === "assembly_per_meter_kitchen" && row.value_num !== null) {
      map.assembly_per_meter_kitchen = Number(row.value_num);
    } else if (row.key === "assembly_per_meter_wardrobe" && row.value_num !== null) {
      map.assembly_per_meter_wardrobe = Number(row.value_num);
    } else if (
      row.key === "technolog_mode" &&
      (row.value_text === "percent" || row.value_text === "per_sheet")
    ) {
      map.technolog_mode = row.value_text;
    } else if (row.key === "technolog_pct" && row.value_num !== null) {
      map.technolog_pct = Number(row.value_num);
    } else if (row.key === "technolog_per_sheet" && row.value_num !== null) {
      map.technolog_per_sheet = Number(row.value_num);
    } else if (row.key === "waste_edge_pct" && row.value_num !== null) {
      map.waste_edge_pct = Number(row.value_num);
    } else if (row.key === "risk_reserve_pct" && row.value_num !== null) {
      map.risk_reserve_pct = Number(row.value_num);
    } else if (row.key === "price_rounding" && row.value_num !== null) {
      map.price_rounding = Number(row.value_num);
    }
  }

  return map;
}

/**
 * Вычисляет знаменатель формулы расчёта цены:
 * 1 - target_margin_pct - assembly_pct - technolog_pct - risk_reserve_pct
 */
export function calculateDenominator(params: ParametersMap): number {
  const assemblyFraction =
    params.assembly_mode === "percent" ? params.assembly_pct : 0;
  const technologFraction =
    params.technolog_mode === "percent" ? params.technolog_pct : 0;

  return (
    1 -
    params.target_margin_pct -
    assemblyFraction -
    technologFraction -
    params.risk_reserve_pct
  );
}

// Вспомогательная функция для чистой доли
function safeFraction(val: number): number {
  return Number.isFinite(val) ? val : 0;
}


export function evaluateDenominator(params: ParametersMap): {
  denominator: number;
  sumPercentShares: number;
  status: "ok" | "warning" | "error";
  message?: string;
} {
  const assemblyShare =
    params.assembly_mode === "percent" ? safeFraction(params.assembly_pct) : 0;
  const technologShare =
    params.technolog_mode === "percent" ? safeFraction(params.technolog_pct) : 0;
  const marginShare = safeFraction(params.target_margin_pct);
  const riskShare = safeFraction(params.risk_reserve_pct);

  const sumPercentShares = marginShare + assemblyShare + technologShare + riskShare;
  const denominator = 1 - sumPercentShares;

  if (denominator <= 0) {
    return {
      denominator,
      sumPercentShares,
      status: "error",
      message:
        "Критическая ошибка: сумма процентных ставок и маржи ≥ 100% (знаменатель ≤ 0). При таких параметрах расчёт цены невозможен.",
    };
  }

  if (denominator <= 0.05) {
    const denomPct = (denominator * 100).toFixed(1).replace(".", ",");
    const sumPct = (sumPercentShares * 100).toFixed(1).replace(".", ",");
    return {
      denominator,
      sumPercentShares,
      status: "warning",
      message: `Внимание: сумма процентных ставок равна ${sumPct}% (знаменатель формулы ${denomPct}% ≤ 5%). Расчёт цены может давать экстремально высокие значения.`,
    };
  }

  return {
    denominator,
    sumPercentShares,
    status: "ok",
  };
}
