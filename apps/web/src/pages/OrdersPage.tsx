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
    <>
      <div
        className={`mx-auto flex w-full max-w-[680px] flex-col px-5 pt-6 pb-24 text-zinc-100 select-none ${
          isCreating ? "apple-stage-recessed" : "apple-stage-normal"
        }`}
      >
        {/* 1. Шапка портфеля проектов */}
        <div className="flex items-end justify-between pb-6 border-b border-white/[0.08]">
          <div>
            <div className="text-[11px] font-medium tracking-[0.14em] uppercase text-zinc-500">
              Портфель · {metrics.total}
            </div>
            <h1 className="mt-1.5 text-[34px] sm:text-[42px] leading-none font-semibold tracking-[-0.03em] text-white tabular-nums">
              {formatKzt(metrics.totalGMV)}
              <span className="ml-1.5 text-[24px] font-light text-zinc-500">₸</span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => handleOpenCreateModal("kitchen")}
            className="inline-flex items-center gap-1.5 bg-white text-black font-semibold px-4 h-9 rounded-full text-[13px] hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span>Новый</span>
          </button>
        </div>

        {/* Ошибка загрузки */}
        {error && (
          <div className="my-4 border-l-2 border-rose-500 pl-3 py-1 text-[13px] text-rose-300">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="mt-1 font-medium text-white underline cursor-pointer"
            >
              Повторить
            </button>
          </div>
        )}

        {/* 2. Тонкая строка поиска и типографические фильтры */}
        <div className="py-3.5 flex flex-col gap-3 border-b border-white/[0.06]">
          <div className="relative flex items-center gap-2.5">
            <svg className="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или клиенту…"
              className="w-full bg-transparent text-[14px] text-white placeholder-zinc-600 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar text-[12px]">
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className={`transition-colors cursor-pointer whitespace-nowrap ${
                selectedStatus === "all"
                  ? "text-white font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Все <span className="text-zinc-600 tabular-nums">{orders.length}</span>
            </button>
            {ORDER_STATUSES.slice(0, 4).map((st) => {
              const count = orders.filter((o) => o.status === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`transition-colors cursor-pointer whitespace-nowrap ${
                    selectedStatus === st
                      ? "text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {ORDER_STATUS_LABELS[st]}{" "}
                  {count > 0 && <span className="text-zinc-600 tabular-nums">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Чистый архитектурный список сделок (строго 2 линии на строку, без мусора) */}
        {loading ? (
          <div className="py-20 text-center text-[13px] text-zinc-500">
            Загрузка…
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-[15px] font-medium text-white">
              {searchQuery ? "Проекты не найдены" : "Список проектов пуст"}
            </div>
            <p className="mt-1 text-[13px] text-zinc-500">
              {searchQuery
                ? "Попробуйте изменить запрос или сбросить фильтр"
                : "Создайте первый заказ для расчёта стоимости и маржи"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.07] border-b border-white/[0.07]">
            {displayedOrders.map((ord) => {
              const latestCalc = getLatestCalculation(ord);
              const displayPrice =
                ord.contract_price !== null ? ord.contract_price : latestCalc?.price_total;
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
                  className="group py-4.5 flex items-center justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[16px] font-medium tracking-[-0.015em] text-white group-hover:text-emerald-400 transition-colors truncate">
                      {ord.name}
                    </h2>

                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-zinc-500 whitespace-nowrap truncate">
                      <span className="truncate max-w-[140px]">
                        {ord.client_label || "Частный заказчик"}
                      </span>
                      <span>·</span>
                      <span>{ORDER_STATUS_LABELS[ord.status] ?? ord.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 text-right whitespace-nowrap">
                    <div>
                      <div className="text-[16px] font-semibold tracking-[-0.02em] text-white tabular-nums">
                        {displayPrice !== undefined && displayPrice !== null
                          ? `${formatKzt(displayPrice)} ₸`
                          : "—"}
                      </div>
                      <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-zinc-500 tabular-nums">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotBg }}
                        />
                        <span>Маржа {marginString}</span>
                      </div>
                    </div>

                    <svg
                      className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Шторка нового проекта (VisionOS Spatial Sheet) */}
      {isCreating && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setIsCreating(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-spatial-sheet apple-glass-glint w-full max-w-md rounded-t-[24px] sm:rounded-[24px] border-t sm:border border-white/[0.12] bg-[#141418] p-6 pb-8 shadow-2xl text-zinc-100"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-white">
                Новый проект
              </h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-5 flex flex-col gap-4 text-[13px]">
              <div style={{ animationDelay: "30ms" }} className="apple-menu-item">
                <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                  Базовый пресет
                </label>
                <div className="grid grid-cols-3 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatePreset("kitchen");
                      if (!createName || createName.includes("Шкаф"))
                        setCreateName("Кухня на заказ");
                    }}
                    className={`py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                      createPreset === "kitchen"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Кухня
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatePreset("wardrobe");
                      if (!createName || createName.includes("Кухня"))
                        setCreateName("Шкаф-купе в спальню");
                    }}
                    className={`py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                      createPreset === "wardrobe"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Шкаф
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatePreset("empty")}
                    className={`py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                      createPreset === "empty"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    С нуля
                  </button>
                </div>
              </div>

              <div
                style={{ animationDelay: "70ms" }}
                className="apple-menu-item divide-y divide-white/[0.07] border-y border-white/[0.07]"
              >
                <div className="py-3 flex items-center justify-between gap-3">
                  <label className="text-zinc-400 shrink-0 w-28">Проект</label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Кухня · ЖК Highvill"
                    className="w-full bg-transparent text-right text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <label className="text-zinc-400 shrink-0 w-28">Заказчик</label>
                  <input
                    type="text"
                    value={createClient}
                    onChange={(e) => setCreateClient(e.target.value)}
                    placeholder="Имя или телефон"
                    className="w-full bg-transparent text-right text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <label className="text-zinc-400 shrink-0 w-28">Бюджет (₸)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={createContractPrice}
                    onChange={(e) =>
                      setCreateContractPrice(formatCurrencyInput(e.target.value))
                    }
                    placeholder="Авторасчёт по смете"
                    className="w-full bg-transparent text-right text-white placeholder-zinc-600 focus:outline-none tabular-nums"
                  />
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <label className="text-zinc-400 shrink-0 w-28">Примечание</label>
                  <input
                    type="text"
                    value={createNote}
                    onChange={(e) => setCreateNote(e.target.value)}
                    placeholder="Размеры и детали"
                    className="w-full bg-transparent text-right text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              {createError && (
                <div className="text-[12px] text-rose-400">{createError}</div>
              )}

              <button
                type="submit"
                disabled={createSaving}
                style={{ animationDelay: "110ms" }}
                className="apple-menu-item mt-2 w-full h-11 rounded-xl bg-white text-black text-[14px] font-semibold hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
              >
                {createSaving ? "Создание…" : "Создать проект"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
