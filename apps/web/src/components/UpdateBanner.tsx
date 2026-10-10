import { useEffect, useState } from "react";

/**
 * Ненавязчивый баннер об обновлении Service Worker.
 * При обнаружении нового воркера предлагает обновить приложение.
 */
export function UpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    function handleRegistration(reg: ServiceWorkerRegistration) {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) handleRegistration(reg);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  if (!waitingWorker) return null;

  function handleUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-stone-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xs flex items-center justify-between gap-3 border border-stone-800"
    >
      <div className="flex items-center gap-2 text-xs md:text-sm font-medium">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Доступно обновление приложения</span>
      </div>
      <button
        type="button"
        onClick={handleUpdate}
        className="min-h-11 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs md:text-sm font-semibold text-white transition-all shadow-xs"
      >
        Обновить
      </button>
    </div>
  );
}
