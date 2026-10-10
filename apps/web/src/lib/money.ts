/**
 * Форматирует денежную сумму в тенге (KZT).
 * При передаче невалидных чисел (NaN, null, undefined, Infinity) возвращает аккуратный символ "—".
 */
export function formatKzt(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }
  return Math.round(amount)
    .toLocaleString("ru-RU")
    .replace(/\u00A0/g, " ")
    .replace(/,/g, " ");
}
