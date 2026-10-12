import { useCallback, useState } from "react";
import { formatErrorMessage } from "../lib/errors";
import { getSupabase } from "../lib/supabase";
import {
  isDemoModeActive,
  demoGetTemplates,
  demoDeleteTemplate,
} from "../lib/demo-data";
import type {
  ProductTemplate,
  ProductTemplateLine,
  ProductTemplateWithLines,
} from "../types/database";

export function useProductTemplates() {
  const [templates, setTemplates] = useState<ProductTemplateWithLines[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isDemoModeActive()) {
        setTemplates(demoGetTemplates());
        return;
      }

      const supabase = getSupabase();

      const { data: tData, error: tErr } = await supabase
        .from("product_templates")
        .select("*")
        .order("name", { ascending: true });

      if (tErr) throw tErr;

      const { data: lData, error: lErr } = await supabase
        .from("product_template_lines")
        .select("*");

      if (lErr) throw lErr;

      const linesByTemplate = new Map<string, ProductTemplateLine[]>();
      for (const line of (lData ?? []) as ProductTemplateLine[]) {
        const arr = linesByTemplate.get(line.template_id) ?? [];
        arr.push(line);
        linesByTemplate.set(line.template_id, arr);
      }

      const combined: ProductTemplateWithLines[] = ((tData ?? []) as ProductTemplate[]).map(
        (t) => ({
          ...t,
          lines: linesByTemplate.get(t.id) ?? [],
        })
      );

      setTemplates(combined);
    } catch (err) {
      console.error("Ошибка загрузки шаблонов:", err);
      setError(formatErrorMessage(err, "Не удалось загрузить шаблоны изделий"));
    } finally {
      setLoading(false);
    }
  }, []);

  async function deleteTemplate(id: string) {
    try {
      if (isDemoModeActive()) {
        demoDeleteTemplate(id);
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        return { success: true };
      }

      const { error } = await getSupabase()
        .from("product_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: formatErrorMessage(err) };
    }
  }

  return {
    templates,
    loading,
    error,
    loadTemplates,
    deleteTemplate,
  };
}
