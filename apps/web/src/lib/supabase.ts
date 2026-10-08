import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "./config";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) {
    return client;
  }

  const config = getPublicSupabaseConfig();
  if (!config.ok) {
    throw new Error(config.reason);
  }

  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

/**
 * Проверяет, что операция записи/удаления (UPDATE, DELETE с .select()) вернула ровно 1 изменённую строку.
 * Защищает от «тихих успехов» PostgREST, когда запрос обновил или удалил 0 строк.
 */
export function assertSingleRowAffected<T>(result: {
  data: T | T[] | null;
  error: unknown;
}): T {
  if (result.error) {
    throw result.error;
  }

  if (result.data === null || result.data === undefined) {
    throw new Error("Операция не затронула ни одной строки в базе данных (0 строк изменено).");
  }

  if (Array.isArray(result.data)) {
    if (result.data.length === 0) {
      throw new Error("Операция не затронула ни одной строки в базе данных (0 строк изменено).");
    }
    if (result.data.length > 1) {
      throw new Error(
        `Ожидалось изменение ровно 1 строки, но затронуто ${result.data.length} строк.`
      );
    }
    return result.data[0];
  }

  return result.data;
}
