import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "../components/DialogProvider";
import { FactTab } from "../components/FactTab";
import {
  AdjustmentsSection,
  CockpitView,
  ContractStageCard,
  DesktopSummaryCard,
  ItemsSection,
  LinesSection,
  OrderHeader,
  OrderModals,
  OrderParametersAccordion,
  SummaryBar,
  type OrderStage,
} from "../components/order";
import {
  useOrderAdjustments,
  useOrderCalculations,
  useOrderData,
  useOrderDeletions,
  useOrderItems,
  useOrderLines,
} from "../hooks";
import { UndoToast } from "../components/UndoToast";
import {
  getVersionSyncStatus,
  type CurrentCalculationSnapshotInput,
} from "../lib/calculation-versions";
import { formatErrorMessage } from "../lib/errors";
import { mergeOrderParameters } from "../lib/orders";
import { getSupabase } from "../lib/supabase";

interface OrderDetailPageProps {
  orderId: string;
  onBack: () => void;
}

export function OrderDetailPage({ orderId, onBack }: OrderDetailPageProps) {
  // Режим экрана: "cockpit" (новый минималистичный luxury кокпит) | "table" (подробная классическая спецификация)
  const [displayMode, setDisplayMode] = useState<"cockpit" | "table">("cockpit");

  // Этап выполнения заказа (U5): "quote" (Смета) | "contract" (Договор) | "fact" (Факт)
  const [currentStage, setCurrentStage] = useState<OrderStage>("quote");

  // Раскрытие подробной мобильной шторки затрат
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Модалка истории версий (U5.5)
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);

  // Кратковременное уведомление об автосохранении (U4: 2 сек)
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutoSaveToast = useCallback((msg = "Изменения сохранены") => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveToast(msg);
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveToast(null);
    }, 2000);
  }, []);

  // Шаблоны изделий (U2)
  const dialog = useDialog();
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isApplyTemplateOpen, setIsApplyTemplateOpen] = useState(false);
  const [applyTemplateDefaultItemId, setApplyTemplateDefaultItemId] = useState<string | undefined>(undefined);

  function handleOpenApplyTemplate(itemId?: string) {
    setApplyTemplateDefaultItemId(itemId);
    setIsApplyTemplateOpen(true);
  }

  // 1. Загрузка и состояние заказа, шапки и настроек
  const orderData = useOrderData(orderId);
  const {
    order,
    items,
    setItems,
    lines,
    setLines,
    adjustments,
    setAdjustments,
    priceItems,
    globalParams,
    expenses,
    setExpenses,
    payments,
    setPayments,
    calculations,
    setCalculations,
    loading,
    error,
    networkError,
    locked,
    statusConfig,
    statusLabel,
    loadOrderData,
    handleOpenEditHeader,
    isParamsAccordionOpen,
    setIsParamsAccordionOpen,
    customMargin,
    setCustomMargin,
    customAssemblyMode,
    setCustomAssemblyMode,
    customAssemblyPct,
    setCustomAssemblyPct,
    customLinearMeters,
    setCustomLinearMeters,
    customOrderKind,
    setCustomOrderKind,
    customTechnologPct,
    setCustomTechnologPct,
    customRiskReservePct,
    paramsSaving,
    handleSaveOrderSettings,
  } = orderData;

  // 2. Управление изделиями
  const orderItems = useOrderItems({
    order,
    items,
    setItems,
    setLines,
    locked,
  });

  // 3. Управление корректировками
  const orderAdjustments = useOrderAdjustments({
    order,
    adjustments,
    setAdjustments,
    locked,
  });

  // 4. Позиции заказа и справочник цен
  const orderLines = useOrderLines({
    order,
    items,
    lines,
    setLines,
    priceItems,
    globalParams,
    locked,
  });

  // 5. Живой расчёт, версии и фиксация
  const orderCalcs = useOrderCalculations({
    order,
    setOrder: orderData.setOrder,
    items,
    lines,
    adjustments,
    globalParams,
    calculations,
    setCalculations,
    networkError,
    locked,
  });

  // Переключение этапа с синхронизацией режима расчёта (U5)
  const handleSelectStage = useCallback(
    (stage: OrderStage) => {
      setCurrentStage(stage);
      if (stage === "quote") {
        orderCalcs.handleSelectCalcMode("quote");
      } else if (stage === "contract") {
        orderCalcs.handleSelectCalcMode("check_contract");
      }
    },
    [orderCalcs],
  );

  // Вычисление статуса синхронизации версий (U4: isDirtySince, getVersionSyncStatus)
  const effectiveParams = useMemo(
    () => mergeOrderParameters(globalParams, order?.settings),
    [globalParams, order?.settings],
  );

  const latestVersion = useMemo(() => {
    if (calculations.length === 0) return null;
    return [...calculations].sort((a, b) => b.version - a.version)[0];
  }, [calculations]);

  const currentSnapshotInput: CurrentCalculationSnapshotInput = useMemo(
    () => ({
      mode: orderCalcs.calcMode,
      contractPrice: order?.contract_price ?? null,
      parameters: effectiveParams,
      lines,
      items,
      adjustments,
    }),
    [orderCalcs.calcMode, order?.contract_price, effectiveParams, lines, items, adjustments],
  );

  const syncStatus = useMemo(
    () => getVersionSyncStatus(latestVersion, currentSnapshotInput),
    [latestVersion, currentSnapshotInput],
  );

  // Обновление цены договора из этапа «Договор» (U5.3)
  async function handleUpdateContractPrice(newPrice: number | null) {
    if (!order || locked) return;
    const { error: updErr } = await getSupabase()
      .from("orders")
      .update({ contract_price: newPrice })
      .eq("id", order.id);
    if (updErr) {
      await dialog.alert({
        title: "Ошибка сохранения цены",
        message: formatErrorMessage(updErr),
        variant: "error",
      });
      return;
    }
    orderData.setOrder((prev) => (prev ? { ...prev, contract_price: newPrice } : prev));
    triggerAutoSaveToast("Цена договора сохранена");
  }

  // Назначение договорной версии из карточки этапа «Договор»
  async function handleSetBaselineFromContractStage() {
    if (latestVersion) {
      await orderCalcs.handleSetBaseline(latestVersion.id);
    } else {
      await orderCalcs.handleSaveCalculation();
    }
  }

  // 6. Отложенное удаление на 6 секунд с кнопкой отмены (U7)
  const {
    pendingAction,
    undoDelete,
    flushPending,
    handleDeleteLineWithUndo,
    handleDeleteItemWithUndo,
  } = useOrderDeletions({
    lines,
    setLines,
    items,
    setItems,
    locked,
  });

  // Горячие клавиши на ПК (U3.4)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !orderLines.isPricePickerOpen) {
        const target = e.target as HTMLElement | null;
        const isInput =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.tagName === "SELECT";
        if (!isInput && !locked) {
          e.preventDefault();
          orderLines.handleOpenPricePicker();
        }
      }
      if (e.key === "Escape") {
        if (showBreakdown) setShowBreakdown(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [orderLines, locked, showBreakdown]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center py-28 text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        <span className="mt-3 text-xs font-medium">Загрузка данных заказа…</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 text-zinc-100">
        <button
          type="button"
          onClick={onBack}
          className="self-start min-h-10 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          ← К проектам
        </button>
        <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">
          <h2 className="text-base font-semibold">Не удалось открыть заказ</h2>
          <p className="mt-1 text-xs text-rose-400">{error || "Заказ не найден"}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 1. Экран План / Факт в едином Apple-стиле */}
      {currentStage === "fact" ? (
        <FactTab
          order={order}
          expenses={expenses}
          payments={payments}
          calculations={calculations}
          onExpensesChange={setExpenses}
          onPaymentsChange={setPayments}
          onBackToQuote={() => handleSelectStage("quote")}
        />
      ) : displayMode === "cockpit" ? (
        /* 2. Основной режим Кокпита */
        <CockpitView
          order={order}
          lines={lines}
          items={items}
          adjustments={adjustments}
          priceItems={priceItems}
          globalParams={globalParams}
          displayCalc={orderCalcs.displayCalc}
          calcOutcome={orderCalcs.calcOutcome}
          locked={locked}
          currentStage={currentStage}
          onSelectStage={handleSelectStage}
          onUpdateContractPrice={handleUpdateContractPrice}
          onStepLineQty={orderLines.handleStepLineQty}
          onStepPriceItem={orderLines.handleStepPriceItem}
          onDeleteLine={handleDeleteLineWithUndo}
          onOpenPricePicker={orderLines.handleOpenPricePicker}
          onSaveCalculation={orderCalcs.handleSaveCalculation}
          onOpenVersionsModal={() => setIsVersionsModalOpen(true)}
          onBack={onBack}
          onToggleTableMode={() => setDisplayMode("table")}
        />
      ) : (
        /* 3. Табличный режим (для десктопа при необходимости) */
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 pb-48 md:pb-32 lg:pb-12">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setDisplayMode("cockpit")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] transition-all cursor-pointer"
            >
              <span>← Кокпит</span>
            </button>
          </div>

          <OrderHeader
            order={order}
            statusConfig={statusConfig}
            statusLabel={statusLabel}
            locked={locked}
            networkError={networkError}
            copySuccess={orderCalcs.copySuccess}
            autoSaveToast={autoSaveToast}
            currentStage={currentStage}
            linesCount={lines.length}
            calculationsCount={calculations.length}
            factCount={expenses.length + payments.length}
            onBack={onBack}
            onOpenEditHeader={handleOpenEditHeader}
            onRetryLoad={() => void loadOrderData()}
            onOpenUnlockModal={() => orderCalcs.setIsUnlockModalOpen(true)}
            onOpenVersionsModal={() => setIsVersionsModalOpen(true)}
            onCopySummary={orderCalcs.handleCopySummary}
            onSelectStage={handleSelectStage}
          />
          <div className="mt-4 flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 w-full">
              {/* Карточка этапа «Договор» (U5.3) */}
              {currentStage === "contract" && (
                <ContractStageCard
                  order={order}
                  displayCalc={orderCalcs.displayCalc}
                  targetMarginPct={globalParams.target_margin_pct}
                  locked={locked}
                  calcSaving={orderCalcs.calcSaving}
                  onSaveCalculation={orderCalcs.handleSaveCalculation}
                  onSetBaseline={() => void handleSetBaselineFromContractStage()}
                  onUpdateContractPrice={handleUpdateContractPrice}
                />
              )}

              <ItemsSection
                items={items}
                lines={lines}
                locked={locked}
                networkError={networkError}
                onOpenAddItem={orderItems.handleOpenAddItem}
                onOpenEditItem={orderItems.handleOpenEditItem}
                onDuplicateItem={(item) => void orderItems.handleDuplicateItem(item)}
                onDeleteItem={handleDeleteItemWithUndo}
                onOpenSaveAsTemplate={() => setIsSaveTemplateOpen(true)}
                onOpenApplyTemplate={handleOpenApplyTemplate}
              />

              <LinesSection
                lines={lines}
                items={items}
                priceItems={priceItems}
                categoryTotals={orderCalcs.categoryTotals}
                lineCalculationsById={orderCalcs.lineCalculationsById}
                priceItemsById={orderLines.priceItemsById}
                locked={locked}
                networkError={networkError}
                onOpenPricePicker={orderLines.handleOpenPricePicker}
                onOpenAddManualLine={orderLines.handleOpenAddManualLine}
                onOpenEditLine={orderLines.handleOpenEditLine}
                onDuplicateLine={(line) => void orderLines.handleDuplicateLine(line)}
                onDeleteLine={handleDeleteLineWithUndo}
                onStepLineQty={orderLines.handleStepLineQty}
                onStepPriceItem={orderLines.handleStepPriceItem}
                onOpenApplyTemplate={() => handleOpenApplyTemplate()}
              />

              <AdjustmentsSection
                adjustments={adjustments}
                calcMode={orderCalcs.calcMode}
                locked={locked}
                networkError={networkError}
                onOpenAddAdjustment={() => orderAdjustments.handleOpenAddAdjustment(orderCalcs.calcMode)}
                onDeleteAdjustment={(id) => void orderAdjustments.handleDeleteAdjustment(id)}
              />

              {currentStage === "quote" && (
                <OrderParametersAccordion
                  isOpen={isParamsAccordionOpen}
                  setIsOpen={setIsParamsAccordionOpen}
                  globalParams={globalParams}
                  customMargin={customMargin}
                  setCustomMargin={setCustomMargin}
                  customAssemblyMode={customAssemblyMode}
                  setCustomAssemblyMode={setCustomAssemblyMode}
                  customAssemblyPct={customAssemblyPct}
                  setCustomAssemblyPct={setCustomAssemblyPct}
                  customLinearMeters={customLinearMeters}
                  setCustomLinearMeters={setCustomLinearMeters}
                  customOrderKind={customOrderKind}
                  setCustomOrderKind={setCustomOrderKind}
                  items={items}
                  customTechnologPct={customTechnologPct}
                  setCustomTechnologPct={setCustomTechnologPct}
                  customRiskReservePct={customRiskReservePct}
                  locked={locked}
                  paramsSaving={paramsSaving}
                  onSaveOrderSettings={handleSaveOrderSettings}
                />
              )}
            </div>

            {/* Правая закрепленная колонка на ПК (U3, U4: sticky top-20) */}
            <DesktopSummaryCard
              displayCalc={orderCalcs.displayCalc}
              calcOutcome={orderCalcs.calcOutcome}
              calcMode={orderCalcs.calcMode}
              calcSaveSuccess={orderCalcs.calcSaveSuccess}
              syncStatus={syncStatus}
              locked={locked}
              calcSaving={orderCalcs.calcSaving}
              networkError={networkError}
              calculations={calculations}
              targetMarginPct={globalParams.target_margin_pct}
              onSaveCalculation={orderCalcs.handleSaveCalculation}
              onOpenUnlockModal={() => orderCalcs.setIsUnlockModalOpen(true)}
              onSetShowLivePreview={orderCalcs.setShowLivePreview}
            />
          </div>

          {/* Мобильная сводка расчёта (U3, U4: lg:hidden) */}
          <SummaryBar
            displayCalc={orderCalcs.displayCalc}
            calcOutcome={orderCalcs.calcOutcome}
            calcMode={orderCalcs.calcMode}
            calcSaveSuccess={orderCalcs.calcSaveSuccess}
            syncStatus={syncStatus}
            locked={locked}
            calcSaving={orderCalcs.calcSaving}
            networkError={networkError}
            showBreakdown={showBreakdown}
            setShowBreakdown={setShowBreakdown}
            calculations={calculations}
            targetMarginPct={globalParams.target_margin_pct}
            onSaveCalculation={orderCalcs.handleSaveCalculation}
            onOpenUnlockModal={() => orderCalcs.setIsUnlockModalOpen(true)}
            onSetShowLivePreview={orderCalcs.setShowLivePreview}
          />
        </div>
      )}

      {/* Модальные окна заказа */}
      <OrderModals
        orderData={orderData}
        orderItems={orderItems}
        orderLines={orderLines}
        orderAdjustments={orderAdjustments}
        orderCalcs={orderCalcs}
        isSaveTemplateOpen={isSaveTemplateOpen}
        setIsSaveTemplateOpen={setIsSaveTemplateOpen}
        isApplyTemplateOpen={isApplyTemplateOpen}
        setIsApplyTemplateOpen={setIsApplyTemplateOpen}
        applyTemplateDefaultItemId={applyTemplateDefaultItemId}
        isVersionsModalOpen={isVersionsModalOpen}
        setIsVersionsModalOpen={setIsVersionsModalOpen}
        onTemplateSaved={(name) => {
          void dialog.alert({
            title: "Шаблон сохранён",
            message: `Шаблон «${name}» успешно сохранён и готов к использованию.`,
            variant: "info",
          });
        }}
      />

      {/* Тост отмены удаления позиции или изделия (U7: 6 сек) */}
      {pendingAction && (
        <UndoToast
          message={`Удалено: ${pendingAction.label}`}
          onUndo={undoDelete}
          onDismiss={flushPending}
        />
      )}
    </>
  );
}
