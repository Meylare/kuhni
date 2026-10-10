interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusLabel: string;
  nextVersionNumber?: number;
  isSaving: boolean;
  onConfirm: () => Promise<void> | void;
}

export function UnlockModal({
  isOpen,
  onClose,
  statusLabel,
  nextVersionNumber,
  isSaving,
  onConfirm,
}: UnlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900">Открыть для правок</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 text-xs text-stone-600 leading-relaxed">
          <p>
            Заказ сейчас находится в статусе «<strong>{statusLabel}</strong>».
          </p>
          <p className="mt-2">
            Открыть для правок? Текущий расчёт будет зафиксирован как версия{" "}
            {nextVersionNumber ? `№${nextVersionNumber}` : "в истории"}, а статус изменится на «<strong>Оценён</strong>» для внесения изменений.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onConfirm()}
            className="min-h-11 rounded-xl bg-amber-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-amber-950 disabled:opacity-50"
          >
            {isSaving ? "Обработка…" : "Открыть для правок"}
          </button>
        </div>
      </div>
    </div>
  );
}
