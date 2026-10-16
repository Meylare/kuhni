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
    <div className="mx-auto flex w-full max-w-4xl flex-col px-5 pt-6 pb-24 text-zinc-100 select-none">
      {/* Шапка */}
      <div className="flex items-end justify-between pb-6 border-b border-white/[0.08]">
        <div>
          <div className="text-[11px] font-medium tracking-[0.14em] uppercase text-zinc-500">
            Библиотека комплектаций
          </div>
          <h1 className="mt-1.5 text-[32px] sm:text-[38px] leading-none font-semibold tracking-[-0.03em] text-white">
            Шаблоны изделий
          </h1>
          <p className="mt-2 text-[13px] text-zinc-400">
            Готовые спецификации для быстрого расчёта типовых кухонь и шкафов
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          К проектам
        </button>
      </div>

      {error && (
        <div className="my-4 border-l-2 border-rose-500 pl-3 py-1 text-[13px] text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
          <span className="mt-3 text-[13px]">Загрузка…</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center">
          <h3 className="text-[15px] font-medium text-white">Шаблонов пока нет</h3>
          <p className="mt-1 text-[13px] text-zinc-500 max-w-md mx-auto">
            Откройте любой рассчитанный проект и сохраните его комплектацию как шаблон.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.07]">
          {templates.map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            const linesCount = tpl.lines?.length ?? 0;
            const estimatedSum = (tpl.lines ?? []).reduce((acc, l) => {
              const p = priceItemsById.get(l.price_item_id);
              return acc + (p ? p.price * l.qty : 0);
            }, 0);

            return (
              <div key={tpl.id}>
                <div
                  onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                  className="py-5 flex items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-[17px] font-medium tracking-[-0.015em] text-white group-hover:text-emerald-400 transition-colors">
                        {tpl.name}
                      </h3>
                      <span className="text-[13px] text-zinc-500 tabular-nums">
                        {linesCount} поз.
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="mt-1 text-[13px] text-zinc-400 truncate">
                        {tpl.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {estimatedSum > 0 && (
                      <span className="text-[16px] font-medium text-white tabular-nums">
                        {formatKzt(estimatedSum)} ₸
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                        isExpanded ? "rotate-90 text-zinc-300" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pb-5 pl-4 border-l border-white/[0.08] ml-1">
                    <div className="divide-y divide-white/[0.04]">
                      {tpl.lines?.map((line, idx) => {
                        const priceItem = priceItemsById.get(line.price_item_id);
                        return (
                          <div
                            key={idx}
                            className="py-2.5 flex items-center justify-between text-[13px]"
                          >
                            <div className="min-w-0 pr-3">
                              <div className="text-zinc-200 truncate">
                                {priceItem ? priceItem.name : `Позиция ${line.price_item_id}`}
                              </div>
                              {priceItem && (
                                <div className="text-[11px] text-zinc-500 tabular-nums">
                                  {formatKzt(priceItem.price)} ₸ / {priceItem.unit}
                                  {!priceItem.active && " · архив"}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0 font-medium text-white tabular-nums">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
