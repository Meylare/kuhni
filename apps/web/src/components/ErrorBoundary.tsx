import { Component, type ErrorInfo, type ReactNode } from "react";

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
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-8 text-center">
          <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <span className="text-4xl">⚠️</span>
            <h1 className="mt-3 text-lg font-bold text-stone-900">
              Что-то пошло не так
            </h1>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              Произошла непредвиденная ошибка в интерфейсе. Ваши данные в безопасности.
            </p>
            {this.state.error?.message && (
              <div className="mt-3 rounded-xl bg-stone-100 p-3 text-left font-mono text-[11px] text-stone-700 break-words">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="min-h-11 w-full rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-98 transition-all"
              >
                Попробовать снова
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50 active:scale-98 transition-all"
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
