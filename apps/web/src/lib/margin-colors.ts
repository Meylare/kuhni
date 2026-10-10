export interface MarginColorStyle {
  text: string;
  bg: string;
  border: string;
  badge: string;
  status: "success" | "warning" | "danger" | "neutral";
}

/**
 * Логика выбора цвета маржи (U3.5):
 * - зелёный при марже не ниже целевой (margin >= targetMargin)
 * - жёлтый ниже цели (0 <= margin < targetMargin)
 * - красный при отрицательной марже (margin < 0)
 * - нейтральный при отсутствии маржи (null / undefined)
 */
export function getMarginColor(
  marginPct: number | null | undefined,
  targetMarginPct: number = 0.18
): MarginColorStyle {
  if (marginPct === null || marginPct === undefined || !Number.isFinite(marginPct)) {
    return {
      text: "text-stone-700",
      bg: "bg-stone-50",
      border: "border-stone-200",
      badge: "bg-stone-100 text-stone-700 border-stone-200",
      status: "neutral",
    };
  }

  // Отрицательная маржа
  if (marginPct < -0.0001) {
    return {
      text: "text-rose-700",
      bg: "bg-rose-50",
      border: "border-rose-300",
      badge: "bg-rose-100 text-rose-800 border-rose-300",
      status: "danger",
    };
  }

  // Маржа ниже целевой
  if (marginPct < targetMarginPct - 0.0001) {
    return {
      text: "text-amber-800",
      bg: "bg-amber-50",
      border: "border-amber-300",
      badge: "bg-amber-100 text-amber-900 border-amber-300",
      status: "warning",
    };
  }

  // Маржа на уровне цели или выше
  return {
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    badge: "bg-emerald-100 text-emerald-900 border-emerald-300",
    status: "success",
  };
}
