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
import { formatPercent } from "../lib/parameters";
import { getSupabase } from "../lib/supabase";
import {
  ORDER_STATUS_COLORS,
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

  // Вид отображения: карточки (cards) или таблица (table)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Поиск, фильтры и сортировка
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">(() => {
    try {
      const saved = localStorage.getItem("kuhni_orders_filter_status");
      if (saved && (saved === "all" || ORDER_STATUSES.includes(saved as OrderStatus))) {
        return saved as OrderStatus | "all";
      }
    } catch {
      // ignore
    }
    return "all";
  });

  useEffect(() => {
    try {
      localStorage.setItem("kuhni_orders_filter_status", selectedStatus);
    } catch {
      // ignore
    }
  }, [selectedStatus]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">("newest");

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
        ? "Кухня для нового клиента"
        : preset === "wardrobe"
        ? "Шкаф-купе в прихожую"
        : ""
    );
    setCreateClient("");
    setCreateContractPrice("");
    setCreateNote(
      preset === "kitchen"
        ? "Комплектация: ЛДСП корпус, фасады AGT, фурнитура Blum"
        : preset === "wardrobe"
        ? "Комплектация: ЛДСП корпус, профиль Modus, ящики Boyard"
        : ""
    );
    setCreateError(null);
    setIsCreating(true);
  }

  // Быстрое создание тестового заказа за 1 клик
  function handleQuickCreate(preset: "kitchen" | "wardrobe") {
    if (isDemoModeActive()) {
      const title = preset === "kitchen" ? `Кухня на заказ • ${new Date().toLocaleDateString("ru-RU")}` : `Шкаф-купе • ${new Date().toLocaleDateString("ru-RU")}`;
      const created = demoCreateOrder({
        name: title,
        client_name: "Новый клиент",
        note: preset === "kitchen" ? "Быстрый расчет кухни" : "Быстрый расчет шкафа",
        preset,
      });
      onSelectOrder(created.id);
    } else {
      handleOpenCreateModal(preset);
    }
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
  const displayedOrders = sortOrders(filteredOrders, sortDirection);

  // Метрики дашборда
  const metrics = useMemo(() => {
    let totalGMV = 0;
    let inProductionCount = 0;
    let draftCount = 0;
    let completedCount = 0;

    for (const o of orders) {
      if (o.status === "in_production") inProductionCount++;
      if (o.status === "draft" || o.status === "quoted") draftCount++;
      if (o.status === "done") completedCount++;

      const latest = getLatestCalculation(o);
      const price = o.contract_price ?? latest?.price_total ?? 0;
      totalGMV += price;
    }

    return {
      total: orders.length,
      inProductionCount,
      draftCount,
      completedCount,
      totalGMV,
    };
  }, [orders]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 pb-28 md:pb-16">
      {/* Верхний заголовок и кнопки создания */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-stone-900 md:text-3xl">
              Проекты и заказы
            </h1>
            <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-xs font-bold text-stone-700">
              {orders.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-medium md:text-sm">
            Калькуляция себестоимости, управление маржой и договоры
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleQuickCreate("kitchen")}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-800/30 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100/80 active:scale-98 transition-all cursor-pointer shadow-xs"
            title="Создать типовой проект кухни"
          >
            <span>🍳</span>
            <span>+ Кухня</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickCreate("wardrobe")}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 text-xs font-bold text-stone-800 hover:bg-stone-50 active:scale-98 transition-all cursor-pointer shadow-xs"
            title="Создать типовой проект шкафа"
          >
            <span>🚪</span>
            <span>+ Шкаф</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateModal("empty")}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-950 active:scale-98 transition-all cursor-pointer"
          >
            <span className="text-base leading-none">+</span>
            <span>Новый проект</span>
          </button>
        </div>
      </div>

      {/* Аналитический дашборд / KPI Кокпит */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Всего проектов
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">{metrics.total}</span>
            <span className="text-xs text-stone-500 font-medium">заказов</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            В расчёте / Смета
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-950">{metrics.draftCount}</span>
            <span className="text-xs text-amber-800 font-medium">на согласовании</span>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
            В производстве
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-950">{metrics.inProductionCount}</span>
            <span className="text-xs text-indigo-800 font-medium">в цеху</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            Общий оборот
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-emerald-950 truncate">
              {formatKzt(metrics.totalGMV)} ₸
            </span>
          </div>
        </div>
      </div>

      {/* Ошибка загрузки */}
      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800">
          <div className="font-bold">Ошибка загрузки заказов</div>
          <p className="mt-1 text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-2 text-xs font-bold underline hover:no-underline cursor-pointer"
          >
            Повторить попытку
          </button>
        </div>
      )}

      {/* Панель фильтров, поиска и переключателя вида */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Поле поиска с мгновенной очисткой */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или клиенту…"
              className="min-h-11 w-full rounded-2xl border border-stone-200/90 bg-white pr-10 pl-9 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-emerald-800 focus:outline-hidden shadow-xs transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-xs text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Переключатель вида (Cards / Table) и сортировка */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center rounded-xl bg-stone-200/60 p-1 border border-stone-200/80">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`min-h-8 rounded-lg px-2.5 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "cards" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"
                }`}
                title="Отображение карточками"
              >
                Карточки
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`min-h-8 rounded-lg px-2.5 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "table" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"
                }`}
                title="Отображение списком"
              >
                Таблица
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === "newest" ? "oldest" : "newest"))}
              className="flex min-h-10 items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer shadow-xs"
            >
              <span>{sortDirection === "newest" ? "↓ Свежие" : "↑ Старые"}</span>
            </button>
          </div>
        </div>

        {/* Фильтры по статусам (Горизонтальные таблетки) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedStatus("all")}
            className={`min-h-8.5 whitespace-nowrap rounded-xl px-3.5 py-1 text-xs font-bold transition-all cursor-pointer ${
              selectedStatus === "all"
                ? "bg-stone-900 text-white shadow-xs"
                : "bg-white border border-stone-200/80 text-stone-600 hover:bg-stone-100"
            }`}
          >
            Все ({orders.length})
          </button>
          {ORDER_STATUSES.map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`min-h-8.5 whitespace-nowrap rounded-xl px-3.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === st
                    ? "bg-stone-900 text-white shadow-xs"
                    : "bg-white border border-stone-200/80 text-stone-600 hover:bg-stone-100"
                }`}
              >
                {ORDER_STATUS_LABELS[st]} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* Список или сетка заказов */}
      {loading ? (
        <div className="mt-12 flex flex-col items-center justify-center py-12 text-stone-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-900 border-t-transparent" />
          <span className="mt-3 text-xs font-medium">Загрузка заказов…</span>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-2xl">
            📋
          </div>
          <h3 className="mt-3 text-base font-bold text-stone-900">
            {searchQuery ? "Ничего не найдено" : "Заказов пока нет"}
          </h3>
          <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery
              ? "Попробуйте изменить поисковый запрос или сбросить фильтр по статусу."
              : "Создайте свой первый мебельный заказ, чтобы рассчитать себестоимость и маржу."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickCreate("kitchen")}
              className="rounded-xl bg-emerald-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-950 cursor-pointer"
            >
              + Создать тестовую кухню
            </button>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* Сетка карточек заказов (Card View) */
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {displayedOrders.map((ord) => {
            const statusCfg = ORDER_STATUS_COLORS[ord.status] ?? ORDER_STATUS_COLORS.draft;
            const statusTxt = ORDER_STATUS_LABELS[ord.status] ?? ord.status;
            const latestCalc = getLatestCalculation(ord);
            const marginStyle = getMarginColor(latestCalc?.margin_pct ?? null, 0.28);

            const displayPrice = ord.contract_price !== null ? ord.contract_price : latestCalc?.price_total;

            return (
              <div
                key={ord.id}
                onClick={() => onSelectOrder(ord.id)}
                className="group relative flex flex-col justify-between rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs hover:border-emerald-800/40 hover:shadow-md transition-all cursor-pointer"
              >
                <div>
                  {/* Верхняя строка карточки: статус и дата */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusTxt}
                    </span>

                    <span className="text-[11px] text-stone-400 font-medium">
                      {new Date(ord.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  {/* Название и клиент */}
                  <h3 className="mt-3 text-base font-bold text-stone-900 group-hover:text-emerald-950 transition-colors line-clamp-2 leading-snug">
                    {ord.name}
                  </h3>

                  <div className="mt-1 flex items-center gap-2 text-xs text-stone-500 font-medium">
                    {ord.client_label ? (
                      <span className="truncate">👤 {ord.client_label}</span>
                    ) : (
                      <span className="text-stone-400 italic">Клиент не указан</span>
                    )}
                  </div>

                  {ord.note ? (
                    <p className="mt-2 text-xs text-stone-500 line-clamp-1 italic bg-stone-50 rounded-lg px-2 py-1">
                      {ord.note}
                    </p>
                  ) : null}
                </div>

                {/* Нижняя часть карточки: финансовый показатель и маржа */}
                <div className="mt-4 border-t border-stone-100 pt-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        {ord.contract_price !== null ? "Договорная цена" : "Смета (расчёт)"}
                      </span>
                      <span className="text-lg font-black text-stone-900 tabular-nums">
                        {displayPrice !== undefined && displayPrice !== null
                          ? `${formatKzt(displayPrice)} ₸`
                          : "Расчёт не сохранён"}
                      </span>
                    </div>

                    {latestCalc?.margin_pct !== null && latestCalc?.margin_pct !== undefined ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-black ${marginStyle.badge}`}
                        title="Маржинальность проекта"
                      >
                        <span>{formatPercent(latestCalc.margin_pct)}</span>
                      </span>
                    ) : (
                      <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                        Новый
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Табличный вид (Table View) */
        <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Проект / Клиент</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Сумма (KZT)</th>
                  <th className="px-4 py-3 text-center">Маржа</th>
                  <th className="px-4 py-3 text-right">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayedOrders.map((ord) => {
                  const statusCfg = ORDER_STATUS_COLORS[ord.status] ?? ORDER_STATUS_COLORS.draft;
                  const statusTxt = ORDER_STATUS_LABELS[ord.status] ?? ord.status;
                  const latestCalc = getLatestCalculation(ord);
                  const marginStyle = getMarginColor(latestCalc?.margin_pct ?? null, 0.28);
                  const displayPrice = ord.contract_price !== null ? ord.contract_price : latestCalc?.price_total;

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => onSelectOrder(ord.id)}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-stone-900 text-sm leading-tight">{ord.name}</div>
                        <div className="text-stone-500 mt-0.5">{ord.client_label || "—"}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusTxt}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-stone-900 text-sm tabular-nums">
                        {displayPrice !== undefined && displayPrice !== null
                          ? `${formatKzt(displayPrice)} ₸`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {latestCalc?.margin_pct !== null && latestCalc?.margin_pct !== undefined ? (
                          <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-bold ${marginStyle.badge}`}>
                            {formatPercent(latestCalc.margin_pct)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-stone-400 font-medium">
                        {new Date(ord.created_at).toLocaleDateString("ru-RU")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно создания заказа */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-lg font-black text-stone-900">
                Новый проект мебели
              </h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-4 flex flex-col gap-3.5 text-xs">
              {/* Выбор готового шаблона */}
              <div>
                <label className="block font-bold text-stone-700 mb-1.5">
                  Тип изделия (стартовый шаблон)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatePreset("kitchen");
                      if (!createName || createName.includes("Шкаф")) setCreateName("Кухня на заказ");
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all cursor-pointer ${
                      createPreset === "kitchen"
                        ? "border-emerald-800 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xl">🍳</span>
                    <span className="mt-1 text-xs">Кухня</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatePreset("wardrobe");
                      if (!createName || createName.includes("Кухня")) setCreateName("Шкаф-купе в спальню");
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all cursor-pointer ${
                      createPreset === "wardrobe"
                        ? "border-emerald-800 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xl">🚪</span>
                    <span className="mt-1 text-xs">Шкаф-купе</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatePreset("empty")}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all cursor-pointer ${
                      createPreset === "empty"
                        ? "border-emerald-800 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xl">📄</span>
                    <span className="mt-1 text-xs">С нуля</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Название проекта <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Например: Кухня угловая • ЖК Highvill"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Имя клиента / телефон
                </label>
                <input
                  type="text"
                  value={createClient}
                  onChange={(e) => setCreateClient(e.target.value)}
                  placeholder="Например: Айгерим (+7 701 123 45 67)"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Согласованная цена договора (если уже известна, ₸)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={createContractPrice}
                  onChange={(e) => setCreateContractPrice(formatCurrencyInput(e.target.value))}
                  placeholder="Оставьте пустым для расчета по смете"
                  className="min-h-11 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Заметки / Особенности помещения
                </label>
                <textarea
                  rows={2}
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="Высота потолков 2.8м, вентканал справа, подсветка врезная…"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              {createError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  {createError}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="min-h-11 rounded-xl border border-stone-300 px-4 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="min-h-11 rounded-xl bg-emerald-900 px-5 text-xs font-bold text-white shadow-sm hover:bg-emerald-950 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {createSaving ? "Создание…" : "Создать и перейти к смете →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
