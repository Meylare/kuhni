import { useMemo, useState, type FormEvent } from "react";
import { formatErrorMessage } from "../../../lib/errors";
import { getSupabase } from "../../../lib/supabase";
import { isDemoModeActive, demoSaveTemplate } from "../../../lib/demo-data";
import { groupOrderLinesForTemplate } from "../../../lib/templates";
import type { OrderLine, ProductTemplateWithLines } from "../../../types/database";

export interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: OrderLine[];
  onSuccess: (templateName: string) => void;
}

export function SaveAsTemplateModal({
  isOpen,
  onClose,
  lines,
  onSuccess,
}: SaveAsTemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => groupOrderLinesForTemplate(lines), [lines]);

  if (!isOpen) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!templateName.trim()) {
      setError("Укажите название шаблона");
      return;
    }
    if (grouped.templateLines.length === 0) {
      setError("В заказе нет позиций из справочника для сохранения в шаблон");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isDemoModeActive()) {
        const newTemplateId = `demo-tpl-${Date.now()}`;
        const newTemplate: ProductTemplateWithLines = {
          id: newTemplateId,
          name: templateName.trim(),
          description: description.trim() || null,
          lines: grouped.templateLines.map((tl) => ({
            template_id: newTemplateId,
            price_item_id: tl.price_item_id,
            qty: tl.qty,
            note: tl.note || null,
          })),
        };
        demoSaveTemplate(newTemplate);
        onSuccess(templateName.trim());
        setTemplateName("");
        setDescription("");
        onClose();
        return;
      }

      const supabase = getSupabase();

      // 1. Создаём шаблон
      const { data: tData, error: tErr } = await supabase
        .from("product_templates")
        .insert({
          name: templateName.trim(),
          description: description.trim() || null,
        })
        .select()
        .single();

      if (tErr) throw tErr;
      const newTemplateId = tData.id;

      // 2. Создаём позиции шаблона
      const linesToInsert = grouped.templateLines.map((tl) => ({
        template_id: newTemplateId,
        price_item_id: tl.price_item_id,
        qty: tl.qty,
        note: tl.note,
      }));

      const { error: linesErr } = await supabase
        .from("product_template_lines")
        .insert(linesToInsert);

      if (linesErr) throw linesErr;

      onSuccess(templateName.trim());
      setTemplateName("");
      setDescription("");
      onClose();
    } catch (err) {
      console.error("Ошибка сохранения шаблона:", err);
      setError(formatErrorMessage(err, "Не удалось сохранить шаблон"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="flex w-full sm:max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Сохранить как шаблон изделия
            </h3>
            <p className="text-xs text-stone-500">
              Шаблон можно будет применить в любом заказе в один клик
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

        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Название шаблона <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Например: Кухня стандарт 3 п.м."
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Описание (необязательно)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Базовый набор ЛДСП, кромки, петель и направляющих"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800"
            />
          </div>

          {/* Сводка состава шаблона */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-stone-700">
            <div className="font-semibold text-stone-900">
              Позиций в шаблоне: {grouped.templateLines.length}
            </div>
            {grouped.manualLinesCount > 0 && (
              <div className="mt-1 text-[11px] text-amber-800">
                ⚠️ Ручные позиции ({grouped.manualLinesCount}) не входят в шаблон и пропущены:{" "}
                <span className="italic">{grouped.skippedManualNames.join(", ")}</span>
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
              type="submit"
              disabled={saving || grouped.templateLines.length === 0}
              className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
            >
              {saving ? "Сохранение…" : "Сохранить шаблон"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
