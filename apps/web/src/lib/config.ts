export type PublicSupabaseConfig =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; reason: string };

/**
 * Декодирует Payload JWT-токена (Step B5).
 * Корректно работает как в браузере (atob), так и в Node.js / тестах (Buffer).
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    let jsonStr = "";
    if (typeof atob === "function") {
      jsonStr = atob(base64);
    } else {
      const maybeBuffer = (globalThis as unknown as {
        Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
      }).Buffer;
      if (maybeBuffer) {
        jsonStr = maybeBuffer.from(base64, "base64").toString("utf-8");
      } else {
        return null;
      }
    }

    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Проверяет, что токен не является ключом администратора (service_role) (Step B5).
 */
export function validateAnonKeyRole(anonKey: string): { valid: boolean; reason?: string } {
  if (anonKey.includes("service_role")) {
    return {
      valid: false,
      reason: "В интерфейсе нельзя использовать ключ service_role. Нужен только anon-ключ.",
    };
  }

  const payload = decodeJwtPayload(anonKey);
  if (payload && (payload.role === "service_role" || payload.role === "service")) {
    return {
      valid: false,
      reason: "В интерфейсе нельзя использовать ключ service_role. Нужен только anon-ключ.",
    };
  }

  return { valid: true };
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) {
    return {
      ok: false,
      reason:
        "Не заданы публичные переменные VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY. Скопируйте .env.example в apps/web/.env.",
    };
  }

  const roleCheck = validateAnonKeyRole(anonKey);
  if (!roleCheck.valid) {
    return {
      ok: false,
      reason:
        roleCheck.reason ??
        "В интерфейсе нельзя использовать ключ service_role. Нужен только anon-ключ.",
    };
  }

  return { ok: true, url, anonKey };
}
