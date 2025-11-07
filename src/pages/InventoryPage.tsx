import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Invoice, StockLedger, Product, Org } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { StockTransactionForm } from '../components/forms/StockTransactionForm'
import { InvoiceForm } from '../components/forms/InvoiceForm'
import {
  PlusIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { getStockLedgerWithProducts, createStockTransaction } from '../lib/api/stockLedger'
import { getInvoicesByOrg } from '../lib/api/invoices'

export function InventoryPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stockLedger, setStockLedger] = useState<(StockLedger & { product: Product })[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLedger, setLoadingLedger] = useState(true)
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false)
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false)
  const [org, setOrg] = useState<Org | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out' | 'adjustment'>('all')

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

  const loadStockLedger = useCallback(async () => {
    if (!user) return

    try {
      const data = await getStockLedgerWithProducts(user.orgId)
      setStockLedger(data)
    } catch (error) {
      console.error('Error loading stock ledger:', error)
    } finally {
      setLoadingLedger(false)
    }
  }, [user])

  useEffect(() => {
    loadOrg()
    loadInvoices()
    loadStockLedger()
  }, [loadOrg, loadInvoices, loadStockLedger])

  const handleCreateTransaction = async (data: any) => {
    if (!user) return
    await createStockTransaction(user.orgId, user.id, data)
    await loadStockLedger()
  }

  const filteredLedger = useMemo(() => {
    if (filterType === 'all') return stockLedger
    return stockLedger.filter((entry) => entry.transaction_type === filterType)
  }, [stockLedger, filterType])

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowDownTrayIcon className="h-4 w-4 text-success" />
      case 'out':
        return <ArrowUpTrayIcon className="h-4 w-4 text-error" />
      case 'adjustment':
        return <AdjustmentsHorizontalIcon className="h-4 w-4 text-warning" />
      default:
        return null
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'in':
        return 'bg-success-light border-success text-success-dark'
      case 'out':
        return 'bg-error-light border-error text-error-dark'
      case 'adjustment':
        return 'bg-warning-light border-warning text-warning-dark'
      default:
        return 'bg-neutral-50 border-neutral-200 text-secondary-text'
    }
  }

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
      {/* Stock Ledger Section */}
      <div>
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-primary-text">Stock Ledger</h1>
          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setIsTransactionFormOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">New Transaction</span>
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterType('all')}
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${
              filterType === 'all'
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
            }`}
            aria-label="Show all transactions"
            aria-pressed={filterType === 'all'}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('in')}
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${
              filterType === 'in'
                ? 'bg-success text-on-dark font-semibold'
                : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
            }`}
            aria-label="Show stock in transactions"
            aria-pressed={filterType === 'in'}
          >
            Stock In
          </button>
          <button
            onClick={() => setFilterType('out')}
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${
              filterType === 'out'
                ? 'bg-error text-on-dark font-semibold'
                : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
            }`}
            aria-label="Show stock out transactions"
            aria-pressed={filterType === 'out'}
          >
            Stock Out
          </button>
          <button
            onClick={() => setFilterType('adjustment')}
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${
              filterType === 'adjustment'
                ? 'bg-warning text-on-dark font-semibold'
                : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
            }`}
            aria-label="Show adjustment transactions"
            aria-pressed={filterType === 'adjustment'}
          >
            Adjustment
          </button>
        </div>

        {/* Stock Ledger List */}
        {loadingLedger ? (
          <div className="flex h-32 items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredLedger.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-primary-text mb-sm">
                {filterType === 'all' ? 'No stock transactions yet' : `No ${filterType} transactions found`}
              </p>
              <p className="text-sm text-secondary-text mb-md">
                {filterType === 'all'
                  ? 'Create your first transaction to get started with stock management.'
                  : 'Try selecting a different filter or create a new transaction.'}
              </p>
              {filterType === 'all' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsTransactionFormOpen(true)}
                  className="min-h-[44px]"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create First Transaction
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLedger.map((entry) => (
              <Card
                key={entry.id}
                className={`border shadow-sm ${getTransactionColor(entry.transaction_type)}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(entry.transaction_type)}
                        <h3 className="text-base font-medium text-primary-text">
                          {entry.product?.name || 'Unknown Product'}
                        </h3>
                      </div>
                      <p className="text-xs text-secondary-text mt-xs">
                        SKU: {entry.product?.sku || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-text mt-xs">
                        {formatDate(entry.created_at)}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-secondary-text mt-sm line-clamp-2">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-primary-text">
                        {entry.transaction_type === 'in' ? '+' : entry.transaction_type === 'out' ? '-' : '±'}
                        {entry.quantity}
                      </p>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize mt-1">
                        {entry.transaction_type}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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

      {/* Invoice Stats Cards - 12px gap, 16px padding */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-success-light border-success shadow-sm">
          <CardContent className="p-md text-center">
            {/* Card icon: 20px max */}
            <DocumentTextIcon className="mx-auto h-5 w-5 text-success mb-sm" />
            <p className="text-xs font-medium text-secondary-text">Finalized</p>
            <p className="text-xl font-semibold text-primary-text">
              {invoiceStats.finalized}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-warning-light border-warning shadow-sm">
          <CardContent className="p-md text-center">
            <DocumentTextIcon className="mx-auto h-5 w-5 text-warning mb-sm" />
            <p className="text-xs font-medium text-secondary-text">Drafts</p>
            <p className="text-xl font-semibold text-primary-text">
              {invoiceStats.drafts}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-50 border-neutral-200 shadow-sm">
          <CardContent className="p-md text-center">
            <DocumentTextIcon className="mx-auto h-5 w-5 text-secondary-text mb-sm" />
            <p className="text-xs font-medium text-secondary-text">Total</p>
            <p className="text-xl font-semibold text-primary-text">
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

      {/* Stock Transaction Form */}
      {user && (
        <StockTransactionForm
          isOpen={isTransactionFormOpen}
          onClose={() => setIsTransactionFormOpen(false)}
          onSubmit={handleCreateTransaction}
          orgId={user.orgId}
        />
      )}

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
          orgState={org.state}
          orgGstEnabled={org.gst_enabled || false}
        />
      )}
    </div>
  )
}

