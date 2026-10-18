import {
  AdjustmentModal,
  ApplyTemplateModal,
  ItemModal,
  ManualLineModal,
  MeasurementChecklistModal,
  OrderHeaderModal,
  PriceDiffModal,
  PricePickerModal,
  SaveAsTemplateModal,
  UnlockModal,
  VersionsModal,
} from "./modals";
import {
  useOrderAdjustments,
  useOrderCalculations,
  useOrderChecklist,
  useOrderData,
  useOrderItems,
  useOrderLines,
} from "../../hooks";

interface OrderModalsProps {
  orderData: ReturnType<typeof useOrderData>;
  orderItems: ReturnType<typeof useOrderItems>;
  orderLines: ReturnType<typeof useOrderLines>;
  orderAdjustments: ReturnType<typeof useOrderAdjustments>;
  orderCalcs: ReturnType<typeof useOrderCalculations>;
  orderChecklist: ReturnType<typeof useOrderChecklist>;
  isSaveTemplateOpen: boolean;
  setIsSaveTemplateOpen: (open: boolean) => void;
  isApplyTemplateOpen: boolean;
  setIsApplyTemplateOpen: (open: boolean) => void;
  applyTemplateDefaultItemId?: string;
  isVersionsModalOpen: boolean;
  setIsVersionsModalOpen: (open: boolean) => void;
  onTemplateSaved?: (name: string) => void;
}

