export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss?: () => void;
}

export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md sm:bottom-6 sm:right-6 sm:left-auto">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#141418]/95 p-3.5 text-white shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
          <span className="text-sm">🗑</span>
          <span>{message}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            className="flex min-h-9 items-center justify-center rounded-xl bg-amber-400 px-3.5 text-xs font-semibold text-black shadow-md hover:bg-amber-300 active:scale-95 transition-all cursor-pointer"
          >
            Отменить
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-xl text-zinc-500 hover:text-white transition-colors cursor-pointer"
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
