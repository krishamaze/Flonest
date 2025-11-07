import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Invoice, Org } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { InvoiceForm } from '../components/forms/InvoiceForm'
import {
  PlusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { getInvoicesByOrg } from '../lib/api/invoices'

export function InventoryPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false)
  const [org, setOrg] = useState<Org | null>(null)

  const loadOrg = useCallback(async () => {
    if (!user) return

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
    if (!user) return

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

  // Memoize status calculations to avoid recalculating on every render
  const invoiceStats = useMemo(() => {
    return {
      finalized: invoices.filter((inv) => inv.status === 'finalized').length,
      drafts: invoices.filter((inv) => inv.status === 'draft').length,
      total: invoices.length
    }
  }, [invoices])

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

  const formatDate = (dateString: string | null) => {
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
    <div className="space-y-6">
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

      {/* Invoice Stats Cards - compact horizontal layout */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Card className="bg-success-light border-success shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DocumentTextIcon className="h-3 w-3 text-success" />
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Finalized</p>
            <p className="text-sm font-semibold text-primary-text">
              {invoiceStats.finalized}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-warning-light border-warning shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DocumentTextIcon className="h-3 w-3 text-warning" />
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Drafts</p>
            <p className="text-sm font-semibold text-primary-text">
              {invoiceStats.drafts}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-50 border-neutral-200 shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DocumentTextIcon className="h-3 w-3 text-secondary-text" />
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Total</p>
            <p className="text-sm font-semibold text-primary-text">
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
          {invoices.map((invoice) => (
            <Card
              key={invoice.id}
              className={`border shadow-sm ${getStatusColor(invoice.status)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-primary-text">
                      Invoice #{invoice.invoice_number}
                    </h3>
                    <p className="text-xs text-muted-text mt-xs">
                      {formatDate(invoice.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-primary-text">
                      ₹{invoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize mt-1 ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Invoice Form */}
      {user && org && (
        <InvoiceForm
          isOpen={isInvoiceFormOpen}
          onClose={() => setIsInvoiceFormOpen(false)}
          onSubmit={async () => {
            await loadInvoices()
            // Optionally navigate to invoice view
          }}
          orgId={user.orgId}
          userId={user.id}
          org={org}
        />
      )}
    </div>
  )
}

