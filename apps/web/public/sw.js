const CACHE = "kuhni-shell-v3";

const STATIC_ASSET_REGEX =
  /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|webmanifest|json)$/i;

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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

function isHtmlFallthroughForScriptOrStyle(pathname, response) {
  if (!response) return false;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (/\.(?:js|css)$/i.test(pathname) && contentType.includes("text/html")) {
    return true;
  }
  return false;
}

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

  // 2. Никогда не кэшировать запросы к API и самому sw.js
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/rest") ||
    url.pathname.endsWith("/sw.js")
  ) {
    return;
  }

  // 3. Для SPA-навигации и HTML: сначала сеть (с обновлением кэша), при офлайне — кэш
  if (
    event.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put("./index.html", copy))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 4. Только статические ассеты собственного домена
  if (!STATIC_ASSET_REGEX.test(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const validCached =
        cachedResponse &&
        !isHtmlFallthroughForScriptOrStyle(url.pathname, cachedResponse)
          ? cachedResponse
          : undefined;

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.ok &&
            networkResponse.type === "basic" &&
            !isHtmlFallthroughForScriptOrStyle(url.pathname, networkResponse)
          ) {
            const copy = networkResponse.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => validCached);

      return validCached || fetchPromise;
    })
  );
});
