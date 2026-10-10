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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900">Новая корректировка</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {adjError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {adjError}
          </div>
        )}

        <form onSubmit={onSave} className="mt-3 flex flex-col gap-3 text-xs">
          {calcMode === "check_contract" ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
              <div className="font-semibold text-stone-900">Тип: К затратам (себестоимость)</div>
              <div className="text-stone-500 text-[11px] mt-0.5">
                В режиме «Проверить договор» цена зафиксирована договором, поэтому доступны только корректировки себестоимости.
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Тип корректировки</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjKind("price")}
                  className={`min-h-10 rounded-xl font-semibold border ${
                    adjKind === "price"
                      ? "bg-emerald-900 text-white border-emerald-900"
                      : "bg-white text-stone-700 border-stone-300"
                  }`}
                >
                  К цене (скидка/наценка)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjKind("cost")}
                  className={`min-h-10 rounded-xl font-semibold border ${
                    adjKind === "cost"
                      ? "bg-emerald-900 text-white border-emerald-900"
                      : "bg-white text-stone-700 border-stone-300"
                  }`}
                >
                  К затратам (себестоимость)
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Название корректировки <span className="text-rose-600">*</span>
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
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Сумма (₸) <span className="text-rose-600">*</span>
              {calcMode !== "check_contract" && (
                <span className="text-stone-400 font-normal"> (для скидки введите минус: -11000)</span>
              )}
            </label>
            <input
              type="text"
              required
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder={calcMode === "check_contract" ? "25 000" : "-10 000 или 25 000"}
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Комментарий</label>
            <input
              type="text"
              value={adjComment}
              onChange={(e) => setAdjComment(e.target.value)}
              placeholder="Причина применения…"
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={adjSaving}
              className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={adjSaving}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {adjSaving ? "Добавление…" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