export function OrderModals({
  orderData,
  orderItems,
  orderLines,
  orderAdjustments,
  orderCalcs,
  orderChecklist,
  isSaveTemplateOpen,
  setIsSaveTemplateOpen,
  isApplyTemplateOpen,
  setIsApplyTemplateOpen,
  applyTemplateDefaultItemId,
  isVersionsModalOpen,
  setIsVersionsModalOpen,
  onTemplateSaved,
}: OrderModalsProps) {
  return (
    <>
      <OrderHeaderModal
        isOpen={orderData.isEditingHeader}
        onClose={() => orderData.setIsEditingHeader(false)}
        headerName={orderData.headerName}
        setHeaderName={orderData.setHeaderName}
        headerClient={orderData.headerClient}
        setHeaderClient={orderData.setHeaderClient}
        headerStatus={orderData.headerStatus}
        setHeaderStatus={orderData.setHeaderStatus}
        headerContractPrice={orderData.headerContractPrice}
        setHeaderContractPrice={orderData.setHeaderContractPrice}
        headerNote={orderData.headerNote}
        setHeaderNote={orderData.setHeaderNote}
        headerSaving={orderData.headerSaving}
        headerError={orderData.headerError}
        onSave={orderData.handleSaveHeader}
      />

      <ItemModal
        isOpen={orderItems.isItemModalOpen}
        onClose={() => orderItems.setIsItemModalOpen(false)}
        editingItem={orderItems.editingItem}
        itemKind={orderItems.itemKind}
        setItemKind={orderItems.setItemKind}
        itemTitle={orderItems.itemTitle}
        setItemTitle={orderItems.setItemTitle}
        itemMeters={orderItems.itemMeters}
        setItemMeters={orderItems.setItemMeters}
        itemDesc={orderItems.itemDesc}
        setItemDesc={orderItems.setItemDesc}
        itemSaving={orderItems.itemSaving}
        itemError={orderItems.itemError}
        onSave={orderItems.handleSaveItem}
      />

      <PricePickerModal
        isOpen={orderLines.isPricePickerOpen}
        onClose={() => orderLines.setIsPricePickerOpen(false)}
        pickerSearch={orderLines.pickerSearch}
        setPickerSearch={orderLines.setPickerSearch}
        pickerCategory={orderLines.pickerCategory}
        setPickerCategory={orderLines.setPickerCategory}
        filteredCatalogItems={orderLines.filteredCatalogItems}
        recentPriceItems={orderLines.recentPriceItems}
        lines={orderData.lines}
        items={orderData.items}
        pickerItemId={orderLines.pickerItemId}
        setPickerItemId={orderLines.setPickerItemId}
        onStepPriceItem={orderLines.handleStepPriceItem}
        addedItemsCount={orderLines.addedItemsCount}
        selectedPriceItem={orderLines.selectedPriceItem}
        setSelectedPriceItem={orderLines.setSelectedPriceItem}
        handleSelectPriceItem={orderLines.handleSelectPriceItem}
        pickerQty={orderLines.pickerQty}
        setPickerQty={orderLines.setPickerQty}
        pickerWaste={orderLines.pickerWaste}
        setPickerWaste={orderLines.setPickerWaste}
        pickerComment={orderLines.pickerComment}
        setPickerComment={orderLines.setPickerComment}
        pickerSaving={orderLines.pickerSaving}
        pickerError={orderLines.pickerError}
        onAdd={orderLines.handleAddPriceItemToOrder}
      />

      <ManualLineModal
        isOpen={orderLines.isManualLineModalOpen}
        onClose={() => orderLines.setIsManualLineModalOpen(false)}
        editingLine={orderLines.editingLine}
        manualCategory={orderLines.manualCategory}
        setManualCategory={orderLines.setManualCategory}
        manualName={orderLines.manualName}
        setManualName={orderLines.setManualName}
        manualUnit={orderLines.manualUnit}
        setManualUnit={orderLines.setManualUnit}
        manualQty={orderLines.manualQty}
        setManualQty={orderLines.setManualQty}
        manualUnitPrice={orderLines.manualUnitPrice}
        setManualUnitPrice={orderLines.setManualUnitPrice}
        manualWaste={orderLines.manualWaste}
        setManualWaste={orderLines.setManualWaste}
        manualRounding={orderLines.manualRounding}
        setManualRounding={orderLines.setManualRounding}
        manualTechnolog={orderLines.manualTechnolog}
        setManualTechnolog={orderLines.setManualTechnolog}
        manualItemId={orderLines.manualItemId}
        setManualItemId={orderLines.setManualItemId}
        items={orderData.items}
        manualComment={orderLines.manualComment}
        setManualComment={orderLines.setManualComment}
        manualSaving={orderLines.manualSaving}
        manualError={orderLines.manualError}
        onSave={orderLines.handleSaveManualLine}
      />

      <AdjustmentModal
        isOpen={orderAdjustments.isAdjustmentModalOpen}
        onClose={() => orderAdjustments.setIsAdjustmentModalOpen(false)}
        calcMode={orderCalcs.calcMode}
        adjKind={orderAdjustments.adjKind}
        setAdjKind={orderAdjustments.setAdjKind}
        adjLabel={orderAdjustments.adjLabel}
        setAdjLabel={orderAdjustments.setAdjLabel}
        adjAmount={orderAdjustments.adjAmount}
        setAdjAmount={orderAdjustments.setAdjAmount}
        adjComment={orderAdjustments.adjComment}
        setAdjComment={orderAdjustments.setAdjComment}
        adjSaving={orderAdjustments.adjSaving}
        adjError={orderAdjustments.adjError}
        onSave={(e) => orderAdjustments.handleSaveAdjustment(e, orderCalcs.calcMode)}
      />

      <PriceDiffModal
        isOpen={orderLines.isPriceDiffModalOpen}
        onClose={() => orderLines.setIsPriceDiffModalOpen(false)}
        priceDiff={orderLines.priceDiff}
        isUpdating={orderLines.isUpdatingPrices}
        onConfirm={orderLines.handleConfirmPriceUpdates}
      />

      <UnlockModal
        isOpen={orderCalcs.isUnlockModalOpen}
        onClose={() => orderCalcs.setIsUnlockModalOpen(false)}
        statusLabel={orderData.statusLabel}
        isSaving={orderCalcs.unlockSaving}
        onConfirm={orderCalcs.handleConfirmCreateNewVersion}
      />

      <SaveAsTemplateModal
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        lines={orderData.lines}
        onSuccess={(name) => onTemplateSaved?.(name)}
      />

      <ApplyTemplateModal
        isOpen={isApplyTemplateOpen}
        onClose={() => setIsApplyTemplateOpen(false)}
        order={orderData.order}
        items={orderData.items}
        lines={orderData.lines}
        setLines={orderData.setLines}
        priceItemsById={orderLines.priceItemsById}
        globalParams={orderData.globalParams}
        locked={orderData.locked}
        defaultItemId={applyTemplateDefaultItemId}
      />

      <VersionsModal
        isOpen={isVersionsModalOpen}
        onClose={() => setIsVersionsModalOpen(false)}
        calculations={orderData.calculations}
        locked={orderData.locked}
        onSetBaseline={(calcId) => void orderCalcs.handleSetBaseline(calcId)}
        onSaveCalculation={orderCalcs.handleSaveCalculation}
        calcSaving={orderCalcs.calcSaving}
      />

      {orderData.order && (
        <MeasurementChecklistModal
          isOpen={orderChecklist.isChecklistOpen}
          onClose={() => orderChecklist.setIsChecklistOpen(false)}
          order={orderData.order}
          checklist={orderChecklist.checklist}
          onToggleItem={orderChecklist.handleToggleChecklistItem}
          onUpdateItemNote={orderChecklist.handleUpdateChecklistItemNote}
        />
      )}
    </>
  );
}

