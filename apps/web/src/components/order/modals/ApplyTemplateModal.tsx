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

      // Сохраняем новые позиции в базу данных
      const supabase = getSupabase();

      // Находим строки, которых ещё нет в БД (новые сгенерированные строки с temp- id)
      const newLinesToInsert = applyRes.nextLines.filter((l) => l.id.startsWith("temp-"));
      // И обновленные существующие строки
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

      // Перезагружаем актуальный список строк из базы
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="flex w-full sm:max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Добавить из шаблона изделия
            </h3>
            <p className="text-xs text-stone-500">
              В заказ будут добавлены позиции шаблона по актуальным ценам
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 text-lg"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3.5 text-xs">
          {items.length > 0 && (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Куда применить шаблон (изделие)
              </label>
              <select
                value={targetItemId}
                onChange={(e) => setTargetItemId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
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
            <label className="block font-semibold text-stone-700 mb-1">
              Выберите шаблон изделия
            </label>
            {loading ? (
              <div className="py-8 text-center text-stone-500">
                Загрузка шаблонов…
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-500">
                Шаблонов пока нет. Вы можете сохранить текущий заказ как шаблон кнопкой «Сохранить как шаблон».
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl)}
                    className={`flex flex-col text-left rounded-xl p-3 border transition-colors ${
                      selectedTemplate?.id === tpl.id
                        ? "border-emerald-800 bg-emerald-50/50"
                        : "border-stone-200 bg-stone-50 hover:bg-stone-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 text-sm">
                        {tpl.name}
                      </span>
                      <span className="text-[11px] font-semibold text-stone-500">
                        {tpl.lines?.length ?? 0} поз.
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="mt-1 text-[11px] text-stone-600 line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={applying || !selectedTemplate || locked}
              onClick={() => void handleApply()}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {applying ? "Применение…" : "Применить к заказу"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
