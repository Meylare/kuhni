/**
 * Утилиты для работы с кэшированием браузера.
 */

/**
 * Проверяет, является ли URL статическим ассетом нашего домена, допустимым для кэширования в SW.
 * Исключает запросы к сторонним сервисам (включая Supabase) и любые вызовы API.
 */
export function isCacheableAssetUrl(urlStr: string, origin: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.origin !== origin) {
      return false;
    }
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/rest")) {
      return false;
    }
    const STATIC_ASSET_REGEX =
      /\.(?:html|js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|webmanifest|json)$/i;
    return STATIC_ASSET_REGEX.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Очищает все кэши браузера (Cache Storage).
 * Вызывается при выходе из аккаунта (signOut), чтобы гарантировать отсутствие старых данных.
 */
export async function clearAllCaches(
  cacheStorage: CacheStorage | undefined = typeof caches !== "undefined"
    ? caches
    : undefined,
): Promise<boolean> {
  if (!cacheStorage) {
    return false;
  }
  try {
    const keys = await cacheStorage.keys();
    await Promise.all(keys.map((k) => cacheStorage.delete(k)));
    return true;
  } catch (error) {
    console.warn("Не удалось очистить кэш браузера:", error);
    return false;
  }
}
