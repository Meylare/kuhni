import { formatKzt } from "../../lib/money";
import { getVisibleAdjustments } from "../../lib/orders";
import type { OrderAdjustment } from "../../types/database";

export interface AdjustmentsSectionProps {
  adjustments: OrderAdjustment[];
  calcMode: "quote" | "check_contract";
  locked: boolean;
  networkError: string | null;
  onOpenAddAdjustment: () => void;
  onDeleteAdjustment: (id: string) => void;
}

export function AdjustmentsSection({
  adjustments,
  calcMode,
  locked,
  networkError,
  onOpenAddAdjustment,
  onDeleteAdjustment,
}: AdjustmentsSectionProps) {
  const visible = getVisibleAdjustments(adjustments, calcMode);

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            {calcMode === "check_contract"
              ? `Корректировки себестоимости (${visible.length})`
              : `Корректировки (${adjustments.length})`}
          </h2>
          <p className="text-xs text-stone-500">
            {calcMode === "check_contract"
              ? "Дополнительные затраты (к себестоимости). Скидки к цене в режиме договора скрыты."
              : "Скидки клиенту, наценка за срочность, непредвиденные расходы"}
          </p>
        </div>

        {!locked && (
          <button
            type="button"
            disabled={Boolean(networkError)}
            onClick={onOpenAddAdjustment}
            className="flex min-h-10 items-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
          >
            <span>+</span>
            <span>{calcMode === "check_contract" ? "Корректировка затрат" : "Корректировка"}</span>
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-3 text-center text-xs text-stone-400">
          {calcMode === "check_contract"
            ? "Корректировок себестоимости нет"
            : "Корректировок нет"}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {visible.map((adj) => (
            <div
              key={adj.id}
              className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900">{adj.label}</span>
                  <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-700">
                    {adj.kind === "price" ? "к цене" : "к затратам"}
                  </span>
                </div>
                {adj.comment && (
                  <p className="text-[11px] text-stone-500 italic">{adj.comment}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-bold text-sm ${
                    adj.amount < 0 ? "text-emerald-700" : "text-stone-900"
                  }`}
                >
                  {adj.amount > 0 ? `+${formatKzt(adj.amount)}` : formatKzt(adj.amount)} ₸
                </span>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onDeleteAdjustment(adj.id)}
                    className="p-1 text-rose-400 hover:text-rose-700"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
