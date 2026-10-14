import { useEffect, useState } from "react";
import { useDialog } from "../../../components/DialogProvider";
import { useProductTemplates } from "../../../hooks/useProductTemplates";
import { formatErrorMessage } from "../../../lib/errors";
import { type ParametersMap } from "../../../lib/parameters";
import { getSupabase } from "../../../lib/supabase";
import { applyTemplateToOrderLines } from "../../../lib/templates";
import {
  ORDER_ITEM_KIND_LABELS,
  type Order,
  type OrderItem,
  type OrderLine,
  type PriceItem,
  type ProductTemplateWithLines,
} from "../../../types/database";
import { isDemoModeActive, demoSaveLine } from "../../../lib/demo-data";

export interface ApplyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  items: OrderItem[];
  lines: OrderLine[];
  setLines: React.Dispatch<React.SetStateAction<OrderLine[]>>;
  priceItemsById: Map<string, PriceItem>;
  globalParams: ParametersMap;
  locked: boolean;
  defaultItemId?: string;
}

export function ApplyTemplateModal({
  isOpen,
  onClose,
  order,
  items,
  lines,
  setLines,
  priceItemsById,
  globalParams,
  locked,
  defaultItemId,
}: ApplyTemplateModalProps) {
  const dialog = useDialog();
  const { templates, loading, loadTemplates } = useProductTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplateWithLines | null>(null);
  const [targetItemId, setTargetItemId] = useState<string>(
    defaultItemId ?? (items.length > 0 ? items[0].id : "")
  );
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void loadTemplates();
      setSelectedTemplate(null);
      setTargetItemId(defaultItemId ?? (items.length > 0 ? items[0].id : ""));
      setError(null);
    }
  }, [isOpen, defaultItemId, items, loadTemplates]);

  if (!isOpen) return null;

  async function handleApply() {
    if (!order || !selectedTemplate || locked) return;
    const tLines = selectedTemplate.lines ?? [];
    if (tLines.length === 0) {
      setError("В выбранном шаблоне нет позиций");
      return;
    }

    try {
      setApplying(true);
      setError(null);

      const applyRes = applyTemplateToOrderLines({
        templateLines: tLines,
        currentLines: lines,
        priceItemsById,
        orderId: order.id,
        orderItemId: targetItemId || null,
        globalParams,
      });

      if (isDemoModeActive()) {
        const finalLines: OrderLine[] = applyRes.nextLines.map((l, i) => ({
          ...l,
          id: l.id.startsWith("temp-") ? `demo-line-${Date.now()}-${i}` : l.id,
        }));
        finalLines.forEach((l) => demoSaveLine(l));
        setLines(finalLines);
        onClose();

        let msg = `Добавлено/обновлено позиций из шаблона: ${applyRes.appliedCount}.`;
        if (applyRes.skippedInactiveCount > 0) {
          msg += ` Пропущено неактивных позиций (${applyRes.skippedInactiveCount}): ${applyRes.skippedNames.join(", ")}.`;
        }

        await dialog.alert({
          title: "Шаблон применён",
          message: msg,
          variant: "info",
        });
        return;
      }

      // Сохраняем новые позиции в базу данных
      const supabase = getSupabase();

      const newLinesToInsert = applyRes.nextLines.filter((l) => l.id.startsWith("temp-"));
      const updatedLines = applyRes.nextLines.filter((l) => !l.id.startsWith("temp-"));

      if (newLinesToInsert.length > 0) {
        const insertPayload = newLinesToInsert.map((l) => ({
          order_id: order.id,
          order_item_id: l.order_item_id,
          price_item_id: l.price_item_id,
          category: l.category,
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          unit_price: l.unit_price,
          waste_pct: l.waste_pct,
          billable_qty_rounding: l.billable_qty_rounding,
          counts_for_technolog: l.counts_for_technolog,
          is_manual: false,
          comment: l.comment,
        }));

        const { error: insErr } = await supabase.from("order_lines").insert(insertPayload);
        if (insErr) throw insErr;
      }

      for (const line of updatedLines) {
        const original = lines.find((l) => l.id === line.id);
        if (original && original.qty !== line.qty) {
          const { error: updErr } = await supabase
            .from("order_lines")
            .update({ qty: line.qty })
            .eq("id", line.id);
          if (updErr) throw updErr;
        }
      }

      const { data: refreshedLines, error: refErr } = await supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", order.id);

      if (refErr) throw refErr;
      if (refreshedLines) {
        setLines(refreshedLines as OrderLine[]);
      }

      onClose();

      let msg = `Добавлено/обновлено позиций из шаблона: ${applyRes.appliedCount}.`;
      if (applyRes.skippedInactiveCount > 0) {
        msg += ` Пропущено неактивных позиций (${applyRes.skippedInactiveCount}): ${applyRes.skippedNames.join(", ")}.`;
      }

      await dialog.alert({
        title: "Шаблон применён",
        message: msg,
        variant: "info",
      });
    } catch (err) {
      console.error("Ошибка применения шаблона:", err);
      setError(formatErrorMessage(err, "Не удалось применить шаблон"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="flex w-full sm:max-w-lg flex-col rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div>
            <h3 className="text-base font-bold text-white">
              Применить шаблон изделия
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              В заказ будут добавлены позиции шаблона по актуальным ценам
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3.5 text-xs">
          {items.length > 0 && (
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Куда применить шаблон (изделие)
              </label>
              <select
                value={targetItemId}
                onChange={(e) => setTargetItemId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-white/20"
              >
                <option value="">Без привязки (общий заказ)</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.title} ({ORDER_ITEM_KIND_LABELS[it.kind]})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Выберите шаблон изделия
            </label>
            {loading ? (
              <div className="py-8 text-center text-zinc-500">
                Загрузка шаблонов…
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">
                Шаблонов пока нет. Вы можете сохранить готовый заказ кнопкой «Сохранить как шаблон».
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl)}
                    className={`flex flex-col text-left rounded-2xl p-3 border transition-colors cursor-pointer ${
                      selectedTemplate?.id === tpl.id
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-white/[0.07] bg-[#121215] text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {tpl.name}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {tpl.lines?.length ?? 0} поз.
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={applying || !selectedTemplate || locked}
              onClick={() => void handleApply()}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {applying ? "Применение…" : "Применить к заказу"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
