import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { supabase } from '../lib/supabase'
import type { Invoice, Org } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { InvoiceForm } from '../components/forms/InvoiceForm'
import { SwipeableDraftItem } from '../components/ui/SwipeableDraftItem'
import {
  PlusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { getInvoicesByOrg, revalidateDraftInvoice, deleteDraft } from '../lib/api/invoices'
import { useToastDedupe } from '../hooks/useToastDedupe'

export function InventoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false)
  const [org, setOrg] = useState<Org | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'draft' | 'finalized'>('all')
  
  // Toast deduplication hook
  const { showToast } = useToastDedupe()

  const loadOrg = useCallback(async () => {
    if (!user || !user.orgId) return

    try {
      const { data, error } = await supabase
        .from('orgs')
        .select('*')
        .eq('id', user.orgId)
        .single()

      if (error) throw error
      setOrg(data)
    } catch (error) {
      console.error('Error loading org:', error)
    }
  }, [user])

  const loadInvoices = useCallback(async () => {
    if (!user || !user.orgId) return

    try {
      const data = await getInvoicesByOrg(user.orgId)
      setInvoices(data)
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadOrg()
    loadInvoices()
  }, [loadOrg, loadInvoices])

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    const refreshHandler = async () => {
      await Promise.all([
        loadOrg(),
        loadInvoices()
      ])
    }
    registerRefreshHandler(refreshHandler)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, loadOrg, loadInvoices])

  // Memoize status calculations to avoid recalculating on every render
  const invoiceStats = useMemo(() => {
    const finalizedDrafts = invoices.filter(
      (inv: any) => inv.status === 'finalized' && (inv as any).draft_data !== null
    ).length
    
    return {
      finalized: invoices.filter((inv) => inv.status === 'finalized').length,
      drafts: invoices.filter((inv) => inv.status === 'draft').length,
      finalizedDrafts,
      total: invoices.length
    }
  }, [invoices])

  // Filter invoices based on selected filter
  const filteredInvoices = useMemo(() => {
    if (filter === 'all') return invoices
    if (filter === 'draft') return invoices.filter(inv => inv.status === 'draft')
    if (filter === 'finalized') return invoices.filter(inv => inv.status === 'finalized')
    return invoices
  }, [invoices, filter])

  const handleDraftClick = async (invoiceId: string) => {
    if (!user || !user.orgId) return
    
    try {
      // Re-validate draft before opening
      const revalidation = await revalidateDraftInvoice(invoiceId, user.orgId)
      if (revalidation.updated) {
        // Show toast if items are now valid
        // Toast will be shown in InvoiceForm when it loads
      }
      
      // Open form with draft
      setSelectedDraftId(invoiceId)
      setIsInvoiceFormOpen(true)
      
      // Reload invoices to reflect any status changes
      await loadInvoices()
    } catch (error) {
      console.error('Error opening draft:', error)
      // Still open the form even if revalidation fails
      setSelectedDraftId(invoiceId)
      setIsInvoiceFormOpen(true)
    }
  }

  const handleDeleteDraft = async (invoiceId: string) => {
    if (!user || !user.orgId) return

    try {
      await deleteDraft(invoiceId, user.orgId)
      showToast('success', 'Draft deleted successfully', { autoClose: 3000 })
      // Reload invoices to reflect deletion
      await loadInvoices()
    } catch (error) {
      console.error('Error deleting draft:', error)
      showToast('error', error instanceof Error ? error.message : 'Failed to delete draft', { autoClose: 5000 })
    }
  }

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-neutral-50 border-neutral-200 text-secondary-text'
    switch (status) {
      case 'finalized':
        return 'bg-success-light border-success text-success-dark'
      case 'draft':
        return 'bg-warning-light border-warning text-warning-dark'
      case 'cancelled':
        return 'bg-error-light border-error text-error-dark'
      default:
        return 'bg-neutral-50 border-neutral-200 text-secondary-text'
    }
  }

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {/* Invoices Section */}
      <div>
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-primary-text">Invoices</h1>
          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setIsInvoiceFormOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">New Invoice</span>
          </Button>
        </div>

      {/* Invoice Stats Cards - interactive filter cards */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Card 
          className={`shadow-xs rounded-md flex-shrink-0 cursor-pointer transition-all ${
            filter === 'finalized'
              ? 'bg-primary border-2 border-primary shadow-md scale-105'
              : 'bg-success-light border-success border hover:shadow-md hover:border-success-dark'
          }`}
          style={{ minWidth: '120px', maxWidth: '140px' }}
          onClick={() => setFilter('finalized')}
        >
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DocumentTextIcon className={`h-3 w-3 ${filter === 'finalized' ? 'text-text-on-primary' : 'text-success'}`} />
            <p className={`text-[9px] font-medium leading-tight text-center ${filter === 'finalized' ? 'text-text-on-primary' : 'text-secondary-text'}`}>
              Finalized
            </p>
            <p className={`text-sm font-semibold ${filter === 'finalized' ? 'text-text-on-primary' : 'text-primary-text'}`}>
              {invoiceStats.finalized}
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-xs rounded-md flex-shrink-0 cursor-pointer transition-all ${
            filter === 'draft'
              ? 'bg-primary border-2 border-primary shadow-md scale-105'
              : 'bg-warning-light border-warning border hover:shadow-md hover:border-warning-dark'
          }`}
          style={{ minWidth: '120px', maxWidth: '140px' }}
          onClick={() => setFilter('draft')}
        >
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DocumentTextIcon className={`h-3 w-3 ${filter === 'draft' ? 'text-text-on-primary' : 'text-warning'}`} />
            <p className={`text-[9px] font-medium leading-tight text-center ${filter === 'draft' ? 'text-text-on-primary' : 'text-secondary-text'}`}>
              Drafts
            </p>
            <p className={`text-sm font-semibold ${filter === 'draft' ? 'text-text-on-primary' : 'text-primary-text'}`}>
              {invoiceStats.drafts}
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-xs rounded-md flex-shrink-0 cursor-pointer transition-all ${
            filter === 'all'
              ? 'bg-primary border-2 border-primary shadow-md scale-105'
              : 'bg-neutral-50 border-neutral-200 border hover:shadow-md hover:border-neutral-300'
          }`}
          style={{ minWidth: '120px', maxWidth: '140px' }}
          onClick={() => setFilter('all')}
        >
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DocumentTextIcon className={`h-3 w-3 ${filter === 'all' ? 'text-text-on-primary' : 'text-secondary-text'}`} />
            <p className={`text-[9px] font-medium leading-tight text-center ${filter === 'all' ? 'text-text-on-primary' : 'text-secondary-text'}`}>
              Total
            </p>
            <p className={`text-sm font-semibold ${filter === 'all' ? 'text-text-on-primary' : 'text-primary-text'}`}>
              {invoiceStats.total}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-primary-text mb-sm">No invoices yet</p>
            <p className="text-sm text-secondary-text mb-md">
              Create your first invoice to get started with billing and invoicing.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInvoiceFormOpen(true)}
              className="min-h-[44px]"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create First Invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Invoice List */}
          {filteredInvoices.map((invoice) => {
            const isDraft = invoice.status === 'draft'
            
            // Use SwipeableDraftItem for drafts (swipe to delete)
            if (isDraft) {
              return (
                <SwipeableDraftItem
                  key={invoice.id}
                  invoice={invoice}
                  onDelete={handleDeleteDraft}
                  onClick={() => handleDraftClick(invoice.id)}
                  getStatusColor={getStatusColor}
                  formatDate={formatDate}
                />
              )
            }
            
            // Use regular Card for finalized invoices (clickable to view details)
            return (
              <Card
                key={invoice.id}
                className={`border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(invoice.status)}`}
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-xs">
                        <h3 className="text-base font-medium text-primary-text">
                          Invoice #{invoice.invoice_number}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-text mt-xs">
                        {formatDate(invoice.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-semibold text-primary-text">
                        ₹{((invoice.total_amount ?? 0) as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize mt-1 ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </div>

      {/* Invoice Form */}
      {user && org && (
        <InvoiceForm
          isOpen={isInvoiceFormOpen}
          onClose={() => {
            setIsInvoiceFormOpen(false)
            setSelectedDraftId(null)
          }}
          onSubmit={async () => {
            await loadInvoices()
            setSelectedDraftId(null)
            // Optionally navigate to invoice view
          }}
          orgId={user.orgId!}
          userId={user.id}
          org={org}
          draftInvoiceId={selectedDraftId || undefined}
        />
      )}
    </div>
  )
}

