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
      message: `Удалить шаблон «${t.name}»? Это действие нельзя отменить.`,
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
    <div className="mx-auto flex w-full max-w-[680px] flex-col px-5 pt-6 pb-24 text-zinc-100 select-none">
      {/* Шапка */}
      <div className="flex items-end justify-between pb-6 border-b border-white/[0.08]">
        <div>
          <div className="text-[11px] font-medium tracking-wider uppercase text-zinc-500">
            Библиотека комплектаций
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Шаблоны
          </h1>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          К сделкам
        </button>
      </div>

      {error && (
        <div className="my-4 border-l-2 border-rose-500 pl-3 py-1 text-[13px] text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-[13px] text-zinc-500">
          Загрузка…
        </div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center">
          <h3 className="text-[15px] font-medium text-white">Шаблонов пока нет</h3>
          <p className="mt-1 text-[13px] text-zinc-500 max-w-md mx-auto">
            Откройте любой рассчитанный проект и сохраните его комплектацию как шаблон.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.07] border-b border-white/[0.07]">
          {templates.map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            const linesCount = tpl.lines?.length ?? 0;
            const estimatedSum = (tpl.lines ?? []).reduce((acc, l) => {
              const p = priceItemsById.get(l.price_item_id);
              return acc + (p ? p.price * l.qty : 0);
            }, 0);

            return (
              <div key={tpl.id}>
                <button
                  type="button"
                  onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                  className="w-full py-4.5 flex items-center justify-between gap-4 text-left cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-[16px] font-medium text-white group-hover:text-emerald-400 transition-colors truncate">
                        {tpl.name}
                      </h3>
                      <span className="text-[12px] text-zinc-500 tabular-nums shrink-0">
                        {linesCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                    {estimatedSum > 0 && (
                      <span className="text-[15px] font-medium text-white tabular-nums">
                        {formatKzt(estimatedSum)} ₸
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                        isExpanded ? "rotate-90 text-zinc-200" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                <div
                  className="apple-accordion-grid"
                  data-open={isExpanded}
                >
                  <div className="apple-accordion-inner">
                    {isExpanded && (
                      <div className="pb-5 pl-5 ml-1 relative">
                        <div className="apple-guide-line absolute left-0 top-1 bottom-4 w-[1px] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
                        <div className="divide-y divide-white/[0.04]">
                          {tpl.lines?.map((line, idx) => {
                            const priceItem = priceItemsById.get(line.price_item_id);
                            return (
                              <div
                                key={idx}
                                style={{ animationDelay: `${idx * 35}ms` }}
                                className="apple-unfold-row py-2.5 flex items-center justify-between gap-3 text-[13px]"
                              >
                                <div className="min-w-0">
                                  <div className="text-zinc-200 truncate">
                                    {priceItem ? priceItem.name : `Позиция ${line.price_item_id}`}
                                  </div>
                                  {priceItem && (
                                    <div className="text-[11px] text-zinc-500 tabular-nums whitespace-nowrap">
                                      {formatKzt(priceItem.price * line.qty)} ₸
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0 font-medium text-zinc-300 tabular-nums whitespace-nowrap">
                                  {line.qty} {priceItem?.unit ?? "шт"}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void handleDelete(tpl)}
                            className="text-[12px] text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            Удалить шаблон
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
