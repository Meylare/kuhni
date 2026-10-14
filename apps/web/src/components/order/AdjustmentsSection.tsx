import { TrashIcon } from "../icons";
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
    <div className="mt-5 rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-lg sm:p-6 text-zinc-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">
            {calcMode === "check_contract"
              ? `Корректировки себестоимости (${visible.length})`
              : `Корректировки (${adjustments.length})`}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {calcMode === "check_contract"
              ? "Дополнительные затраты (к себестоимости)"
              : "Скидки клиенту, наценка за срочность, непредвиденные расходы"}
          </p>
        </div>

        {!locked && (
          <button
            type="button"
            disabled={Boolean(networkError)}
            onClick={onOpenAddAdjustment}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            title={networkError ? "Действие заблокировано из-за сетевой ошибки" : undefined}
          >
            <span>+</span>
            <span>{calcMode === "check_contract" ? "Корректировка затрат" : "Корректировка"}</span>
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="mt-3.5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center text-xs text-zinc-500">
          {calcMode === "check_contract"
            ? "Корректировок себестоимости нет"
            : "Корректировок нет"}
        </div>
      ) : (
        <div className="mt-3.5 flex flex-col gap-2">
          {visible.map((adj) => (
            <div
              key={adj.id}
              className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-xs">{adj.label}</span>
                  <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] text-zinc-400">
                    {adj.kind === "price" ? "к цене" : "к затратам"}
                  </span>
                </div>
                {adj.comment && (
                  <p className="text-xs text-zinc-500 italic mt-0.5">{adj.comment}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-bold text-xs sm:text-sm font-mono tabular-nums ${
                    adj.amount < 0 ? "text-emerald-400" : "text-white"
                  }`}
                >
                  {adj.amount > 0 ? `+${formatKzt(adj.amount)}` : formatKzt(adj.amount)} ₸
                </span>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onDeleteAdjustment(adj.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                    title="Удалить корректировку"
                  >
                    <TrashIcon />
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
