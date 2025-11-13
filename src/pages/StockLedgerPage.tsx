import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import type { StockLedger, Product } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { StockTransactionForm } from '../components/forms/StockTransactionForm'
import {
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { getStockLedgerWithProducts, createStockTransaction } from '../lib/api/stockLedger'

export function StockLedgerPage() {
  const { user } = useAuth()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [stockLedger, setStockLedger] = useState<(StockLedger & { product: Product })[]>([])
  const [loadingLedger, setLoadingLedger] = useState(true)
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out' | 'adjustment'>('all')

  const loadStockLedger = useCallback(async () => {
    if (!user || !user.orgId) return

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
    loadStockLedger()
  }, [loadStockLedger])

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    registerRefreshHandler(loadStockLedger)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, loadStockLedger])

  const handleCreateTransaction = async (data: any) => {
    if (!user || !user.orgId) return
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
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
      <div className="flex gap-2">
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

      {/* Stock Transaction Form */}
      {user && (
        <StockTransactionForm
          isOpen={isTransactionFormOpen}
          onClose={() => setIsTransactionFormOpen(false)}
          onSubmit={handleCreateTransaction}
          orgId={user.orgId!}
        />
      )}
    </div>
  )
}

