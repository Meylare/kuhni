import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttonLabel?: string;
  variant?: "error" | "warning" | "info";
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type ActiveDialog =
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      destructive: boolean;
      resolve: (value: boolean) => void;
    }
  | {
      type: "alert";
      title: string;
      message: string;
      buttonLabel: string;
      variant: "error" | "warning" | "info";
      resolve: () => void;
    }
  | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions =
        typeof options === "string" ? { message: options } : options;

      setActiveDialog({
        type: "confirm",
        title: opts.title ?? "Подтверждение",
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? "Подтвердить",
        cancelLabel: opts.cancelLabel ?? "Отмена",
        destructive: opts.destructive ?? false,
        resolve: (val: boolean) => {
          setActiveDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const opts: AlertOptions =
        typeof options === "string" ? { message: options } : options;

      setActiveDialog({
        type: "alert",
        title: opts.title ?? (opts.variant === "info" ? "Информация" : "Внимание"),
        message: opts.message,
        buttonLabel: opts.buttonLabel ?? "Понятно",
        variant: opts.variant ?? "error",
        resolve: () => {
          setActiveDialog(null);
          resolve();
        },
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {activeDialog && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4"
          onClick={() => {
            if (activeDialog.type === "confirm") {
              activeDialog.resolve(false);
            } else {
              activeDialog.resolve();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-stone-200 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {activeDialog.type === "alert" && (
                <span className="text-xl">
                  {activeDialog.variant === "error" ? "⚠️" : "ℹ️"}
                </span>
              )}
              <h3 className="text-base font-semibold text-stone-900">
                {activeDialog.title}
              </h3>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">
              {activeDialog.message}
            </p>
            <div className="flex gap-2 justify-end mt-2">
              {activeDialog.type === "confirm" && (
                <>
                  <button
                    type="button"
                    onClick={() => activeDialog.resolve(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    {activeDialog.cancelLabel}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => activeDialog.resolve(true)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
                      activeDialog.destructive
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-700 hover:bg-emerald-800"
                    }`}
                  >
                    {activeDialog.confirmLabel}
                  </button>
                </>
              )}
              {activeDialog.type === "alert" && (
                <button
                  type="button"
                  autoFocus
                  onClick={() => activeDialog.resolve()}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-sm font-medium text-white transition-colors"
                >
                  {activeDialog.buttonLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    return {
      confirm: async (opt) => {
        const msg = typeof opt === "string" ? opt : opt.message;
        return typeof window !== "undefined" && typeof window.confirm === "function"
          ? window.confirm(msg)
          : true;
      },
      alert: async (opt) => {
        const msg = typeof opt === "string" ? opt : opt.message;
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert(msg);
        }
      },
    };
  }
  return context;
}
