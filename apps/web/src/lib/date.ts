/**
 * Утилиты для работы с датами по местному времени клиента (Казахстан, GMT+5).
 */

/**
 * Возвращает дату в формате YYYY-MM-DD для Казахстана (GMT+5) / местного пояса клиента.
 * Устраняет ошибку смещения даты при использовании UTC toISOString().slice(0, 10).
 */
export function getLocalTodayDateString(date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
