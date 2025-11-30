import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAutoSave } from '../useAutoSave'
import { useToastDedupe } from '../useToastDedupe'
import { 
  loadDraftInvoiceData, 
  getInvoiceById, 
  revalidateDraftInvoice, 
  autoSaveInvoiceDraft, 
  clearDraftSessionId 
} from '../../lib/api/invoices'
import { getAllProducts } from '../../lib/api/products'
import { getDraftSessionId, setDraftSessionId } from '../../lib/utils/draftSession'
import type { CustomerWithMaster, InvoiceItemFormData, Org, ProductWithMaster } from '../../types'

interface UseInvoiceDraftParams {
  // Form snapshot for autosave
  customerId: string | null
  items: InvoiceItemFormData[]
  orgId: string
  userId: string
  org: Org
  
  // Container signals
  isOpen: boolean
  initialDraftInvoiceId?: string
  mode: 'modal' | 'page'
  
  // Callbacks
  onDraftRestored: (data: { customer: CustomerWithMaster; items: InvoiceItemFormData[] }) => void
  onReset: () => void
}

interface UseInvoiceDraftReturn {
  // State
  draftInvoiceId: string | null
  loadingDraft: boolean
  draftLoadError: string | null
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  isRetrying: boolean
  
  // Actions
  handleManualSaveDraft: () => Promise<void>
  clearDraftSession: () => void
  retryLoadDraft: () => void
  resetDraftState: () => void
}

/**
 * Draft management hook
 * 
 * Owns:
 * - Draft loading with retry logic
 * - Autosave timer and session ID management  
 * - Draft revalidation
 * - Draft session cleanup
 */
export function useInvoiceDraft({
  customerId,
  items,
  orgId,
  userId,
  org: _org,
  isOpen,
  initialDraftInvoiceId,
  mode: _mode,
  onDraftRestored,
  onReset: _onReset
}: UseInvoiceDraftParams): UseInvoiceDraftReturn {
  const { showToast } = useToastDedupe()
  
  // State
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [internalDraftInvoiceId, setInternalDraftInvoiceId] = useState<string | null>(null)
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number | null>(null)
  
  // Refs
  const draftLoadRetries = useRef(0)
  const draftSessionId = useRef<string | null>(null)
  const MAX_RETRIES = 1

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
        let customer: CustomerWithMaster | null = null
        if (draftInvoice.customer) {
          customer = draftInvoice.customer as any
        }

        // Load products and restore items
        const allProducts = await getAllProducts(orgId, { status: 'active' })
        const restoredItems: InvoiceItemFormData[] = draftData.items.map((draftItem: any) => {
          const product = (allProducts as ProductWithMaster[]).find((p) => p.id === draftItem.product_id)
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

        setInternalDraftInvoiceId(invoiceId)
        
        // Notify container
        if (customer) {
          onDraftRestored({ customer, items: restoredItems })
        }

        // Reset retry counter on success
        draftLoadRetries.current = 0
        setIsRetrying(false)

        // Re-validate draft
        try {
          const revalidation = await revalidateDraftInvoice(invoiceId, orgId)
          if (revalidation.updated) {
            showToast('success', 'Draft revalidated — missing items are now available.', { autoClose: 3000 })
            if (revalidation.valid && customer) {
              const cleanedItems = restoredItems.map(item => ({
                ...item,
                invalid_serials: [],
                validation_errors: [],
              }))
              // Update items again with cleaned version
              onDraftRestored({ customer, items: cleanedItems })
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
      }
    } finally {
      setLoadingDraft(false)
    }
  }, [orgId, showToast, onDraftRestored])

  // Load draft on mount if initialDraftInvoiceId prop is provided
  useEffect(() => {
    if (isOpen && initialDraftInvoiceId) {
      // Reset retry counter when opening draft
      draftLoadRetries.current = 0
      setDraftLoadError(null)
      setIsRetrying(false)

      // Load draft with retry
      loadDraftWithRetry(initialDraftInvoiceId)
    }
  }, [isOpen, initialDraftInvoiceId, loadDraftWithRetry])

  // Initialize draft session ID when form opens
  useEffect(() => {
    if (isOpen) {
      if (initialDraftInvoiceId) {
        // For existing drafts, get session ID from sessionStorage or create new one
        draftSessionId.current = getDraftSessionId(initialDraftInvoiceId)
      } else {
        // For new drafts, create new session ID
        draftSessionId.current = getDraftSessionId()
      }
    }
  }, [isOpen, initialDraftInvoiceId])

  // Reset internal state when closed
  useEffect(() => {
    if (!isOpen && !loadingDraft) {
      setInternalDraftInvoiceId(null)
      setDraftLoadError(null)
      setIsRetrying(false)
      // Note: We don't call onReset() here because the container handles its own reset
    }
  }, [isOpen, loadingDraft])

  // Auto-save draft
  const draftData = useMemo(() => ({
    customer_id: customerId || undefined,
    items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      serials: item.serials,
    })),
  }), [customerId, items])

  const { saveStatus, manualSave } = useAutoSave(
    draftData,
    async (data) => {
      if (!customerId || !draftSessionId.current) return
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
      enabled: customerId !== null && draftSessionId.current !== null
    }
  )

  const handleManualSaveDraft = async () => {
    if (!customerId) return
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

  const clearDraftSession = () => {
    if (internalDraftInvoiceId) {
      clearDraftSessionId(internalDraftInvoiceId)
    }
  }

  const retryLoadDraft = () => {
    if (initialDraftInvoiceId) {
      loadDraftWithRetry(initialDraftInvoiceId)
    } else if (internalDraftInvoiceId) {
      loadDraftWithRetry(internalDraftInvoiceId)
    }
  }

  const resetDraftState = () => {
    setInternalDraftInvoiceId(null)
    setDraftLoadError(null)
    setIsRetrying(false)
    draftLoadRetries.current = 0
  }

  return {
    draftInvoiceId: internalDraftInvoiceId,
    loadingDraft,
    draftLoadError,
    saveStatus,
    isRetrying,
    handleManualSaveDraft,
    clearDraftSession,
    retryLoadDraft,
    resetDraftState,
  }
}
