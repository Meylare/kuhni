import { useEffect, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { useProductTemplates } from "../hooks/useProductTemplates";
import { formatKzt } from "../lib/money";
import { getSupabase } from "../lib/supabase";
import { isDemoModeActive, demoGetPriceItems } from "../lib/demo-data";
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
      if (isDemoModeActive()) {
        const items = demoGetPriceItems();
        setPriceItemsById(new Map(items.map((p: PriceItem) => [p.id, p])));
        return;
      }
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
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 pb-32 text-zinc-100">
      {/* Шапка страницы */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            ← К сделкам
          </button>
          <div className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
            TEMPLATES · ARCHETYPES
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1">
            Шаблоны изделий
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Типовые наборы позиций для мгновенного добавления в смету заказа
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center py-12 text-zinc-500">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="mt-3 text-xs font-medium">Загрузка шаблонов…</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-zinc-800 bg-[#121215]/50 p-12 text-center">
          <span className="text-3xl block mb-2">📋</span>
          <h3 className="text-base font-semibold text-white">Шаблонов пока нет</h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
            Вы можете создать шаблон прямо из любого готового заказа: откройте заказ и выберите «Сохранить как шаблон».
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            const linesCount = tpl.lines?.length ?? 0;

            return (
              <div
                key={tpl.id}
                className="rounded-3xl border border-white/[0.07] bg-[#121215] p-5 shadow-lg transition-all hover:border-white/[0.18]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-semibold text-white">{tpl.name}</h3>
                      <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                        {linesCount} поз.
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="mt-1.5 text-xs text-zinc-400">{tpl.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                      className="rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      {isExpanded ? "Скрыть состав ▲" : "Состав ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(tpl)}
                      className="rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                      title="Удалить шаблон"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {/* Раскрывающийся состав строк шаблона */}
                {isExpanded && (
                  <div className="mt-4 border-t border-white/[0.06] pt-4 animate-in fade-in duration-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Позиции в шаблоне:
                    </span>
                    <div className="mt-2.5 flex flex-col gap-1.5 text-xs">
                      {tpl.lines?.map((line, idx) => {
                        const priceItem = priceItemsById.get(line.price_item_id);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-2.5"
                          >
                            <div>
                              <span className="font-medium text-zinc-200">
                                {priceItem ? priceItem.name : `Позиция ID: ${line.price_item_id}`}
                              </span>
                              {!priceItem?.active && (
                                <span className="ml-2 text-[10px] text-amber-400 font-semibold">
                                  (неактивна в каталоге)
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-white tabular-nums">
                                {line.qty} {priceItem?.unit ?? "шт"}
                              </span>
                              {priceItem && (
                                <span className="ml-2 text-zinc-500 font-mono text-[11px]">
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
