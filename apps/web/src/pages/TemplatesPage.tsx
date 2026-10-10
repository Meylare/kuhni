import { useEffect, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { useProductTemplates } from "../hooks/useProductTemplates";
import { formatKzt } from "../lib/money";
import { getSupabase } from "../lib/supabase";
import type { PriceItem, ProductTemplateWithLines } from "../types/database";

interface TemplatesPageProps {
  onBack: () => void;
}

export function TemplatesPage({ onBack }: TemplatesPageProps) {
  const dialog = useDialog();
  const { templates, loading, error, loadTemplates, deleteTemplate } = useProductTemplates();
  const [priceItemsById, setPriceItemsById] = useState<Map<string, PriceItem>>(new Map());
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    void loadTemplates();
    void (async () => {
      const { data } = await getSupabase().from("price_items").select("*");
      if (data) {
        setPriceItemsById(new Map((data as PriceItem[]).map((p) => [p.id, p])));
      }
    })();
  }, [loadTemplates]);

  async function handleDelete(t: ProductTemplateWithLines) {
    const confirmed = await dialog.confirm({
      title: "Удаление шаблона",
      message: `Удалить шаблон изделия «${t.name}»? Это действие нельзя отменить.`,
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;

    const res = await deleteTemplate(t.id);
    if (!res.success) {
      await dialog.alert({
        title: "Ошибка",
        message: "Не удалось удалить шаблон: " + res.error,
        variant: "error",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-4 pb-20">
      {/* Шапка страницы */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-300 bg-white/70 px-3.5 text-xs font-semibold text-stone-700 hover:bg-white active:scale-98"
          >
            ← Назад к заказам
          </button>
          <h1 className="text-xl font-bold text-stone-900">
            Шаблоны изделий
          </h1>
          <p className="text-xs text-stone-500">
            Типовые наборы позиций для быстрого добавления в смету заказа
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-900 border-t-transparent" />
          <span className="mt-3 text-sm">Загрузка шаблонов…</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <span className="text-3xl">📋</span>
          <h3 className="mt-2 text-base font-bold text-stone-900">Шаблонов пока нет</h3>
          <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
            Вы можете создать шаблон прямо из любого готового заказа: откройте заказ и нажмите «Сохранить как шаблон».
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {templates.map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            const linesCount = tpl.lines?.length ?? 0;

            return (
              <div
                key={tpl.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-stone-900">{tpl.name}</h3>
                      <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                        {linesCount} поз.
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="mt-1 text-xs text-stone-600">{tpl.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                      className="min-h-11 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                    >
                      {isExpanded ? "Скрыть состав ▲" : "Состав ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(tpl)}
                      className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      title="Удалить шаблон"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {/* Раскрывающийся состав строк шаблона */}
                {isExpanded && (
                  <div className="mt-3 border-t border-stone-100 pt-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Позиции в шаблоне:
                    </span>
                    <div className="mt-2 flex flex-col divide-y divide-stone-100 text-xs">
                      {tpl.lines?.map((line, idx) => {
                        const priceItem = priceItemsById.get(line.price_item_id);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5"
                          >
                            <div>
                              <span className="font-semibold text-stone-900">
                                {priceItem ? priceItem.name : `Позиция ID: ${line.price_item_id}`}
                              </span>
                              {!priceItem?.active && (
                                <span className="ml-1.5 text-[10px] text-amber-700 font-semibold">
                                  (неактивна в прайсе)
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-stone-900">
                                {line.qty} {priceItem?.unit ?? "шт"}
                              </span>
                              {priceItem && (
                                <span className="ml-2 text-stone-500 text-[11px]">
                                  ({formatKzt(priceItem.price)} ₸/{priceItem.unit})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
