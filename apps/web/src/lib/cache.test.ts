import { describe, expect, it, vi } from "vitest";
import { clearAllCaches, isCacheableAssetUrl } from "./cache";

describe("isCacheableAssetUrl", () => {
  const origin = "https://kuhni.example.com";

  it("разрешает кэширование статических ассетов текущего домена", () => {
    expect(isCacheableAssetUrl("https://kuhni.example.com/assets/main.js", origin)).toBe(true);
    expect(isCacheableAssetUrl("https://kuhni.example.com/assets/index.css", origin)).toBe(true);
    expect(isCacheableAssetUrl("https://kuhni.example.com/manifest.webmanifest", origin)).toBe(true);
    expect(isCacheableAssetUrl("https://kuhni.example.com/favicon.svg", origin)).toBe(true);
    expect(isCacheableAssetUrl("https://kuhni.example.com/pwa-192.png", origin)).toBe(true);
  });

  it("запрещает кэширование любых запросов к сторонним доменам (Supabase)", () => {
    expect(isCacheableAssetUrl("https://xyz.supabase.co/rest/v1/orders", origin)).toBe(false);
    expect(isCacheableAssetUrl("https://xyz.supabase.co/storage/v1/s.png", origin)).toBe(false);
  });

  it("запрещает кэширование API-эндпоинтов текущего домена", () => {
    expect(isCacheableAssetUrl("https://kuhni.example.com/api/orders", origin)).toBe(false);
    expect(isCacheableAssetUrl("https://kuhni.example.com/rest/v1/prices", origin)).toBe(false);
  });

  it("запрещает кэширование нестатических ресурсов без расширения", () => {
    expect(isCacheableAssetUrl("https://kuhni.example.com/orders", origin)).toBe(false);
  });

  it("безопасно обрабатывает невалидные URL", () => {
    expect(isCacheableAssetUrl("not-a-valid-url", origin)).toBe(false);
  });
});

describe("clearAllCaches", () => {
  it("возвращает false, если cacheStorage не определен", async () => {
    const result = await clearAllCaches(undefined);
    expect(result).toBe(false);
  });

  it("удаляет все зарегистрированные кэши", async () => {
    const deleteMock = vi.fn().mockResolvedValue(true);
    const mockStorage = {
      keys: vi.fn().mockResolvedValue(["cache-v1", "cache-v2"]),
      delete: deleteMock,
    } as unknown as CacheStorage;

    const result = await clearAllCaches(mockStorage);
    expect(result).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith("cache-v1");
    expect(deleteMock).toHaveBeenCalledWith("cache-v2");
    expect(deleteMock).toHaveBeenCalledTimes(2);
  });
});
