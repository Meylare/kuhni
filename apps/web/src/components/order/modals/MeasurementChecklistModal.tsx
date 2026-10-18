import { useMemo, useState } from "react";
import {
  computeChecklistProgress,
  formatMeasurementChecklistReport,
  groupChecklistItemsByBlock,
} from "../../../lib/checklists";
import type { Order, OrderChecklist } from "../../../types/database";

export interface MeasurementChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  checklist: OrderChecklist;
  onToggleItem: (itemCode: string) => void;
  onUpdateItemNote: (itemCode: string, note: string) => void;
}

export function MeasurementChecklistModal({
  isOpen,
  onClose,
  order,
  checklist,
  onToggleItem,
  onUpdateItemNote,
}: MeasurementChecklistModalProps) {
  const [filterMode, setFilterMode] = useState<"all" | "unchecked" | "notes">("all");
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<number, boolean>>({});
  const [editingNoteCode, setEditingNoteCode] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const progress = useMemo(
    () => computeChecklistProgress(checklist),
    [checklist],
  );

  const blocks = useMemo(
    () => groupChecklistItemsByBlock(checklist.items),
    [checklist.items],
  );

  const filteredBlocks = useMemo(() => {
    if (filterMode === "all") return blocks;
    return blocks
      .map((block) => ({
        ...block,
        items: block.items.filter((it) => {
          if (filterMode === "unchecked") return !it.is_checked;
          if (filterMode === "notes") return Boolean(it.note && it.note.trim());
          return true;
        }),
      }))
      .filter((block) => block.items.length > 0);
  }, [blocks, filterMode]);

  if (!isOpen) return null;

  const toggleBlockCollapse = (blockNumber: number) => {
    setCollapsedBlocks((prev) => ({
      ...prev,
      [blockNumber]: !prev[blockNumber],
    }));
  };

  const allCollapsed = blocks.every((b) => collapsedBlocks[b.blockNumber]);

  const handleToggleAllBlocks = () => {
    if (allCollapsed) {
      setCollapsedBlocks({});
    } else {
      const next: Record<number, boolean> = {};
      for (const b of blocks) next[b.blockNumber] = true;
      setCollapsedBlocks(next);
    }
  };

  const handleStartEditNote = (itemCode: string, currentNote: string | null) => {
    setEditingNoteCode(itemCode);
    setNoteDraft(currentNote ?? "");
  };

  const handleSaveNote = (itemCode: string) => {
    onUpdateItemNote(itemCode, noteDraft);
    setEditingNoteCode(null);
  };

  const handleCopyReport = async () => {
    const text = formatMeasurementChecklistReport(
      order.name,
      order.client_label,
      checklist,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="apple-spatial-sheet apple-glass-glint w-full max-w-2xl rounded-t-[26px] sm:rounded-[26px] bg-[#121216] border-t sm:border border-white/[0.12] text-zinc-100 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Шапка чек-листа */}
        <div className="px-5 pt-5 pb-3.5 border-b border-white/[0.08] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  📏 Замер объекта
                </span>
                <span className="text-[12px] text-zinc-400 truncate">
                  {order.name}
                </span>
              </div>
              <h2 className="mt-1.5 text-[17px] sm:text-[19px] font-semibold text-white leading-snug">
                {checklist.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 -mr-1.5 -mt-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Закрыть чек-лист"
            >
              ✕
            </button>
          </div>

          {/* Прогресс-бар */}
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="text-zinc-300 font-medium">
                Проверено:{" "}
                <strong className="text-white tabular-nums">
                  {progress.checked} из {progress.total}
                </strong>{" "}
                ({progress.percent}%)
              </span>
              {progress.isAllChecked ? (
                <span className="text-emerald-400 font-semibold">
                  ✓ Все пункты проверены
                </span>
              ) : (
                <span className="text-zinc-500">
                  Осталось: {progress.total - progress.checked}
                </span>
              )}
            </div>
            <div className="h-2 w-full rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* Фильтры и управление блоками */}
          <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`h-8 px-3 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                  filterMode === "all"
                    ? "bg-white text-black font-semibold"
                    : "bg-white/[0.06] text-zinc-300 hover:text-white"
                }`}
              >
                Все ({progress.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("unchecked")}
                className={`h-8 px-3 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                  filterMode === "unchecked"
                    ? "bg-white text-black font-semibold"
                    : "bg-white/[0.06] text-zinc-300 hover:text-white"
                }`}
              >
                Осталось ({progress.total - progress.checked})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("notes")}
                className={`h-8 px-3 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                  filterMode === "notes"
                    ? "bg-white text-black font-semibold"
                    : "bg-white/[0.06] text-zinc-300 hover:text-white"
                }`}
              >
                С заметками ({progress.notesCount})
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleAllBlocks}
              className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              {allCollapsed ? "Развернуть все" : "Свернуть все"}
            </button>
          </div>
        </div>

        {/* Список блоков и пунктов */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3.5">
          {filteredBlocks.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-zinc-400">
              {filterMode === "unchecked"
                ? "🎉 Все пункты замера проверены!"
                : "Заметок по пунктам пока нет."}
            </div>
          ) : (
            filteredBlocks.map((block) => {
              const isCollapsed = Boolean(collapsedBlocks[block.blockNumber]);
              return (
                <div
                  key={block.blockNumber}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
                >
                  {/* Заголовок блока */}
                  <button
                    type="button"
                    onClick={() => toggleBlockCollapse(block.blockNumber)}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] sm:text-[14px] font-semibold text-white leading-snug">
                        {block.blockTitle}
                      </div>
                      {block.blockSubtitle && (
                        <div className="text-[12px] text-zinc-400 mt-0.5">
                          {block.blockSubtitle}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${
                          block.isBlockComplete
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/[0.07] text-zinc-300"
                        }`}
                      >
                        {block.checkedCount}/{block.totalCount}
                      </span>
                      <span className="text-zinc-400 text-xs">
                        {isCollapsed ? "▶" : "▼"}
                      </span>
                    </div>
                  </button>

                  {/* Пункты внутри блока */}
                  {!isCollapsed && (
                    <div className="divide-y divide-white/[0.06]">
                      {block.items.map((item) => {
                        const isEditingNote = editingNoteCode === item.item_code;
                        return (
                          <div
                            key={item.item_code}
                            className={`p-3.5 sm:p-4 transition-colors ${
                              item.is_checked ? "bg-emerald-500/[0.04]" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Крупный чекбокс >= 44x44 */}
                              <button
                                type="button"
                                onClick={() => onToggleItem(item.item_code)}
                                className="min-h-11 min-w-11 -m-1.5 flex items-center justify-center shrink-0 cursor-pointer"
                                aria-label={`Отметить пункт ${item.item_code}`}
                              >
                                <span
                                  className={`h-6 w-6 rounded-lg border flex items-center justify-center transition-all ${
                                    item.is_checked
                                      ? "bg-emerald-500 border-emerald-400 text-black font-bold shadow-xs"
                                      : "border-white/25 bg-white/[0.04] text-transparent hover:border-white/50"
                                  }`}
                                >
                                  ✓
                                </span>
                              </button>

                              {/* Текст пункта */}
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => onToggleItem(item.item_code)}
                                  className="text-left w-full cursor-pointer"
                                >
                                  <div
                                    className={`text-[14px] sm:text-[15px] font-semibold leading-snug ${
                                      item.is_checked
                                        ? "text-emerald-300 line-through decoration-emerald-500/50"
                                        : "text-white"
                                    }`}
                                  >
                                    <span className="font-mono text-zinc-400 mr-1.5">
                                      {item.item_code}.
                                    </span>
                                    {item.title}
                                  </div>
                                  <p className="mt-1 text-[13px] text-zinc-400 leading-relaxed">
                                    {item.description}
                                  </p>
                                </button>

                                {/* Поле заметки по пункту замера */}
                                {isEditingNote ? (
                                  <div className="mt-2.5 space-y-2">
                                    <textarea
                                      rows={2}
                                      autoFocus
                                      value={noteDraft}
                                      onChange={(e) => setNoteDraft(e.target.value)}
                                      placeholder="Запишите размеры или нюанс (например: 2680/2690/2675 мм, стена ГКЛ)…"
                                      className="w-full rounded-xl bg-black/50 border border-white/20 px-3 py-2 text-[14px] text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-400"
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveNote(item.item_code)}
                                        className="h-8 px-3.5 rounded-lg bg-emerald-500 text-black text-[12px] font-semibold hover:bg-emerald-400 cursor-pointer"
                                      >
                                        Сохранить заметку
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingNoteCode(null)}
                                        className="h-8 px-3 rounded-lg bg-white/[0.06] text-zinc-300 text-[12px] hover:text-white cursor-pointer"
                                      >
                                        Отмена
                                      </button>
                                    </div>
                                  </div>
                                ) : item.note ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStartEditNote(item.item_code, item.note)
                                    }
                                    className="mt-2 w-full text-left rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-[13px] text-amber-200 hover:bg-amber-500/15 transition-colors cursor-pointer flex items-start justify-between gap-2"
                                  >
                                    <span>📝 {item.note}</span>
                                    <span className="text-[11px] text-amber-300/80 shrink-0">
                                      Изменить
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStartEditNote(item.item_code, null)
                                    }
                                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                                  >
                                    <span>+ Записать размер / заметку</span>
                                  </button>
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
            })
          )}
        </div>

        {/* Подвал: копирование отчёта замера и закрытие */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#16161b] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className={`h-11 px-4 rounded-xl border text-[13px] font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              copied
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-white/[0.12] bg-white/[0.05] text-zinc-200 hover:text-white hover:bg-white/[0.1]"
            }`}
          >
            <span>{copied ? "✓" : "📋"}</span>
            <span>{copied ? "Замер скопирован!" : "Скопировать замер"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 rounded-xl bg-white text-black text-[14px] font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
