import { type FormEvent } from "react";

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  calcMode: "quote" | "check_contract";
  adjKind: "cost" | "price";
  setAdjKind: (kind: "cost" | "price") => void;
  adjLabel: string;
  setAdjLabel: (val: string) => void;
  adjAmount: string;
  setAdjAmount: (val: string) => void;
  adjComment: string;
  setAdjComment: (val: string) => void;
  adjError: string | null;
  adjSaving: boolean;
  onSave: (e: FormEvent) => void;
}

export function AdjustmentModal({
  isOpen,
  onClose,
  calcMode,
  adjKind,
  setAdjKind,
  adjLabel,
  setAdjLabel,
  adjAmount,
  setAdjAmount,
  adjComment,
  setAdjComment,
  adjError,
  adjSaving,
  onSave,
}: AdjustmentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">Новая корректировка</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {adjError && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {adjError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3.5 text-xs">
          {calcMode === "check_contract" ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              <div className="font-semibold text-white">Тип: К затратам (себестоимость)</div>
              <div className="text-zinc-500 text-[11px] mt-0.5">
                В режиме «Проверить договор» цена зафиксирована договором, поэтому доступны только корректировки себестоимости.
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-zinc-300 mb-1.5">Тип корректировки</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjKind("price")}
                  className={`rounded-2xl p-2.5 text-xs font-medium transition-all cursor-pointer text-center ${
                    adjKind === "price"
                      ? "bg-zinc-800 text-white font-semibold border border-white/20 shadow-xs"
                      : "bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  К цене (скидка/наценка)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjKind("cost")}
                  className={`rounded-2xl p-2.5 text-xs font-medium transition-all cursor-pointer text-center ${
                    adjKind === "cost"
                      ? "bg-zinc-800 text-white font-semibold border border-white/20 shadow-xs"
                      : "bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  К себестоимости
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Название корректировки <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={adjLabel}
              onChange={(e) => setAdjLabel(e.target.value)}
              placeholder={
                calcMode === "check_contract"
                  ? "Например: Дополнительный монтаж"
                  : "Например: Скидка постоянному клиенту"
              }
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Сумма (₸) <span className="text-rose-400">*</span>
              {calcMode !== "check_contract" && (
                <span className="text-zinc-500 font-normal"> (для скидки введите с минусом: -25000)</span>
              )}
            </label>
            <input
              type="text"
              required
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder={calcMode === "check_contract" ? "25000" : "-25000 или 25000"}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white font-mono placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">Комментарий</label>
            <input
              type="text"
              value={adjComment}
              onChange={(e) => setAdjComment(e.target.value)}
              placeholder="Причина применения…"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={adjSaving}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={adjSaving}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {adjSaving ? "Добавление…" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
