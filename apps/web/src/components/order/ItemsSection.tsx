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
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            Изделия заказа
          </h2>
          <p className="text-xs text-stone-500">
            Кухни, шкафы и другие модули проекта
          </p>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            {onOpenApplyTemplate && (
              <button
                type="button"
                disabled={Boolean(networkError)}
                onClick={() => onOpenApplyTemplate()}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 active:scale-98 disabled:opacity-50"
                title="Добавить типовой набор позиций из шаблона"
              >
                <span>➕</span>
                <span>Из шаблона</span>
              </button>
            )}
            {onOpenSaveAsTemplate && lines.length > 0 && (
              <button
                type="button"
                disabled={Boolean(networkError)}
                onClick={onOpenSaveAsTemplate}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 active:scale-98 disabled:opacity-50"
                title="Сохранить текущие позиции заказа как шаблон"
              >
                <span>📋</span>
                <span>В шаблон</span>
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(networkError)}
              onClick={onOpenAddItem}
              className="flex min-h-11 items-center gap-1 rounded-xl bg-stone-100 px-3.5 text-xs font-semibold text-stone-800 hover:bg-stone-200 active:scale-98 disabled:opacity-50"
            >
              <span>+</span>
              <span>Добавить изделие</span>
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-4 text-center text-xs text-stone-500">
          В заказе пока нет изделий (например: Кухня 3м). Изделия нужны для расчёта сборки по погонным метрам.
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const kindLabel = ORDER_ITEM_KIND_LABELS[item.kind];
            const linkedLinesCount = lines.filter((l) => l.order_item_id === item.id).length;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/60 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">
                      {item.title}
                    </span>
                    <span className="rounded-md bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
                      {kindLabel}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                    {item.linear_meters !== null && (
                      <span>{item.linear_meters} пог. м</span>
                    )}
                    <span>Позиций: {linkedLinesCount}</span>
                  </div>
                </div>

                {!locked && (
                  <div className="flex items-center gap-1">
                    {onDuplicateItem && (
                      <button
                        type="button"
                        onClick={() => onDuplicateItem(item)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                        title="Дублировать изделие"
                      >
                        <CopyIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenEditItem(item)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                      title="Редактировать"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-rose-500 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                      title="Удалить"
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
