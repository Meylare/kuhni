import { useEffect, useMemo, useState } from "react";

import {
  demoCreateOrder,
  demoGetOrders,
  isDemoModeActive,
} from "../lib/demo-data";
import { formatErrorMessage } from "../lib/errors";
import { getMarginColor } from "../lib/margin-colors";
import { formatKzt } from "../lib/money";
import { formatCurrencyInput } from "../lib/number-inputs";
import {
  filterOrders,
  getLatestCalculation,
  sortOrders,
  validateOrderInput,
} from "../lib/orders";
import { getSupabase } from "../lib/supabase";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
  type OrderWithCalculations,
} from "../types/database";

interface OrdersPageProps {
  onSelectOrder: (orderId: string) => void;
}

export function OrdersPage({ onSelectOrder }: OrdersPageProps) {
  const [orders, setOrders] = useState<OrderWithCalculations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Поиск и фильтры
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Модалка создания заказа
  const [isCreating, setIsCreating] = useState(false);
  const [createPreset, setCreatePreset] = useState<"kitchen" | "wardrobe" | "empty">("kitchen");
  const [createName, setCreateName] = useState("");
  const [createClient, setCreateClient] = useState("");
  const [createContractPrice, setCreateContractPrice] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);

      if (isDemoModeActive()) {
        const demoOrders = demoGetOrders();
        setOrders(demoOrders as OrderWithCalculations[]);
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase
        .from("orders")
        .select("*, calculations(id, version, mode, price_total, cost_total, margin_pct, created_at)")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        setError(formatErrorMessage(fetchErr, "Не удалось загрузить заказы."));
      } else {
        setOrders((data as OrderWithCalculations[]) || []);
      }
    } catch (err: unknown) {
      setError(formatErrorMessage(err, "Не удалось загрузить заказы."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  function handleOpenCreateModal(preset: "kitchen" | "wardrobe" | "empty" = "kitchen") {
    setCreatePreset(preset);
    setCreateName(
      preset === "kitchen"
        ? "Кухня на заказ"
        : preset === "wardrobe"
        ? "Шкаф-купе в спальню"
        : ""
    );
    setCreateClient("");
    setCreateContractPrice("");
    setCreateNote(
      preset === "kitchen"
        ? "Комплектация: Egger 18мм, фасады MDF Soft-Touch, фурнитура Blum"
        : preset === "wardrobe"
        ? "Комплектация: Egger 18мм, профиль Modus, ящики Boyard"
        : ""
    );
    setCreateError(null);
    setIsCreating(true);
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    const contractPriceNum = createContractPrice.trim()
      ? Number(createContractPrice.replace(/\s+/g, ""))
      : null;

    const validation = validateOrderInput({
      name: createName,
      contract_price: contractPriceNum,
    });

    if (!validation.valid) {
      setCreateError(validation.error ?? "Проверьте введённые данные.");
      return;
    }

    try {
      setCreateSaving(true);
      setCreateError(null);

      if (isDemoModeActive()) {
        const created = demoCreateOrder({
          name: createName.trim(),
          client_name: createClient.trim() || null,
          contract_price: contractPriceNum,
          note: createNote.trim() || null,
          preset: createPreset,
        });
        setIsCreating(false);
        onSelectOrder(created.id);
        return;
      }

      const supabase = getSupabase();
      const { data, error: insertErr } = await supabase
        .from("orders")
        .insert({
          name: createName.trim(),
          client_label: createClient.trim() || null,
          contract_price: contractPriceNum,
          note: createNote.trim() || null,
          status: "draft",
          settings: {
            target_margin_pct: 0.28,
            assembly_mode: "per_meter",
          },
        })
        .select()
        .single();

      if (insertErr) {
        setCreateError(formatErrorMessage(insertErr, "Ошибка при создании заказа."));
      } else if (data) {
        setIsCreating(false);
        onSelectOrder(data.id);
      }
    } catch (err: unknown) {
      setCreateError(formatErrorMessage(err, "Ошибка при создании заказа."));
    } finally {
      setCreateSaving(false);
    }
  }

  // Фильтрация и сортировка
  const filteredOrders = filterOrders(orders, searchQuery, selectedStatus);
  const displayedOrders = sortOrders(filteredOrders, "newest");

  // Метрики
  const metrics = useMemo(() => {
    let totalGMV = 0;
    for (const o of orders) {
      const latest = getLatestCalculation(o);
      const price = o.contract_price ?? latest?.price_total ?? 0;
      totalGMV += price;
    }
    return {
      total: orders.length,
      totalGMV,
    };
  }, [orders]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 pb-32 text-zinc-100">
      {/* 1. Верхний минималистичный заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Сделки</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>
              {metrics.total} активных проекта · {formatKzt(metrics.totalGMV)} ₸
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateModal("kitchen")}
          className="rounded-full bg-white text-black font-semibold px-5 py-2.5 text-xs hover:bg-zinc-200 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          <span>Новый проект</span>
        </button>
      </div>

      {/* Ошибка загрузки */}
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-2 font-bold underline hover:no-underline cursor-pointer"
          >
            Повторить попытку
          </button>
        </div>
      )}

      {/* 2. Поиск и переключатель фильтров */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск проекта или клиента..."
            className="w-full rounded-full bg-[#121215] border border-white/[0.08] px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedStatus("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              selectedStatus === "all"
                ? "bg-zinc-800 text-white shadow-xs font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Все ({orders.length})
          </button>
          {ORDER_STATUSES.slice(0, 4).map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedStatus === st
                    ? "bg-zinc-800 text-white shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {ORDER_STATUS_LABELS[st]} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Сетка сделок (Luxury Glass Cards) */}
      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center py-12 text-zinc-500">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="mt-3 text-xs font-medium">Загрузка сделок…</span>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <h3 className="text-sm font-semibold text-white">
            {searchQuery ? "Ничего не найдено" : "Сделок пока нет"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {searchQuery
              ? "Попробуйте изменить поисковый запрос."
              : "Создайте свой первый мебельный заказ, чтобы рассчитать смету."}
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreateModal("kitchen")}
            className="mt-4 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:bg-zinc-200 cursor-pointer"
          >
            + Создать тестовую кухню
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedOrders.map((ord) => {
            const latestCalc = getLatestCalculation(ord);
            const displayPrice = ord.contract_price !== null ? ord.contract_price : latestCalc?.price_total;
            const margin = latestCalc?.margin_pct ?? 0.18;
            const marginStyle = getMarginColor(margin, 0.28);
            const marginString = `${(margin * 100).toFixed(1).replace(/\.0$/, "")}%`;

            const dotBg =
              marginStyle.status === "success"
                ? "#10b981"
                : marginStyle.status === "warning"
                ? "#f59e0b"
                : marginStyle.status === "danger"
                ? "#ef4444"
                : "#71717a";

            return (
              <div
                key={ord.id}
                onClick={() => onSelectOrder(ord.id)}
                className="relative rounded-3xl bg-[#121215] border border-white/[0.07] hover:border-white/[0.18] p-5 transition-all cursor-pointer shadow-lg active:scale-[0.99] group flex flex-col justify-between"
              >
                <div>
                  {/* Верхняя строка карточки: статус и дата */}
                  <div className="flex items-center justify-between text-[11px] mb-3">
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: dotBg }}
                      />
                      <span>{ORDER_STATUS_LABELS[ord.status] ?? ord.status}</span>
                    </span>
                    <span className="text-zinc-600 font-mono">
                      {new Date(ord.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  {/* Название и клиент */}
                  <h2 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                    {ord.name}
                  </h2>

                  <div className="mt-1 text-xs text-zinc-400 truncate">
                    {ord.client_label ? ord.client_label : <span className="text-zinc-600 italic">Клиент не указан</span>}
                  </div>

                  {ord.note && (
                    <p className="mt-2 text-xs text-zinc-500 line-clamp-1 italic">
                      {ord.note}
                    </p>
                  )}
                </div>

                {/* Нижняя часть карточки: цена и маржа */}
                <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <div className="text-xl font-bold text-white tabular-nums tracking-tight">
                    {displayPrice !== undefined && displayPrice !== null
                      ? `${formatKzt(displayPrice)} ₸`
                      : "Расчёт не сохранён"}
                  </div>

                  <div className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 text-xs font-semibold text-emerald-400 font-mono">
                    {marginString}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Модальное окно создания заказа (Clean Bottom-Sheet / Modal) */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#141418] p-6 shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2 className="text-base font-bold text-white">Новый проект</h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-zinc-500 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-4 flex flex-col gap-3.5 text-xs">
              {/* Пресет шаблона */}
              <div>
                <label className="block font-medium text-zinc-400 mb-1.5">
                  Тип изделия
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatePreset("kitchen");
                      if (!createName || createName.includes("Шкаф")) setCreateName("Кухня на заказ");
                    }}
                    className={`rounded-2xl border p-2.5 transition-all cursor-pointer text-center ${
                      createPreset === "kitchen"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold"
                        : "border-white/[0.06] bg-zinc-900/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className="text-lg block">🍳</span>
                    <span className="text-[11px] mt-1 block">Кухня</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatePreset("wardrobe");
                      if (!createName || createName.includes("Кухня")) setCreateName("Шкаф-купе в спальню");
                    }}
                    className={`rounded-2xl border p-2.5 transition-all cursor-pointer text-center ${
                      createPreset === "wardrobe"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold"
                        : "border-white/[0.06] bg-zinc-900/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className="text-lg block">🚪</span>
                    <span className="text-[11px] mt-1 block">Шкаф</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatePreset("empty")}
                    className={`rounded-2xl border p-2.5 transition-all cursor-pointer text-center ${
                      createPreset === "empty"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold"
                        : "border-white/[0.06] bg-zinc-900/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className="text-lg block">📄</span>
                    <span className="text-[11px] mt-1 block">С нуля</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-400 mb-1">
                  Название сделки
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Например: Кухня угловая • ЖК Highvill"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-400 mb-1">
                  Клиент / Телефон
                </label>
                <input
                  type="text"
                  value={createClient}
                  onChange={(e) => setCreateClient(e.target.value)}
                  placeholder="Айгерим (+7 701 123 45 67)"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-400 mb-1">
                  Договорная цена (₸)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={createContractPrice}
                  onChange={(e) => setCreateContractPrice(formatCurrencyInput(e.target.value))}
                  placeholder="Оставьте пустым для расчета по смете"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-400 mb-1">
                  Заметки
                </label>
                <textarea
                  rows={2}
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="Высота 2.8м, вентканал справа, подсветка..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {createError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                  {createError}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="rounded-full bg-white text-black px-5 py-2 text-xs font-semibold hover:bg-zinc-200 active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {createSaving ? "Создание…" : "Открыть кокпит →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
