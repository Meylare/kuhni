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
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-[#141418]/95 px-4 py-3 text-white shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-3 border border-white/10"
    >
      <div className="flex items-center gap-2 text-xs md:text-sm font-medium">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Доступно обновление приложения</span>
      </div>
      <button
        type="button"
        onClick={handleUpdate}
        className="min-h-10 px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-xs font-semibold text-black transition-all shadow-md cursor-pointer"
      >
        Обновить
      </button>
    </div>
  );
}
