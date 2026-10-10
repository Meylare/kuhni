import { useState } from "react";

import { FactTab } from "../components/FactTab";
import {
  AdjustmentsSection,
  CalcModeSwitch,
  HistoryTab,
  ItemsSection,
  LinesSection,
  OrderHeader,
  OrderModals,
  OrderParametersAccordion,
  SummaryBar,
} from "../components/order";

import {
  useOrderAdjustments,
  useOrderCalculations,
  useOrderData,
  useOrderItems,
  useOrderLines,
} from "../hooks";

interface OrderDetailPageProps {
  orderId: string;
  onBack: () => void;
}

export function OrderDetailPage({ orderId, onBack }: OrderDetailPageProps) {
  // Активная вкладка заказа: "calc" (расчёт) | "history" (история) | "fact" (факт)
  const [orderTab, setOrderTab] = useState<"calc" | "history" | "fact">("calc");

  // Раскрытие подробной сводки затрат
  const [showBreakdown, setShowBreakdown] = useState(false);

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

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center py-20 text-stone-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-900 border-t-transparent" />
        <span className="mt-3 text-sm">Загрузка данных заказа…</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8">
        <button
          type="button"
          onClick={onBack}
          className="self-start min-h-11 rounded-xl border border-stone-300 bg-white/70 px-4 text-sm font-medium text-stone-700 hover:bg-white"
        >
          ← К списку заказов
        </button>
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h2 className="text-base font-bold">Не удалось открыть заказ</h2>
          <p className="mt-1 text-sm">{error || "Заказ не найден"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-4 pb-48 md:pb-32">
      {/* Верхняя навигация, статус, ошибки и вкладки */}
      <OrderHeader
        order={order}
        statusConfig={statusConfig}
        statusLabel={statusLabel}
        locked={locked}
        networkError={networkError}
        copySuccess={orderCalcs.copySuccess}
        orderTab={orderTab}
        linesCount={lines.length}
        calculationsCount={calculations.length}
        factCount={expenses.length + payments.length}
        onBack={onBack}
        onOpenEditHeader={handleOpenEditHeader}
        onRetryLoad={() => void loadOrderData()}
        onOpenUnlockModal={() => orderCalcs.setIsUnlockModalOpen(true)}
        onCopySummary={orderCalcs.handleCopySummary}
        onSelectTab={setOrderTab}
      />

      {orderTab === "history" && (
        <HistoryTab
          calculations={calculations}
          locked={locked}
          calcSaving={orderCalcs.calcSaving}
          networkError={networkError}
          calcSaveSuccess={orderCalcs.calcSaveSuccess}
          calcOutcome={orderCalcs.calcOutcome}
          expandedVersionId={orderCalcs.expandedVersionId}
          setExpandedVersionId={orderCalcs.setExpandedVersionId}
          onSaveCalculation={orderCalcs.handleSaveCalculation}
          onSetBaseline={orderCalcs.handleSetBaseline}
        />
      )}

      {orderTab === "fact" && (
        <FactTab
          order={order}
          expenses={expenses}
          payments={payments}
          calculations={calculations}
          onExpensesChange={setExpenses}
          onPaymentsChange={setPayments}
        />
      )}

      {orderTab === "calc" && (
        <>
          <CalcModeSwitch
            calcMode={orderCalcs.calcMode}
            onSelectCalcMode={orderCalcs.handleSelectCalcMode}
            contractPrice={order.contract_price}
            priceDiff={orderLines.priceDiff}
            isUpdatingPrices={orderLines.isUpdatingPrices}
            locked={locked}
            onOpenPriceDiffModal={() => orderLines.setIsPriceDiffModalOpen(true)}
          />

          <ItemsSection
            items={items}
            lines={lines}
            locked={locked}
            networkError={networkError}
            onOpenAddItem={orderItems.handleOpenAddItem}
            onOpenEditItem={orderItems.handleOpenEditItem}
            onDeleteItem={(id) => void orderItems.handleDeleteItem(id)}
          />

          <LinesSection
            lines={lines}
            categoryTotals={orderCalcs.categoryTotals}
            lineCalculationsById={orderCalcs.lineCalculationsById}
            priceItemsById={orderLines.priceItemsById}
            locked={locked}
            networkError={networkError}
            onOpenPricePicker={orderLines.handleOpenPricePicker}
            onOpenAddManualLine={orderLines.handleOpenAddManualLine}
            onOpenEditLine={orderLines.handleOpenEditLine}
            onDeleteLine={(id) => void orderLines.handleDeleteLine(id)}
          />

          <AdjustmentsSection
            adjustments={adjustments}
            calcMode={orderCalcs.calcMode}
            locked={locked}
            networkError={networkError}
            onOpenAddAdjustment={() => orderAdjustments.handleOpenAddAdjustment(orderCalcs.calcMode)}
            onDeleteAdjustment={(id) => void orderAdjustments.handleDeleteAdjustment(id)}
          />

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
            customTechnologPct={customTechnologPct}
            setCustomTechnologPct={setCustomTechnologPct}
            customRiskReservePct={customRiskReservePct}
            locked={locked}
            paramsSaving={paramsSaving}
            onSaveOrderSettings={handleSaveOrderSettings}
          />
        </>
      )}

      {/* ЗАКРЕПЛЁННАЯ СВОДКА РАСЧЁТА (STICKY BOTTOM BAR) */}
      {orderTab === "calc" && (
        <SummaryBar
          displayCalc={orderCalcs.displayCalc}
          calcOutcome={orderCalcs.calcOutcome}
          calcMode={orderCalcs.calcMode}
          calcSaveSuccess={orderCalcs.calcSaveSuccess}
          locked={locked}
          calcSaving={orderCalcs.calcSaving}
          networkError={networkError}
          showBreakdown={showBreakdown}
          setShowBreakdown={setShowBreakdown}
          calculations={calculations}
          onSaveCalculation={orderCalcs.handleSaveCalculation}
          onOpenUnlockModal={() => orderCalcs.setIsUnlockModalOpen(true)}
          onSetShowLivePreview={orderCalcs.setShowLivePreview}
        />
      )}

      {/* Модальные окна заказа */}
      <OrderModals
        orderData={orderData}
        orderItems={orderItems}
        orderLines={orderLines}
        orderAdjustments={orderAdjustments}
        orderCalcs={orderCalcs}
      />
    </div>
  );
}
