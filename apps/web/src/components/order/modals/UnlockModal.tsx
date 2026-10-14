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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">Открыть для правок</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 text-xs text-zinc-400 leading-relaxed">
          <p>
            Заказ сейчас заблокирован в статусе «<strong className="text-white">{statusLabel}</strong>».
          </p>
          <p className="mt-2">
            Открыть для правок? Текущий расчёт будет автоматически сохранён как версия{" "}
            {nextVersionNumber ? `№${nextVersionNumber}` : "в истории версий"}, а статус вернётся к редактированию.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onConfirm()}
            className="rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 text-xs active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
          >
            {isSaving ? "Обработка…" : "Открыть для правок"}
          </button>
        </div>
      </div>
    </div>
  );
}
