import { useState, FormEvent, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import { InvoiceReviewStep } from '../invoice/InvoiceReviewStep'
import { CustomerSelectionStep } from '../invoice/CustomerSelectionStep'
import { InvoiceItemsStep } from '../invoice/InvoiceItemsStep'
import { ProductConfirmSheet } from '../invoice/ProductConfirmSheet'
import { CameraScanner } from '../invoice/CameraScanner'
import type { InvoiceFormData, Org, ProductWithMaster } from '../../types'

import { getAllProducts } from '../../lib/api/products'
import { createInvoice, validateInvoiceItems, clearDraftSessionId } from '../../lib/api/invoices'



import { useInvoiceDraft } from '../../hooks/invoice/useInvoiceDraft'
import { useInvoiceScanner } from '../../hooks/invoice/useInvoiceScanner'
import { useInvoiceItems } from '../../hooks/invoice/useInvoiceItems'
import { useInvoiceCustomer } from '../../hooks/invoice/useInvoiceCustomer'
import { useInvoiceTax } from '../../hooks/invoice/useInvoiceTax'
import { ChevronLeftIcon, ChevronRightIcon, BookmarkIcon } from '@heroicons/react/24/outline'



import { LoadingSpinner } from '../ui/LoadingSpinner'
import { useToastDedupe } from '../../hooks/useToastDedupe'
import { ExclamationCircleIcon } from '@heroicons/react/24/outline'

interface InvoiceFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (invoiceId: string) => Promise<void>
  orgId: string
  userId: string
  org: Org
  title?: string
  draftInvoiceId?: string
  mode?: 'modal' | 'page' // Modal/Drawer (default) or Full-page
  onFormChange?: (hasChanges: boolean) => void  // Track form changes
}

type Step = 1 | 2 | 3 | 4

