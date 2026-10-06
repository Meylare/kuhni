export function formatKzt(amount: number): string {
  return Math.round(amount)
    .toLocaleString("ru-RU")
    .replace(/\u00A0/g, " ")
    .replace(/,/g, " ");
}
