export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss?: () => void;
}

export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md sm:bottom-6 sm:right-6 sm:left-auto">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-800 bg-stone-900 p-3.5 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-base">🗑</span>
          <span>{message}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            className="flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-4 text-xs font-bold text-stone-950 shadow-xs hover:bg-amber-400 active:scale-95 transition-all"
          >
            Отменить
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 hover:text-white"
              title="Закрыть"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