export function InvoiceForm({
  isOpen,
  onClose,
  onSubmit,
  orgId,
  userId,
  org,
  title,
  draftInvoiceId,
  mode = 'modal',
  onFormChange,
}: InvoiceFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)



  const [products, setProducts] = useState<ProductWithMaster[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)


  // Draft state managed by useInvoiceDraft hook



  // Toast deduplication hook
  const { showToast } = useToastDedupe()

  // Items management hook
  const {
    items: hookItems,
    serialInputs: hookSerialInputs,
    setItems: hookSetItems,
    setSerialInputs: _hookSetSerialInputs,
    handleAddItem: hookHandleAddItem,
    handleRemoveItem: hookHandleRemoveItem,
    handleItemChange: hookHandleItemChange,
    handleProductChange: hookHandleProductChange,
    handleAddSerial: hookHandleAddSerial,
    handleRemoveSerial: hookHandleRemoveSerial,
    handleSerialInputChange: hookHandleSerialInputChange,
  } = useInvoiceItems({
    products,
    orgId,
    initialItems: [], // Will be replaced by draft items when switching
    onError: (message) => {
      showToast('error', message, { autoClose: 3000 })
    },
    // We'll wire this up later if needed
    onItemsChange: (_items) => {
      // Optional: trigger draft save or validation
    }
  })



  // Customer management hook
  const {
    identifier: hookIdentifier,
    identifierValid: _hookIdentifierValid,
    searching: hookSearching,
    selectedCustomer: hookSelectedCustomer,
    inlineFormData: hookInlineFormData,
    errors: hookCustomerErrors,
    fieldPriority: hookFieldPriority,
    completeCustomerData: hookCompleteCustomerData,
    isCustomerDataComplete: hookIsCustomerDataComplete,
    setIdentifier: hookSetIdentifier,
    setIdentifierValid: _hookSetIdentifierValid,
    setSearching: _hookSetSearching,
    setSelectedCustomer: hookSetSelectedCustomer,
    handleCustomerSelected: hookHandleCustomerSelected,
    handleFormDataChange: hookHandleFormDataChange,
    handleCreateOrgCustomer: hookHandleCreateOrgCustomer,
    handleValidateField: hookHandleValidateField,
    resetCustomer: hookResetCustomer,
  } = useInvoiceCustomer({
    orgId,
    onError: (message) => {
      showToast('error', message, { autoClose: 3000 })
    },
    onCustomerCreated: (_customer) => {
      showToast('success', 'Customer saved successfully', { autoClose: 3000 })
      setCurrentStep(2)
    }
  })

  // Draft management hook
  const {
    draftInvoiceId: internalDraftInvoiceId,
    loadingDraft,
    draftLoadError,
    saveStatus,
    isRetrying,
    handleManualSaveDraft,
    retryLoadDraft,
    resetDraftState,
  } = useInvoiceDraft({
    customerId: hookSelectedCustomer?.id || null,
    items: hookItems,
    orgId,
    userId,
    org,
    currentStep, // Pass current step to control auto-save
    isOpen,
    initialDraftInvoiceId: draftInvoiceId,
    mode,
    onDraftRestored: ({ customer, items: restoredItems }) => {
      if (customer) {
        hookSetSelectedCustomer(customer)
      }
      hookSetItems(restoredItems)
      setCurrentStep(2)
    },
    onReset: () => {
      setCurrentStep(1)
      hookResetCustomer()
      hookSetItems([])
      setErrors({})
    },
  })

  // Scanner management hook
  const {
    scannerMode: hookScannerMode,
    showConfirmSheet: hookShowConfirmSheet,
    pendingProduct: hookPendingProduct,
    pendingQuantity: hookPendingQuantity,
    handleScanClick: hookHandleScanClick,
    handleScanFromCamera: hookHandleScanFromCamera,
    handleProductSelect: hookHandleProductSelect,
    handleConfirmProduct: hookHandleConfirmProduct,
    handleCancelConfirm: hookHandleCancelConfirm,
  } = useInvoiceScanner({
    selectedCustomerId: hookSelectedCustomer?.id || null,
    items: hookItems,
    products,
    orgId,
    onItemsChange: hookSetItems,
    onRequireCustomer: () => {
      showToast('error', 'Please select a customer first', { autoClose: 3000 })
    },
    onError: (message) => {
      showToast('error', message, { autoClose: 3000 })
    },
  })



  // Use prop draftInvoiceId if provided, otherwise use hook's internal ID
  const currentDraftInvoiceId = draftInvoiceId || internalDraftInvoiceId

  // Load products when form opens
  useEffect(() => {
    if (isOpen && orgId) {
      setLoadingProducts(true)
      getAllProducts(orgId, { status: 'active' })
        .then((products) => setProducts(products as ProductWithMaster[]))
        .catch((error) => {
          console.error('Error loading products:', error)
        })
        .finally(() => setLoadingProducts(false))
    }
  }, [isOpen, orgId])



  // Track form changes for unsaved data warning
  useEffect(() => {
    if (onFormChange) {
      const hasChanges = hookSelectedCustomer !== null || hookItems.length > 0
      onFormChange(hasChanges)
    }
  }, [hookSelectedCustomer, hookItems, onFormChange])

  // Reset form when closed (but not if we're loading a draft)
  useEffect(() => {
    if (!isOpen && !loadingDraft) {
      // Don't clear session ID here - it should persist if form is reopened
      // Only clear on finalize or explicit delete
      setCurrentStep(1)
      hookResetCustomer()
      hookSetItems([])
      setErrors({})
      // Draft state is reset by the hook
    }
  }, [isOpen, loadingDraft])







  // Tax calculation hook
  const { totals } = useInvoiceTax({
    items: hookItems,
    org,
    selectedCustomer: hookSelectedCustomer,
    products,
  })

  // Step 2: Add Products



  // Step 3: Review
  // Step 4: Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!hookSelectedCustomer) {
      setErrors({ customer: 'Please select a customer' })
      setCurrentStep(1)
      return
    }

    if (hookItems.length === 0) {
      setErrors({ items: 'Please add at least one item' })
      setCurrentStep(2)
      return
    }

    // Validate all items
    const invalidItems = hookItems.some((item) => {
      if (!item.product_id || item.unit_price <= 0) return true

      // For serial-tracked products, check serials instead of quantity
      if (item.serial_tracked) {
        return !item.serials || item.serials.length === 0
      }

      // For non-serial products, check quantity
      return item.quantity <= 0
    })

    if (invalidItems) {
      setErrors({ items: 'Please fill all item fields correctly (serials for serial-tracked products, quantity for others)' })
      setCurrentStep(2)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // Backend validation before finalization
      const validationItems = hookItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        serials: item.serials || [],
        serial_tracked: item.serial_tracked || false,
      }))

      // Validate items - allow drafts (pending masters allowed)
      const validation = await validateInvoiceItems(orgId, validationItems, true)

      if (!validation.valid) {
        // Group errors by type
        const productErrors = validation.errors.filter(e => e.type === 'product_not_found')
        const serialErrors = validation.errors.filter(e => e.type === 'serial_not_found')
        const stockErrors = validation.errors.filter(e => e.type === 'insufficient_stock')
        const masterProductErrors = validation.errors.filter(e =>
          e.type === 'master_product_not_approved' ||
          e.type === 'master_product_missing_hsn' ||
          e.type === 'master_product_not_linked' ||
          e.type === 'master_product_invalid_hsn'
        )

        // Update items with validation errors and available stock
        const updatedItems = hookItems.map((item, index) => {
          const itemErrors = validation.errors.filter(e => e.item_index === index + 1)
          const stockError = itemErrors.find(e => e.type === 'insufficient_stock')
          const masterProductError = itemErrors.find(e =>
            e.type === 'master_product_not_approved' ||
            e.type === 'master_product_missing_hsn' ||
            e.type === 'master_product_not_linked' ||
            e.type === 'master_product_invalid_hsn'
          )

          return {
            ...item,
            validation_errors: itemErrors.map(e => e.message),
            stock_available: stockError?.available_stock,
            // Add master product error info if present
            ...(masterProductError && {
              master_product_error: {
                type: masterProductError.type,
                message: masterProductError.message,
                approval_status: masterProductError.approval_status,
              }
            }),
          }
        })
        hookSetItems(updatedItems)

        // Show toast with error summary
        let errorMessage = 'Invoice validation failed: '
        if (masterProductErrors.length > 0) {
          errorMessage += `${masterProductErrors.length} product(s) pending master approval. You can save as draft; finalization will unlock after approval. `
        }
        if (productErrors.length > 0) {
          errorMessage += `${productErrors.length} product(s) not found. `
        }
        if (serialErrors.length > 0) {
          errorMessage += `${serialErrors.length} serial(s) not found. `
        }
        if (stockErrors.length > 0) {
          errorMessage += `${stockErrors.length} item(s) have insufficient stock. `
        }
        showToast('error', errorMessage.trim(), { autoClose: 3000 })

        // Set form errors
        setErrors({
          items: 'Some items have validation errors. Please fix them before finalizing.',
          submit: 'Cannot create invoice with invalid items'
        })
        setCurrentStep(2)
        setIsSubmitting(false)
        return
      }

      const invoiceData: InvoiceFormData = {
        customer_id: hookSelectedCustomer.id,
        items: hookItems.map((item) => ({
          ...item,
          line_total: item.quantity * item.unit_price,
        })),
      }

      const invoice = await createInvoice(
        orgId,
        userId,
        invoiceData,
        org,
        hookSelectedCustomer!
      )

      // Clear draft session ID on finalize
      if (currentDraftInvoiceId) {
        clearDraftSessionId(currentDraftInvoiceId)
      } else {
        clearDraftSessionId()
      }

      await onSubmit(invoice.id)
      onClose()
    } catch (error) {
      console.error('Error creating invoice:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create invoice',
      })
      showToast('error', error instanceof Error ? error.message : 'Failed to create invoice', { autoClose: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 1 validation: Use hook's computed validation (merges identifier + form fields)
  // This properly accounts for mobile/GSTIN in combobox + name/other fields in form
  const isAddNewCustomerMode = !hookSelectedCustomer && hookIdentifier.trim().length >= 3
  const canProceedToStep2 = hookSelectedCustomer !== null

  const canProceedToStep3 = hookItems.length > 0 && hookItems.every((item) => item.product_id && item.quantity > 0 && item.unit_price > 0)

  // Show loading or error state when loading draft
  const DraftLoadingContent = (
    <div className="flex flex-col items-center justify-center py-12 space-y-4 px-4">
      {loadingDraft && !draftLoadError && (
        <>
          <LoadingSpinner size="lg" />
          <p className="text-sm text-secondary-text">
            {isRetrying ? 'Retrying...' : 'Loading draft...'}
          </p>
        </>
      )}
      {draftLoadError && !loadingDraft && (
        <div className="text-center space-y-4 max-w-md mx-auto p-lg">
          <div className="text-error-dark">
            <ExclamationCircleIcon className="h-16 w-16 mx-auto mb-4" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-primary-text mb-2">
              Failed to Load Draft
            </h3>
            <p className="text-sm text-secondary-text mb-4">
              {draftLoadError}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
            <Button
              variant="primary"
              size="md"
              onClick={retryLoadDraft}
              disabled={loadingDraft}
              className="w-full"
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                // Reset form and start new invoice
                resetDraftState()
                setCurrentStep(1)
                hookResetCustomer()
                hookSetItems([])
                // Don't close the form - allow user to start new invoice
              }}
              className="w-full"
            >
              Start New Invoice
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // Show loading/error UI only when we're loading a draft or have a draft error
  // Don't show form content for new transactions while draft is loading
  const showDraftLoadingUI = draftInvoiceId && (loadingDraft || draftLoadError)

  const FormContent = showDraftLoadingUI ? (
    DraftLoadingContent
  ) : (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Customer Selection */}
      {currentStep === 1 && (
        <CustomerSelectionStep
          searchValue={hookIdentifier}
          onSearchChange={hookSetIdentifier}
          isSearching={hookSearching}
          searchError={hookCustomerErrors.identifier}
          selectedCustomer={hookSelectedCustomer}
          onCustomerSelected={(customer) => {
            hookHandleCustomerSelected(customer)
          }}
          newCustomerData={hookInlineFormData}
          formErrors={{
            name: hookCustomerErrors.name,
            mobile: hookCustomerErrors.mobile,
            gstin: hookCustomerErrors.gstin,
          }}
          onFormDataChange={hookHandleFormDataChange}
          onSubmitNewCustomer={hookHandleCreateOrgCustomer}
          onFieldBlur={hookHandleValidateField}
          fieldPriority={hookFieldPriority}
          onContinue={() => setCurrentStep(2)}
          orgId={orgId}
          isDisabled={isSubmitting}
          autoFocus={isOpen && currentStep === 1}
        />
      )}

      {/* Step 2: Add Products */}
      {currentStep === 2 && (
        <InvoiceItemsStep
          items={hookItems}
          products={products}
          loadingProducts={loadingProducts}
          itemsError={errors.items}
          onAddItem={hookHandleAddItem}
          onRemoveItem={hookHandleRemoveItem}
          onProductSelect={hookHandleProductSelect}
          onProductChange={hookHandleProductChange}
          onItemFieldChange={hookHandleItemChange}
          serialInputs={hookSerialInputs}
          onSerialInputChange={hookHandleSerialInputChange}
          onAddSerial={hookHandleAddSerial}
          onRemoveSerial={hookHandleRemoveSerial}
          onScanClick={hookHandleScanClick}
          orgId={orgId}
          isDisabled={isSubmitting}
        />
      )}

      {/* Step 3: Review */}
      {currentStep === 3 && (
        <InvoiceReviewStep
          customer={hookSelectedCustomer}
          items={hookItems}
          products={products}
          totals={totals}
        />
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-sm pt-md border-t border-neutral-200">
        <div className="flex-1">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentStep((s) => (s - 1) as Step)}
              disabled={isSubmitting}
              className="w-full"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-sm flex-1">
          {currentStep < 3 && (
            <Button
              type="button"
              variant="primary"
              onClick={async () => {
                if (currentStep === 1) {
                  // Step 1 → Step 2: Validate and create customer if needed
                  if (canProceedToStep2) {
                    // Customer already selected, proceed
                    setCurrentStep(2)
                  } else if (isAddNewCustomerMode) {
                    // In "add new" mode - validate and create
                    if (!hookIsCustomerDataComplete) {
                      // Show specific error message
                      let errorMsg = 'Please complete the customer information: '
                      const issues = []

                      if (hookCompleteCustomerData.name.trim().length < 3) {
                        issues.push('Name must be at least 3 characters')
                      }
                      if (!hookCompleteCustomerData.mobile.trim() && !hookCompleteCustomerData.gstin.trim()) {
                        issues.push('Provide at least Mobile Number or GSTIN')
                      }
                      if (hookCustomerErrors.name) issues.push(hookCustomerErrors.name)
                      if (hookCustomerErrors.mobile) issues.push(hookCustomerErrors.mobile)
                      if (hookCustomerErrors.gstin) issues.push(hookCustomerErrors.gstin)

                      errorMsg += issues.join('; ')
                      showToast('error', errorMsg, { autoClose: 5000 })
                      return
                    }

                    // Valid data - create customer then proceed
                    try {
                      await hookHandleCreateOrgCustomer()
                      // Customer creation will trigger onCustomerCreated callback which sets step to 2
                    } catch (error) {
                      // Error already handled in the hook
                      console.error('Failed to create customer:', error)
                    }
                  } else {
                    // No customer selected and no form data entered
                    showToast('error', 'Please select a customer or enter customer details', { autoClose: 3000 })
                  }
                } else if (currentStep === 2 && canProceedToStep3) {
                  setCurrentStep(3)
                }
              }}
              disabled={
                isSubmitting ||
                (currentStep === 1 && !canProceedToStep2 && !hookIsCustomerDataComplete) ||
                (currentStep === 2 && !canProceedToStep3)
              }
              className="w-full"
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          )}

          {currentStep === 3 && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="flex-1"
                disabled={
                  hookItems.some(item =>
                    (item.invalid_serials && item.invalid_serials.length > 0) ||
                    (item.validation_errors && item.validation_errors.length > 0)
                  )
                }
              >
                Create Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {errors.submit && (
        <p className="text-sm text-error">{errors.submit}</p>
      )}
    </form>
  )

  const formTitle = title || 'Create Invoice'

  // Header action: Save Draft button
  const headerAction = hookSelectedCustomer ? (
    <button
      type="button"
      onClick={handleManualSaveDraft}
      disabled={isSubmitting || saveStatus === 'saving'}
      className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-text hover:bg-neutral-100 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Save draft"
      title="Save draft"
    >
      {saveStatus === 'saving' ? (
        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <BookmarkIcon className="h-5 w-5" />
      )}
    </button>
  ) : null

  return (
    <>

      {mode === 'page' ? (
        // Page mode: render form content directly without modal/drawer wrapper
        FormContent
      ) : (
        // Modal mode: wrap in Drawer (mobile) or Modal (desktop)
        isMobileDevice() ? (
          <Drawer isOpen={isOpen} onClose={onClose} title={formTitle} headerAction={headerAction}>
            {FormContent}
          </Drawer>
        ) : (
          <Modal isOpen={isOpen} onClose={onClose} title={formTitle} headerAction={headerAction}>
            {FormContent}
          </Modal>
        )
      )}

      {/* Camera Scanner - Continuous Mode */}
      <CameraScanner
        isOpen={hookScannerMode === 'scanning' || hookScannerMode === 'confirming'}
        onClose={() => {
          // Scanner close is now managed by hook - this shouldn't be called
          // but keeping for safety during transition
          console.warn('CameraScanner onClose called - should be managed by hook')
        }}
        onScanSuccess={hookHandleScanFromCamera}
        continuousMode={true}
      />

      {/* Backdrop - z-index 9999, dims content but NOT scanner */}
      {hookScannerMode === 'confirming' && (
        <div
          className="fixed inset-0 bg-black/40"
          style={{ zIndex: 9999 }}
          onClick={hookHandleCancelConfirm}
          aria-hidden="true"
        />
      )}

      {/* Product Confirmation Sheet - z-index 10000, solid white */}
      <ProductConfirmSheet
        isOpen={hookShowConfirmSheet}
        product={hookPendingProduct}
        onConfirm={hookHandleConfirmProduct}
        onCancel={hookHandleCancelConfirm}
        defaultQuantity={hookPendingQuantity}
        scannerMode={hookScannerMode}
      />
    </>
  )
}

