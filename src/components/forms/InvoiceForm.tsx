import { useState, FormEvent, useEffect, useMemo, useRef, useCallback } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import { InvoiceReviewStep } from '../invoice/InvoiceReviewStep'
import { CustomerSelectionStep } from '../invoice/CustomerSelectionStep'
import { InvoiceItemsStep } from '../invoice/InvoiceItemsStep'
import { ProductConfirmSheet } from '../invoice/ProductConfirmSheet'
import { CameraScanner } from '../invoice/CameraScanner'
import type { InvoiceFormData, InvoiceItemFormData, CustomerWithMaster, Org, ProductWithMaster } from '../../types'
import { addOrgCustomer, getCustomerById } from '../../lib/api/customers'
import { getAllProducts } from '../../lib/api/products'
import { createInvoice, autoSaveInvoiceDraft, validateInvoiceItems, loadDraftInvoiceData, revalidateDraftInvoice, getInvoiceById, clearDraftSessionId } from '../../lib/api/invoices'
import { checkSerialStatus } from '../../lib/api/serials'
import { validateScannerCodes } from '../../lib/api/scanner'
import { calculateTax, createTaxContext, productToLineItem } from '../../lib/utils/taxCalculationService'
import { useAutoSave } from '../../hooks/useAutoSave'
import { useInvoiceDraft } from '../../hooks/invoice/useInvoiceDraft'
import { ChevronLeftIcon, ChevronRightIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { detectIdentifierType, validateMobile, validateGSTIN } from '../../lib/utils/identifierValidation'
import { Toast } from '../ui/Toast'
import { getDraftSessionId, setDraftSessionId } from '../../lib/utils/draftSession'
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
  const [identifier, setIdentifier] = useState('')
  const [identifierValid, setIdentifierValid] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMaster | null>(null)
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [inlineFormData, setInlineFormData] = useState<{ name: string; mobile: string; gstin: string }>({
    name: '',
    mobile: '',
    gstin: '',
  })

  // Prefill inline form when opening
  useEffect(() => {
    if (showAddNewForm) {
      const type = detectIdentifierType(identifier)
      if (type === 'mobile') {
        setInlineFormData({ name: '', mobile: identifier, gstin: '' })
      } else if (type === 'gstin') {
        setInlineFormData({ name: '', mobile: '', gstin: identifier })
      } else {
        setInlineFormData({ name: identifier, mobile: '', gstin: '' })
      }
    }
  }, [showAddNewForm]) // Intentionally omit identifier to avoid overwriting user edits

  const [products, setProducts] = useState<ProductWithMaster[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [items, setItems] = useState<InvoiceItemFormData[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [internalDraftInvoiceId, setInternalDraftInvoiceId] = useState<string | null>(null)
  const [serialInputs, setSerialInputs] = useState<Record<number, string>>({})

  // Scanner and confirmation state
  type ScannerMode = 'closed' | 'scanning' | 'confirming'
  const [scannerMode, setScannerMode] = useState<ScannerMode>('closed')
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<ProductWithMaster | null>(null)
  const [pendingQuantity, setPendingQuantity] = useState(1)

  // Draft loading state
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const draftLoadRetries = useRef(0)
  const MAX_RETRIES = 1

  // Draft session ID ref - persists across re-renders
  const draftSessionId = useRef<string | null>(null)

  // Use prop if provided, otherwise use internal state
  const currentDraftInvoiceId = draftInvoiceId || internalDraftInvoiceId

  // Toast deduplication hook
  const { showToast } = useToastDedupe()

  // Draft management hook (placeholder - logic will be moved here incrementally)
  const {
    draftInvoiceId: hookDraftId,
    loadingDraft: hookLoadingDraft,
    draftLoadError: hookDraftLoadError,
    saveStatus: hookSaveStatus,
    isRetrying: hookIsRetrying,
    handleManualSaveDraft: hookHandleManualSaveDraft,
    clearDraftSession: hookClearDraftSession,
    retryLoadDraft: hookRetryLoadDraft,
  } = useInvoiceDraft({
    customerId: selectedCustomer?.id || null,
    items,
    orgId,
    userId,
    org,
    isOpen,
    initialDraftInvoiceId: draftInvoiceId,
    mode,
    onDraftRestored: ({ customer, items: restoredItems }) => {
      setSelectedCustomer(customer)
      setItems(restoredItems)
      setCurrentStep(2)
    },
    onReset: () => {
      setCurrentStep(1)
      setIdentifier('')
      setIdentifierValid(false)
      setSelectedCustomer(null)
      setShowAddNewForm(false)
      setInlineFormData({ name: '', mobile: '', gstin: '' })
      setItems([])
      setErrors({})
      setInternalDraftInvoiceId(null)
    },
  })

  // Temporary log to use hook outputs during skeleton phase - will be removed
  console.log('Draft hook status:', { hookDraftId, hookLoadingDraft, hookDraftLoadError, hookSaveStatus, hookIsRetrying })
  console.log('Draft hook actions:', { hookHandleManualSaveDraft, hookClearDraftSession, hookRetryLoadDraft })

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

  // Initialize draft session ID when form opens
  useEffect(() => {
    if (isOpen) {
      if (draftInvoiceId) {
        // For existing drafts, get session ID from sessionStorage or create new one
        draftSessionId.current = getDraftSessionId(draftInvoiceId)
      } else {
        // For new drafts, create new session ID
        draftSessionId.current = getDraftSessionId()
      }
    }
  }, [isOpen, draftInvoiceId])

  // Track form changes for unsaved data warning
  useEffect(() => {
    if (onFormChange) {
      const hasChanges = selectedCustomer !== null || items.length > 0
      onFormChange(hasChanges)
    }
  }, [selectedCustomer, items, onFormChange])

  // Helper function to classify errors as retry-able or permanent
  const isRetryableError = (error: any): boolean => {
    if (!error) return false

    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toLowerCase() || ''

    // Schema cache errors are retry-able (will be handled with cache reload)
    const isSchemaCacheError =
      errorCode === 'pgrst200' ||
      errorMessage.includes('could not find a relationship') ||
      errorMessage.includes('schema cache') ||
      (errorMessage.includes('relationship') && errorMessage.includes('schema'))

    if (isSchemaCacheError) {
      return true
    }

    // Retry-able errors: network issues, RLS policy errors, timeouts
    const retryablePatterns = [
      'network',
      'timeout',
      'fetch',
      'rls',
      'row level security',
      'policy',
      'connection',
      'failed to fetch',
      'networkerror',
      'pgrst',
    ]

    // Permanent errors: not found, deleted, invalid
    const permanentPatterns = [
      'not found',
      'does not exist',
      'deleted',
      'invalid',
      'malformed',
      'unauthorized',
      'forbidden',
      'permission denied',
      'draft data not found',
    ]

    // Check for permanent errors first
    if (permanentPatterns.some(pattern => errorMessage.includes(pattern) || errorCode.includes(pattern))) {
      return false
    }

    // Check for retry-able errors
    if (retryablePatterns.some(pattern => errorMessage.includes(pattern) || errorCode.includes(pattern))) {
      return true
    }

    // Default: retry on unknown errors (might be transient)
    return true
  }

  // Load draft with retry logic
  const loadDraftWithRetry = useCallback(async (invoiceId: string, retryCount = 0): Promise<void> => {
    try {
      setLoadingDraft(true)
      setDraftLoadError(null)
      setIsRetrying(retryCount > 0)

      const draftData = await loadDraftInvoiceData(invoiceId)

      if (draftData) {
        // Restore draft session ID from database
        if (draftData.draft_session_id) {
          draftSessionId.current = draftData.draft_session_id
          setDraftSessionId(invoiceId, draftData.draft_session_id)
        }

        // Load customer
        const draftInvoice = await getInvoiceById(invoiceId)
        if (draftInvoice.customer) {
          setSelectedCustomer(draftInvoice.customer as any)
        }

        // Load products and restore items
        const allProducts = await getAllProducts(orgId, { status: 'active' })
        const restoredItems: InvoiceItemFormData[] = draftData.items.map((draftItem: any) => {
          const product = allProducts.find((p: any) => p.id === draftItem.product_id)
          return {
            product_id: draftItem.product_id,
            quantity: draftItem.quantity || 0,
            unit_price: draftItem.unit_price || (product?.selling_price || 0),
            line_total: draftItem.line_total || (draftItem.quantity * (draftItem.unit_price || product?.selling_price || 0)),
            serials: draftItem.serials || [],
            serial_tracked: product?.serial_tracked || false,
            invalid_serials: draftItem.invalid_serials || [],
            validation_errors: draftItem.validation_errors || [],
            stock_available: draftItem.stock_available,
          }
        })
        setItems(restoredItems)
        setInternalDraftInvoiceId(invoiceId)
        // Only advance to step 2 on successful load - don't auto-advance on error
        setCurrentStep(2)

        // Reset retry counter on success
        draftLoadRetries.current = 0
        setIsRetrying(false)

        // Re-validate draft
        try {
          const revalidation = await revalidateDraftInvoice(invoiceId, orgId)
          if (revalidation.updated) {
            showToast('success', 'Draft revalidated — missing items are now available.', { autoClose: 3000 })
            if (revalidation.valid) {
              const cleanedItems = restoredItems.map(item => ({
                ...item,
                invalid_serials: [],
                validation_errors: [],
              }))
              setItems(cleanedItems)
            }
          }
        } catch (revalError) {
          console.error('Error re-validating draft:', revalError)
        }
      } else {
        // Draft data is null - permanent error
        throw new Error('Draft data not found')
      }
    } catch (error) {
      console.error('Error loading draft:', error)

      // Check if error is retry-able and we haven't exceeded max retries
      if (isRetryableError(error) && retryCount < MAX_RETRIES) {
        draftLoadRetries.current = retryCount + 1
        setIsRetrying(true)

        // Wait 500ms before retrying
        await new Promise(resolve => setTimeout(resolve, 500))

        // Retry
        return loadDraftWithRetry(invoiceId, retryCount + 1)
      } else {
        // Permanent error or max retries exceeded
        const errorMessage = error instanceof Error ? error.message : 'Failed to load draft invoice'
        setDraftLoadError(errorMessage)
        setIsRetrying(false)
        // Use deduplicated toast
        showToast('error', errorMessage, { unique: true, autoClose: 5000 })
        // Don't auto-advance to step 2 on failure - show error UI instead
      }
    } finally {
      setLoadingDraft(false)
    }
  }, [orgId, showToast, loadDraftInvoiceData, getInvoiceById, getAllProducts, revalidateDraftInvoice, setDraftSessionId])

  // Load draft on mount if draftInvoiceId prop is provided
  useEffect(() => {
    if (isOpen && draftInvoiceId) {
      // Reset retry counter when opening draft
      draftLoadRetries.current = 0
      setDraftLoadError(null)
      setIsRetrying(false)

      // Load draft with retry
      loadDraftWithRetry(draftInvoiceId)
    }
  }, [isOpen, draftInvoiceId, loadDraftWithRetry])

  // Reset form when closed (but not if we're loading a draft)
  useEffect(() => {
    if (!isOpen && !loadingDraft) {
      // Don't clear session ID here - it should persist if form is reopened
      // Only clear on finalize or explicit delete
      setCurrentStep(1)
      setIdentifier('')
      setIdentifierValid(false)
      setSelectedCustomer(null)
      setShowAddNewForm(false)
      setInlineFormData({ name: '', mobile: '', gstin: '' })
      setItems([])
      setErrors({})
      setInternalDraftInvoiceId(null)
      setDraftLoadError(null)
      setIsRetrying(false)
    }
  }, [isOpen, loadingDraft])

  // Reset selectedCustomer when identifier changes (ensures Next button stays disabled)
  useEffect(() => {
    if (identifier.trim() === '' || !identifierValid) {
      setSelectedCustomer(null)
    }
  }, [identifier, identifierValid])



  const handleCreateOrgCustomer = async () => {
    const formErrors: Record<string, string> = {}

    if (!inlineFormData.name || inlineFormData.name.trim().length < 2) {
      formErrors.name = 'Customer name is required (min 2 chars)'
    }

    if (inlineFormData.mobile && !validateMobile(inlineFormData.mobile)) {
      formErrors.mobile = 'Mobile must be 10 digits'
    }

    if (inlineFormData.gstin && !validateGSTIN(inlineFormData.gstin)) {
      formErrors.gstin = 'Invalid GSTIN format'
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setSearching(true)
    setErrors({})

    try {
      const customerId = await addOrgCustomer(
        orgId,
        inlineFormData.name,
        inlineFormData.mobile || null,
        inlineFormData.gstin || null
      )

      const newCustomer = await getCustomerById(customerId)
      setSelectedCustomer(newCustomer)

      // Update identifier input to show the name
      setIdentifier(newCustomer.alias_name || newCustomer.name || newCustomer.master_customer.legal_name)

      setShowAddNewForm(false)
      setInlineFormData({ name: '', mobile: '', gstin: '' })
      setCurrentStep(2)
      showToast('success', 'Customer added successfully', { autoClose: 3000 })
    } catch (error) {
      console.error('Error adding customer:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to add customer',
      })
    } finally {
      setSearching(false)
    }
  }

  // Step 2: Add Products
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: '',
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItemFormData, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }

    // Recalculate line_total if quantity or unit_price changed
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = (updated[index].quantity || 0) * (updated[index].unit_price || 0)
    }

    setItems(updated)
  }

  const handleProductChange = (index: number, productId: string) => {
    const updated = [...items]
    const selectedProduct = products.find((p) => p.id === productId)

    updated[index] = {
      ...updated[index],
      product_id: productId,
      unit_price: selectedProduct?.selling_price || updated[index].unit_price || 0,
      serial_tracked: selectedProduct?.serial_tracked || false,
      serials: selectedProduct?.serial_tracked ? (updated[index].serials || []) : undefined,
      quantity: selectedProduct?.serial_tracked ? (updated[index].serials?.length || 0) : updated[index].quantity || 1,
    }

    // Recalculate line_total
    updated[index].line_total = (updated[index].quantity || 0) * updated[index].unit_price

    setItems(updated)
  }

  // Handle product selection from combobox
  const handleProductSelect = (product: ProductWithMaster) => {
    if (!selectedCustomer) {
      showToast('error', 'Please select a customer first', { autoClose: 3000 })
      return
    }
    setPendingProduct(product)
    setPendingQuantity(1)
    setShowConfirmSheet(true)
  }

  // Handle scan from camera (continuous mode)
  const handleScanFromCamera = async (code: string) => {
    if (!selectedCustomer) {
      showToast('error', 'Please select a customer first', { autoClose: 3000 })
      setScannerMode('closed')
      return
    }

    try {
      // Validate single code
      const results = await validateScannerCodes(orgId, [code])

      if (results.length === 0) {
        showToast('error', 'Product not found. Ask your branch head to add this product.', { autoClose: 3000 })
        return
      }

      const result = results[0]

      if (result.status === 'valid' && result.product_id) {
        const product = products.find((p) => p.id === result.product_id)
        if (product) {
          // Show confirmation sheet (scanner stays open)
          setPendingProduct(product)
          setPendingQuantity(1)
          setScannerMode('confirming')
          setShowConfirmSheet(true)
        } else {
          showToast('error', 'Product not found in inventory.', { autoClose: 3000 })
        }
      } else if (result.status === 'invalid') {
        showToast('error', 'This product isn\'t in stock yet. Ask your branch head to add or stock it.', { autoClose: 3000 })
      } else if (result.status === 'not_found') {
        showToast('error', 'Product not found. Ask your branch head to add this product.', { autoClose: 3000 })
      }
    } catch (error) {
      console.error('Error processing scan:', error)
      showToast('error', error instanceof Error ? error.message : 'Failed to process scan', { autoClose: 3000 })
    }
  }

  // Handle product confirmation
  const handleConfirmProduct = (quantity: number, serial?: string) => {
    if (!pendingProduct) return

    const updatedItems = [...items]

    // Check if item already exists for this product
    const existingIndex = updatedItems.findIndex((item) => item.product_id === pendingProduct.id)

    if (existingIndex >= 0) {
      // Update existing item
      const existingItem = updatedItems[existingIndex]
      if (pendingProduct.serial_tracked && serial) {
        // Add serial to existing item
        const existingSerials = existingItem.serials || []
        if (!existingSerials.includes(serial)) {
          existingItem.serials = [...existingSerials, serial]
          existingItem.quantity = existingItem.serials.length
        }
      } else {
        // Increase quantity
        existingItem.quantity = (existingItem.quantity || 0) + quantity
      }
      existingItem.line_total = existingItem.quantity * existingItem.unit_price
    } else {
      // Create new item
      const newItem: InvoiceItemFormData = {
        product_id: pendingProduct.id,
        quantity: pendingProduct.serial_tracked && serial ? 1 : quantity,
        unit_price: pendingProduct.selling_price || 0,
        line_total: 0,
        serial_tracked: pendingProduct.serial_tracked || false,
        serials: pendingProduct.serial_tracked && serial ? [serial] : undefined,
      }
      newItem.line_total = newItem.quantity * newItem.unit_price
      updatedItems.push(newItem)
    }

    setItems(updatedItems)
    setShowConfirmSheet(false)
    setPendingProduct(null)

    // If scanner was open, continue scanning
    if (scannerMode === 'confirming') {
      setScannerMode('scanning')
    }
  }

  // Handle cancel confirmation
  const handleCancelConfirm = () => {
    setShowConfirmSheet(false)
    setPendingProduct(null)

    // If scanner was open, continue scanning
    if (scannerMode === 'confirming') {
      setScannerMode('scanning')
    }
  }

  // Handle scanner open
  const handleScanClick = () => {
    if (!selectedCustomer) {
      showToast('error', 'Please select a customer first', { autoClose: 3000 })
      return
    }
    setScannerMode('scanning')
  }

  // Auto-save draft
  const draftData = useMemo(() => ({
    customer_id: selectedCustomer?.id,
    items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      serials: item.serials,
    })),
  }), [selectedCustomer, items])

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null)
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number | null>(null)

  const { saveStatus, manualSave } = useAutoSave(
    draftData,
    async (data) => {
      if (!selectedCustomer || !draftSessionId.current) return
      try {
        const result = await autoSaveInvoiceDraft(
          orgId,
          userId,
          internalDraftInvoiceId || '',
          data
        )
        setInternalDraftInvoiceId(result.invoiceId)
        // Update session ID if it changed
        if (result.sessionId && result.sessionId !== draftSessionId.current) {
          draftSessionId.current = result.sessionId
          if (result.invoiceId) {
            setDraftSessionId(result.invoiceId, result.sessionId)
          }
        }
        const now = Date.now()
        // Only show toast if it's been more than 3 seconds since last auto-save (avoid spam)
        if (!lastAutoSaveTime || now - lastAutoSaveTime > 3000) {
          showToast('success', 'Draft saved automatically', { autoClose: 2000 })
          setLastAutoSaveTime(now)
        }
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    },
    {
      localDebounce: 1500,  // 1.5s debounce for localStorage
      rpcInterval: 5000,     // 5s interval for RPC calls
      enabled: selectedCustomer !== null && draftSessionId.current !== null
    }
  )

  const handleManualSaveDraft = async () => {
    if (!selectedCustomer) return
    try {
      await manualSave()
      const hasInvalidItems = items.some(item =>
        (item.invalid_serials && item.invalid_serials.length > 0) ||
        (item.validation_errors && item.validation_errors.length > 0)
      )
      if (hasInvalidItems) {
        showToast('info', 'Draft saved (contains items needing review)', { autoClose: 3000 })
      } else {
        showToast('success', 'Draft saved', { autoClose: 3000 })
      }
    } catch (error) {
      console.error('Manual save failed:', error)
      showToast('error', 'Failed to save draft', { autoClose: 5000 })
    }
  }

  // Add serial to item
  const handleAddSerial = async (itemIndex: number, serial: string) => {
    const updated = [...items]
    const item = updated[itemIndex]

    if (!item.serials) {
      item.serials = []
    }

    // Skip if serial already exists
    if (item.serials.includes(serial)) {
      return
    }

    // Validate serial before adding
    try {
      const serialStatus = await checkSerialStatus(orgId, serial.trim())

      if (!serialStatus.found) {
        // Serial not found - allow adding but mark as invalid
        if (!item.invalid_serials) {
          item.invalid_serials = []
        }
        item.invalid_serials.push(serial.trim())
        setToast({
          message: 'Serial not found in stock. Saved as draft for branch head review.',
          type: 'error'
        })
      } else if (serialStatus.product_id !== item.product_id) {
        // Serial belongs to different product
        setToast({
          message: `Serial belongs to a different product.`,
          type: 'error'
        })
        return
      } else if (serialStatus.status !== 'available') {
        // Serial not available
        if (!item.invalid_serials) {
          item.invalid_serials = []
        }
        item.invalid_serials.push(serial.trim())
        setToast({
          message: 'Serial not available in stock. Saved as draft for branch head review.',
          type: 'error'
        })
      }

      // Add serial (even if invalid, for draft purposes)
      item.serials.push(serial.trim())
      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
    } catch (error) {
      console.error('Error validating serial:', error)
      // Still allow adding for draft, but mark as invalid
      if (!item.invalid_serials) {
        item.invalid_serials = []
      }
      item.invalid_serials.push(serial.trim())
      item.serials.push(serial.trim())
      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
      setToast({
        message: 'Error validating serial. Saved as draft for branch head review.',
        type: 'error'
      })
    }
  }

  // Remove serial from item
  const handleRemoveSerial = (itemIndex: number, serialIndex: number) => {
    const updated = [...items]
    const item = updated[itemIndex]

    if (item.serials) {
      const removedSerial = item.serials[serialIndex]
      item.serials.splice(serialIndex, 1)

      // Also remove from invalid_serials if present
      if (item.invalid_serials && item.invalid_serials.includes(removedSerial)) {
        item.invalid_serials = item.invalid_serials.filter(s => s !== removedSerial)
      }

      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
    }
  }

  // Calculate totals using new Tax Calculation Service
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0)

    // If no customer selected or no items, return zero tax
    if (!selectedCustomer || items.length === 0) {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: subtotal,
        tax_label: '',
        supply_type: 'exempt' as const,
      }
    }

    // Create tax calculation context using new schema fields
    const taxContext = createTaxContext(org, selectedCustomer)

    // Convert items to line items format for tax calculation
    const lineItems = items.map(item => {
      const product = products.find((p) => p.id === item.product_id) as ProductWithMaster | undefined
      // Use product.tax_rate (org-specific) if available, otherwise fallback to master_product.gst_rate
      const taxRate = product?.tax_rate ?? product?.master_product?.gst_rate ?? null
      const hsnSacCode = product?.hsn_sac_code ?? product?.master_product?.hsn_code ?? null

      return productToLineItem(
        item.line_total,
        taxRate,
        hsnSacCode
      )
    })

    // Calculate tax using new service
    const taxResult = calculateTax(taxContext, lineItems, true) // GST-inclusive pricing

    return {
      subtotal: taxResult.subtotal,
      cgst_amount: taxResult.cgst_amount,
      sgst_amount: taxResult.sgst_amount,
      igst_amount: taxResult.igst_amount,
      total_amount: taxResult.grand_total,
      tax_label: taxResult.tax_label,
      supply_type: taxResult.supply_type,
    }
  }, [items, org, selectedCustomer, products])

  // Step 3: Review
  // Step 4: Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedCustomer) {
      setErrors({ customer: 'Please select a customer' })
      setCurrentStep(1)
      return
    }

    if (items.length === 0) {
      setErrors({ items: 'Please add at least one item' })
      setCurrentStep(2)
      return
    }

    // Validate all items
    const invalidItems = items.some((item) => {
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
      const validationItems = items.map((item) => ({
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
        const updatedItems = items.map((item, index) => {
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
        setItems(updatedItems)

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
        setToast({ message: errorMessage.trim(), type: 'error' })

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
        customer_id: selectedCustomer.id,
        items: items.map((item) => ({
          ...item,
          line_total: item.quantity * item.unit_price,
        })),
      }

      const invoice = await createInvoice(
        orgId,
        userId,
        invoiceData,
        org,
        selectedCustomer
      )

      // Clear draft session ID on finalize
      if (currentDraftInvoiceId) {
        clearDraftSessionId(currentDraftInvoiceId)
      } else {
        clearDraftSessionId()
      }
      draftSessionId.current = null

      await onSubmit(invoice.id)
      onClose()
    } catch (error) {
      console.error('Error creating invoice:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create invoice',
      })
      setToast({
        message: error instanceof Error ? error.message : 'Failed to create invoice',
        type: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceedToStep2 = selectedCustomer !== null
  const canProceedToStep3 = items.length > 0 && items.every((item) => item.product_id && item.quantity > 0 && item.unit_price > 0)

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
              onClick={async () => {
                setDraftLoadError(null)
                setIsRetrying(false)
                draftLoadRetries.current = 0
                await loadDraftWithRetry(draftInvoiceId!)
              }}
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
                setDraftLoadError(null)
                setInternalDraftInvoiceId(null)
                setCurrentStep(1)
                setIdentifier('')
                setIdentifierValid(false)
                setSelectedCustomer(null)
                setItems([])
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
          searchValue={identifier}
          onSearchChange={setIdentifier}
          isSearching={searching}
          searchError={errors.identifier}
          selectedCustomer={selectedCustomer}
          onCustomerSelected={(customer) => {
            setSelectedCustomer(customer)
            if (customer) {
              setCurrentStep(2)
            }
          }}
          isAddNewFormOpen={showAddNewForm}
          newCustomerData={inlineFormData}
          formErrors={{
            name: errors.name,
            mobile: errors.mobile,
            gstin: errors.gstin,
          }}
          onOpenAddNewForm={() => {
            if (identifier.trim().length >= 3) {
              setShowAddNewForm(true)
            }
          }}
          onCloseAddNewForm={() => {
            setShowAddNewForm(false)
            setInlineFormData({ name: '', mobile: '', gstin: '' })
            setErrors({})
          }}
          onFormDataChange={setInlineFormData}
          onSubmitNewCustomer={handleCreateOrgCustomer}
          onContinue={() => setCurrentStep(2)}
          orgId={orgId}
          isDisabled={isSubmitting}
          autoFocus={isOpen && currentStep === 1}
        />
      )}

      {/* Step 2: Add Products */}
      {currentStep === 2 && (
        <InvoiceItemsStep
          items={items}
          products={products}
          loadingProducts={loadingProducts}
          itemsError={errors.items}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onProductSelect={handleProductSelect}
          onProductChange={handleProductChange}
          onItemFieldChange={handleItemChange}
          serialInputs={serialInputs}
          onSerialInputChange={(index, value) => {
            setSerialInputs({ ...serialInputs, [index]: value })
          }}
          onAddSerial={handleAddSerial}
          onRemoveSerial={handleRemoveSerial}
          onScanClick={handleScanClick}
          orgId={orgId}
          isDisabled={isSubmitting}
        />
      )}

      {/* Step 3: Review */}
      {currentStep === 3 && (
        <InvoiceReviewStep
          customer={selectedCustomer}
          items={items}
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
              onClick={() => {
                if (currentStep === 1 && canProceedToStep2) {
                  setCurrentStep(2)
                } else if (currentStep === 2 && canProceedToStep3) {
                  setCurrentStep(3)
                }
              }}
              disabled={
                isSubmitting ||
                (currentStep === 1 && !canProceedToStep2) ||
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
                  items.some(item =>
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
  const headerAction = selectedCustomer ? (
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
        isOpen={scannerMode === 'scanning' || scannerMode === 'confirming'}
        onClose={() => {
          setScannerMode('closed')
          setShowConfirmSheet(false)
          setPendingProduct(null)
        }}
        onScanSuccess={handleScanFromCamera}
        continuousMode={true}
      />

      {/* Backdrop - z-index 9999, dims content but NOT scanner */}
      {scannerMode === 'confirming' && (
        <div
          className="fixed inset-0 bg-black/40"
          style={{ zIndex: 9999 }}
          onClick={handleCancelConfirm}
          aria-hidden="true"
        />
      )}

      {/* Product Confirmation Sheet - z-index 10000, solid white */}
      <ProductConfirmSheet
        isOpen={showConfirmSheet}
        product={pendingProduct}
        onConfirm={handleConfirmProduct}
        onCancel={handleCancelConfirm}
        defaultQuantity={pendingQuantity}
        scannerMode={scannerMode}
      />
    </>
  )
}

