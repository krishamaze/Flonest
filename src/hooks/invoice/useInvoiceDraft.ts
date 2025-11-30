import { useState } from 'react'
import type { CustomerWithMaster, InvoiceItemFormData, Org } from '../../types'

interface UseInvoiceDraftParams {
  // Form snapshot
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

export function useInvoiceDraft(params: UseInvoiceDraftParams): UseInvoiceDraftReturn {
  // Real state - moved from InvoiceForm
  const [draftInvoiceId, setDraftInvoiceId] = useState<string | null>(
    params.initialDraftInvoiceId || null
  )
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  
  // Temporary - suppress unused variable warnings
  console.log('Draft state:', { draftInvoiceId, loadingDraft, draftLoadError, isRetrying, saveStatus })
  console.log('Draft setters:', { setDraftInvoiceId, setLoadingDraft, setDraftLoadError, setIsRetrying, setSaveStatus })
  console.log('Params:', params.customerId, params.items.length)
  
  // Placeholder functions - will be implemented in next steps
  const handleManualSaveDraft = () => {
    console.log('Manual save draft - placeholder')
  }
  
  const clearDraftSession = () => {
    console.log('Clear draft session - placeholder')
  }
  
  const retryLoadDraft = () => {
    console.log('Retry load draft - placeholder')
  }
  
  return {
    draftInvoiceId,
    loadingDraft,
    draftLoadError,
    saveStatus,
    isRetrying,
    handleManualSaveDraft,
    clearDraftSession,
    retryLoadDraft,
  }
}
