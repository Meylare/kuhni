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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="flex w-full sm:max-w-lg flex-col rounded-3xl border border-white/10 bg-[#141418] p-6 shadow-2xl text-zinc-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div>
            <h3 className="text-base font-bold text-white">
              Сохранить как шаблон
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Шаблон можно будет применить в любом заказе в один клик
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

        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Название шаблона <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Например: Кухня стандарт 3.0м"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Описание (необязательно)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Базовый набор ЛДСП Egger, кромки, петель и направляющих Blum"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20"
            />
          </div>

          {/* Сводка состава шаблона */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs">
            <div className="font-semibold text-white">
              Позиций в шаблоне: {grouped.templateLines.length}
            </div>
            {grouped.manualLinesCount > 0 && (
              <div className="mt-1 text-[11px] text-amber-300">
                ⚠️ Ручные позиции ({grouped.manualLinesCount}) не входят в шаблон:{" "}
                <span className="italic">{grouped.skippedManualNames.join(", ")}</span>
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
              type="submit"
              disabled={saving || grouped.templateLines.length === 0}
              className="rounded-full bg-white text-black font-semibold px-5 py-2 text-xs hover:bg-zinc-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {saving ? "Сохранение…" : "Сохранить шаблон"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
