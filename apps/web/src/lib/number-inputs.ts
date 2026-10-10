/**
 * Утилиты для ввода и форматирования чисел с пробелами разрядов и поддержкой запятой (Step U7)
 */

/**
 * Парсит число из строки с поддержкой пробелов, запятых и точек.
 * Возвращает null, если строка пуста или не является валидным числом.
 */
export function parseFlexibleNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  const cleaned = String(raw)
    .trim()
    .replace(/\s+/g, "")
    .replace("%", "")
    .replace(",", ".");

  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Форматирует целое или дробное число с пробелами разрядов (например, 1 200 000)
 */
export function formatNumberWithSpaces(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : parseFlexibleNumber(value);
  if (num === null) return String(value);

  const parts = String(num).split(".");
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
}

/**
 * Форматирует строку ввода суммы в реальном времени, добавляя разделители тысяч без потери курсора
 */
export function formatCurrencyInput(raw: string): string {
  // Убираем всё, кроме цифр
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return "";
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
