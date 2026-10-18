import { Component, type ErrorInfo, type ReactNode } from "react";

export function isStaleChunkError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lower = msg.toLowerCase();
  return (
    lower.includes("not a valid javascript mime type") ||
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("importing a module script failed") ||
    lower.includes("error loading dynamically imported module") ||
    lower.includes("unable to preload css")
  );
}

export async function reloadClearingSwCaches(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
  } catch {
    // ignore cache cleanup errors
  }
  window.location.reload();
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    if (typeof window !== "undefined" && isStaleChunkError(error)) {
      const key = "kuhni_eb_chunk_reload_ts";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        void reloadClearingSwCaches();
      }
    }
  }

  handleReload = () => {
    void reloadClearingSwCaches();
  };

  handleReset = () => {
    if (this.state.error && isStaleChunkError(this.state.error)) {
      void reloadClearingSwCaches();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-8 text-center text-zinc-100">
          <div className="rounded-3xl border border-white/10 bg-[#141418] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <span className="text-4xl">⚠️</span>
            <h1 className="mt-3 text-lg font-semibold text-white tracking-tight">
              Что-то пошло не так
            </h1>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Произошла непредвиденная ошибка в интерфейсе. Ваши данные в безопасности.
            </p>
            {this.state.error?.message && (
              <div className="mt-3 rounded-2xl bg-zinc-950 p-3 text-left font-mono text-[11px] text-rose-300 border border-rose-500/20 break-words">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="min-h-11 w-full rounded-xl bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer shadow-md"
              >
                Попробовать снова
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-98 transition-all cursor-pointer"
              >
                Перезагрузить страницу
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
