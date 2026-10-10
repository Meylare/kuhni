const CACHE = "kuhni-shell-v2";

const STATIC_ASSET_REGEX =
  /\.(?:html|js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|webmanifest|json)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "./",
          "./index.html",
          "./manifest.webmanifest",
          "./favicon.svg",
        ])
      )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // 1. Никогда не перехватывать и не кэшировать запросы к сторонним доменам (включая *.supabase.co)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Никогда не кэшировать запросы к API
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/rest")) {
    return;
  }

  // 3. Для SPA-навигации отдавать index.html из кэша только при сбое сети
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 4. Только статические ассеты собственного домена
  if (!STATIC_ASSET_REGEX.test(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Проверяем response.ok и type === 'basic' перед записью в кэш
          if (
            networkResponse &&
            networkResponse.ok &&
            networkResponse.type === "basic"
          ) {
            const copy = networkResponse.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
