/**
 * Преобразует технические ошибки Supabase / Postgres / RLS в понятные сообщения на русском языке.
 * Требование ТЗ (раздел 5.6): "Все запросы идут под пользователем (RLS). Если запрос отклонён из-за прав, показать понятное сообщение."
 */
export function formatErrorMessage(err: unknown, fallback = "Произошла непредвиденная ошибка"): string {
  if (!err) return fallback;

  const rawMessage = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  // Ошибки RLS (Row Level Security) и доступа
  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("violates row-level security policy") ||
    lower.includes("permission denied") ||
    lower.includes("not allowed")
  ) {
    return "Доступ ограничен. Только владелец имеет право изменять эти данные.";
  }

  // Ошибки соединения / сети
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  ) {
    return "Нет связи с сервером. Проверьте интернет-соединение.";
  }

  // Ошибки уникальности / ограничений базы данных
  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "Запись с такими данными уже существует.";
  }

  if (lower.includes("foreign key") || lower.includes("violates foreign key")) {
    return "Невозможно выполнить операцию: запись связана с другими объектами.";
  }

  if (lower.includes("jwt expired") || lower.includes("session expired")) {
    return "Срок действия сессии истёк. Пожалуйста, выполните повторный вход.";
  }

  return rawMessage;
}
