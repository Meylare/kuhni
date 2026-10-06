export type PublicSupabaseConfig =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; reason: string };

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

  if (anonKey.includes("service_role")) {
    return {
      ok: false,
      reason: "В интерфейсе нельзя использовать ключ service_role. Нужен только anon-ключ.",
    };
  }

  return { ok: true, url, anonKey };
}
