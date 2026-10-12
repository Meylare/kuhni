import { CopyIcon, EditIcon, TrashIcon } from "../icons";
import {
  ORDER_ITEM_KIND_LABELS,
  type OrderItem,
  type OrderLine,
} from "../../types/database";

export interface ItemsSectionProps {
  items: OrderItem[];
  lines: OrderLine[];
  locked: boolean;
  networkError: string | null;
  onOpenAddItem: () => void;
  onOpenEditItem: (item: OrderItem) => void;
  onDuplicateItem?: (item: OrderItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenSaveAsTemplate?: () => void;
  onOpenApplyTemplate?: (itemId?: string) => void;
}

export function ItemsSection({
  items,
  lines,
  locked,
  networkError,
  onOpenAddItem,
  onOpenEditItem,
  onDuplicateItem,
  onDeleteItem,
  onOpenSaveAsTemplate,
  onOpenApplyTemplate,
}: ItemsSectionProps) {
  return (
    <div className="mt-5 rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-stone-900">
              Модули и изделия проекта
            </h2>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700">
              {items.length}
            </span>
          </div>
          <p className="text-xs text-stone-500 font-medium">
            Кухни, шкафы, островки и пеналы (расчёт сборки по погонным метрам)
          </p>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            {onOpenApplyTemplate && (
              <button
                type="button"
                disabled={Boolean(networkError)}
                onClick={() => onOpenApplyTemplate()}
                className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Добавить готовый типовой набор позиций"
              >
                <span>⚡</span>
                <span>Из шаблона</span>
              </button>
            )}

            {onOpenSaveAsTemplate && lines.length > 0 && (
              <button
                type="button"
                disabled={Boolean(networkError)}
                onClick={onOpenSaveAsTemplate}
                className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Сохранить текущие позиции заказа в библиотеку шаблонов"
              >
                <span>💾</span>
                <span>В шаблон</span>
              </button>
            )}

            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenAddItem}
              className="flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-900 px-4 text-xs font-bold text-white hover:bg-emerald-950 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <span>+</span>
              <span>Добавить модуль</span>
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-6 text-center">
          <div className="text-2xl mb-1">📐</div>
          <p className="text-xs font-bold text-stone-800">
            В проекте пока нет отдельных модулей
          </p>
          <p className="mt-0.5 text-xs text-stone-500 max-w-sm mx-auto">
            Добавьте изделие (например «Кухня 3.2м» или «Шкаф 2.4м»), чтобы рассчитывать сборку по погонным метрам и группировать материалы.
          </p>
          {!locked && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onOpenAddItem}
                className="rounded-xl bg-emerald-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-950 cursor-pointer"
              >
                + Добавить модуль кухни или шкафа
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const kindLabel = ORDER_ITEM_KIND_LABELS[item.kind] ?? item.kind;
            const kindIcon = item.kind === "kitchen" ? "🍳" : item.kind === "wardrobe" ? "🚪" : "📦";
            const linkedLinesCount = lines.filter((l) => l.order_item_id === item.id).length;

            return (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-2xl border border-stone-200/90 bg-stone-50/50 p-4 hover:bg-white hover:border-emerald-800/30 hover:shadow-xs transition-all"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{kindIcon}</span>
                    <span className="font-bold text-stone-900 text-sm truncate">
                      {item.title}
                    </span>
                    <span className="rounded-md bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                      {kindLabel}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-xs text-stone-500 font-medium flex-wrap">
                    {item.linear_meters !== null && (
                      <span className="rounded-lg bg-emerald-50 text-emerald-900 font-bold px-2 py-0.5 border border-emerald-200/60">
                        {item.linear_meters} п.м.
                      </span>
                    )}
                    {item.dims && typeof item.dims === "object" && Object.keys(item.dims).length > 0 && (
                      <span className="text-stone-600 font-mono text-[11px]">
                        📏 {Object.entries(item.dims).map(([k, v]) => `${k}:${v}`).join(" × ")}
                      </span>
                    )}
                    <span className="text-stone-500">
                      Позиций: {linkedLinesCount}
                    </span>
                  </div>

                  {item.description && (
                    <p className="mt-1.5 text-[11px] text-stone-500 line-clamp-1 italic">
                      {item.description}
                    </p>
                  )}
                </div>

                {!locked && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onDuplicateItem && (
                      <button
                        type="button"
                        onClick={() => onDuplicateItem(item)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-200/70 transition-colors cursor-pointer"
                        title="Дублировать модуль"
                      >
                        <CopyIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenEditItem(item)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-200/70 transition-colors cursor-pointer"
                      title="Редактировать параметры модуля"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Удалить модуль"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
