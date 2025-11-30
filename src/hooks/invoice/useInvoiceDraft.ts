import type { CustomerWithMaster, InvoiceItemFormData, Org } from '../../types'

// TODO: Move draft + autosave logic into useInvoiceDraft
// This hook is currently a stub. The actual draft loading, retry logic, autosave,
// and session management still live in InvoiceForm.tsx. Next steps:
// 1) Copy ALL draft-related logic (state, refs, effects, helpers) into this hook
// 2) Wire InvoiceForm to call the hook and verify parity
// 3) Delete the original logic from InvoiceForm once behavior is confirmed identical

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
  saveStatus: 'idle' | 'saving' | 'saved'
  isRetrying: boolean
  
  // Actions
  handleManualSaveDraft: () => void
  clearDraftSession: () => void
  retryLoadDraft: () => void
}

/**
 * STUB: Draft management hook (not yet implemented)
 * 
 * This hook WILL eventually own:
 * - Draft loading with retry logic
 * - Autosave timer and session ID management  
 * - Draft revalidation
 * - Draft session cleanup
 * 
 * Currently, all this logic still lives in InvoiceForm.tsx.
 * DO NOT depend on this hook for correctness yet.
 */
export function useInvoiceDraft(_params: UseInvoiceDraftParams): UseInvoiceDraftReturn {
  // Stub implementation - returns safe defaults
  // Real implementation will be migrated from InvoiceForm in a future refactor
  
  return {
    draftInvoiceId: null,
    loadingDraft: false,
    draftLoadError: null,
    saveStatus: 'idle',
    isRetrying: false,
    handleManualSaveDraft: () => {
      console.warn('useInvoiceDraft: handleManualSaveDraft called on stub - no-op')
    },
    clearDraftSession: () => {
      console.warn('useInvoiceDraft: clearDraftSession called on stub - no-op')
    },
    retryLoadDraft: () => {
      console.warn('useInvoiceDraft: retryLoadDraft called on stub - no-op')
    },
  }
}
