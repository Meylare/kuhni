import { useEffect, useState } from "react";

import { formatErrorMessage } from "../lib/errors";
import { formatKzt } from "../lib/money";
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

  // Поиск, фильтры и сортировка
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">("all");
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">("newest");

  // Модалка создания заказа
  const [isCreating, setIsCreating] = useState(false);
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

  function handleOpenCreateModal() {
    setCreateName("");
    setCreateClient("");
    setCreateContractPrice("");
    setCreateNote("");
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
      const supabase = getSupabase();

      const { data, error: insertErr } = await supabase
        .from("orders")
        .insert({
          name: createName.trim(),
          client_label: createClient.trim() || null,
          contract_price: contractPriceNum,
          note: createNote.trim() || null,
          status: "draft",
          settings: {},
        })
        .select()
        .single();

      if (insertErr) {
        setCreateError(formatErrorMessage(insertErr, "Ошибка при создании заказа."));
      } else if (data) {
        setIsCreating(false);
        // Сразу открываем созданный заказ
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 pb-28 md:pb-12">
      {/* Шапка раздела */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 md:text-3xl">
            Заказы
          </h1>
          <p className="mt-1 text-xs text-stone-600 md:text-sm">
            Всего заказов: {orders.length}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-950 active:scale-98"
        >
          <span className="text-lg leading-none">+</span>
          <span>Новый заказ</span>
        </button>
      </div>

      {/* Ошибка загрузки */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="font-semibold">Ошибка загрузки заказов</div>
          <p className="mt-1 text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-2 text-xs font-semibold underline hover:no-underline"
          >
            Повторить попытку
          </button>
        </div>
      )}

      {/* Панель поиска, фильтра и сортировки */}
      <div className="mt-6 flex flex-col gap-3">
        {/* Поиск */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или клиенту…"
            className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-emerald-800 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
            >
              ✕
            </button>
          )}
        </div>

        {/* Фильтры по статусам и сортировка */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Статусы (горизонтальная прокрутка на мобильных) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className={`min-h-9 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                selectedStatus === "all"
                  ? "bg-stone-900 text-white"
                  : "bg-white/80 text-stone-600 hover:bg-white"
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
                  className={`min-h-9 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                    selectedStatus === st
                      ? "bg-stone-900 text-white"
                      : "bg-white/80 text-stone-600 hover:bg-white"
                  }`}
                >
                  {ORDER_STATUS_LABELS[st]} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>

          {/* Сортировка по дате */}
          <div className="flex items-center gap-1 self-end text-xs">
            <span className="text-stone-500">Сортировка:</span>
            <button
              type="button"
              onClick={() =>
                setSortDirection((prev) => (prev === "newest" ? "oldest" : "newest"))
              }
              className="min-h-8 rounded-lg bg-white px-2.5 py-1 font-medium text-stone-700 border border-stone-200 hover:bg-stone-50"
            >
              {sortDirection === "newest" ? "Сначала новые ↓" : "Сначала старые ↑"}
            </button>
          </div>
        </div>
      </div>

      {/* Список заказов */}
      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-sm text-stone-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-900 border-t-transparent" />
          <span className="mt-3">Загрузка заказов…</span>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-12 text-center">
          <span className="text-3xl">📦</span>
          <h3 className="mt-2 text-base font-semibold text-stone-800">
            {orders.length === 0
              ? "У вас пока нет заказов"
              : "По выбранным фильтрам ничего не найдено"}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            {orders.length === 0
              ? "Создайте первый заказ, чтобы рассчитать цену изделия и контролировать расходы."
              : "Попробуйте изменить поисковый запрос или выбрать другой статус."}
          </p>
          {orders.length === 0 && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950"
            >
              + Создать первый заказ
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {displayedOrders.map((order) => {
            const statusConfig = ORDER_STATUS_COLORS[order.status] ?? ORDER_STATUS_COLORS.draft;
            const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
            const latestCalc = getLatestCalculation(order);

            const formattedDate = new Date(order.created_at).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectOrder(order.id);
                  }
                }}
                className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-700/60 hover:shadow-md active:scale-99 md:p-5"
              >
                {/* Верхняя строка карточки */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-stone-900 truncate group-hover:text-emerald-950">
                        {order.name}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusLabel}
                      </span>
                    </div>

                    {order.client_label && (
                      <p className="mt-0.5 text-xs text-stone-500 truncate">
                        Клиент: <span className="font-medium text-stone-700">{order.client_label}</span>
                      </p>
                    )}
                  </div>

                  <span className="text-xs text-stone-400 whitespace-nowrap">
                    {formattedDate}
                  </span>
                </div>

                {/* Нижняя сводная строка с ценой договора и расчётом */}
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-stone-100 pt-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {/* Цена договора */}
                    <div>
                      <span className="block text-[11px] text-stone-400">По договору</span>
                      <span className="text-sm font-semibold text-stone-800">
                        {order.contract_price !== null
                          ? `${formatKzt(order.contract_price)} ₸`
                          : "—"}
                      </span>
                    </div>

                    {/* Последний расчёт */}
                    <div>
                      <span className="block text-[11px] text-stone-400">
                        Расчёт {latestCalc ? `v${latestCalc.version}` : ""}
                      </span>
                      {latestCalc ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-emerald-900">
                            {formatKzt(latestCalc.price_total)} ₸
                          </span>
                          {latestCalc.margin_pct !== null && (
                            <span className="rounded-md bg-emerald-100/70 px-1.5 py-0.5 text-[11px] font-bold text-emerald-900">
                              {formatPercent(latestCalc.margin_pct)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">не зафиксирован</span>
                      )}
                    </div>
                  </div>

                  {/* Кнопка перехода */}
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-900 group-hover:translate-x-0.5 transition-transform">
                    <span>Открыть</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно создания нового заказа */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900">Новый заказ</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="mt-4 flex flex-col gap-4">
              {/* Название */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Название заказа <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Например: Кухня угловая, ЖК Асыл Арман"
                  className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              {/* Метка клиента */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Клиент / метка <span className="text-stone-400 font-normal">(без персональных данных)</span>
                </label>
                <input
                  type="text"
                  value={createClient}
                  onChange={(e) => setCreateClient(e.target.value)}
                  placeholder="Например: Самат, кв. 73"
                  className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              {/* Цена по договору */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Цена по договору (₸) <span className="text-stone-400 font-normal">(опционально)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={createContractPrice}
                  onChange={(e) => setCreateContractPrice(e.target.value)}
                  placeholder="Например: 850 000"
                  className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              {/* Заметка */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Заметка <span className="text-stone-400 font-normal">(для себя)</span>
                </label>
                <textarea
                  rows={2}
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="Особенности монтажа, сроки, пожелания…"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-hidden"
                />
              </div>

              {/* Кнопки действий */}
              <div className="mt-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={createSaving}
                  className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="min-h-11 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 disabled:opacity-50"
                >
                  {createSaving ? "Создание…" : "Создать заказ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
