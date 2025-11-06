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
        return <ArrowDownTrayIcon className="h-4 w-4 text-green-600" />
      case 'out':
        return <ArrowUpTrayIcon className="h-4 w-4 text-red-600" />
      case 'adjustment':
        return <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'in':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'out':
        return 'bg-red-50 border-red-200 text-red-700'
      case 'adjustment':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
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
    if (!status) return 'bg-gray-50 border-gray-200 text-gray-700'
    switch (status) {
      case 'finalized':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'draft':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700'
      case 'cancelled':
        return 'bg-red-50 border-red-200 text-red-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
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
          <h1 className="text-xl font-semibold text-gray-900">Stock Ledger</h1>
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('in')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'in'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Stock In
          </button>
          <button
            onClick={() => setFilterType('out')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'out'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Stock Out
          </button>
          <button
            onClick={() => setFilterType('adjustment')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'adjustment'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
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
              <p className="text-sm text-gray-600">
                {filterType === 'all'
                  ? 'No stock transactions yet. Create your first transaction to get started.'
                  : `No ${filterType} transactions found.`}
              </p>
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
                        <h3 className="text-base font-medium text-gray-900">
                          {entry.product?.name || 'Unknown Product'}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        SKU: {entry.product?.sku || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(entry.created_at)}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-gray-900">
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
          <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
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
        <Card className="bg-green-50 border-green-200 shadow-sm">
          <CardContent className="p-4 text-center">
            {/* Card icon: 20px max */}
            <DocumentTextIcon className="mx-auto h-5 w-5 text-green-600 mb-2" />
            <p className="text-xs font-medium text-gray-600">Finalized</p>
            <p className="text-xl font-semibold text-gray-900">
              {invoiceStats.finalized}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <DocumentTextIcon className="mx-auto h-5 w-5 text-yellow-600 mb-2" />
            <p className="text-xs font-medium text-gray-600">Drafts</p>
            <p className="text-xl font-semibold text-gray-900">
              {invoiceStats.drafts}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <DocumentTextIcon className="mx-auto h-5 w-5 text-blue-600 mb-2" />
            <p className="text-xs font-medium text-gray-600">Total</p>
            <p className="text-xl font-semibold text-gray-900">
              {invoiceStats.total}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-600">
              No invoices yet. Create your first invoice to get started.
            </p>
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
                    <h3 className="text-base font-medium text-gray-900">
                      Invoice #{invoice.invoice_number}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(invoice.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-gray-900">
                      ₹{invoice.total_amount.toFixed(2)}
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
          onSubmit={async (invoiceId) => {
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

