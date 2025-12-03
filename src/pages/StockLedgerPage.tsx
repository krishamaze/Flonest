import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import type { StockLedger, Product } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { StockAdjustmentModal } from '../components/stock/StockAdjustmentModal'
import { FocusPageLayout } from '../components/layout/FocusPageLayout'
import {
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { getStockLedgerWithProducts, createStockTransaction, adjustStockLevel } from '../lib/api/stockLedger'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { StockLedgerFormData } from '../types'

export function StockLedgerPage() {
  const { user } = useAuth()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out' | 'adjustment'>('all')
  const queryClient = useQueryClient()
  const stockLedgerQueryKey = useMemo(
    () => ['stock-ledger', user?.orgId] as const,
    [user?.orgId]
  )

  const {
    data: stockLedger = [],
    isLoading: loadingLedger,
  } = useQuery<(StockLedger & { product: Product })[]>({
    queryKey: stockLedgerQueryKey,
    enabled: !!user?.orgId,
    queryFn: async () => {
      if (!user?.orgId) {
        return []
      }
      return await getStockLedgerWithProducts(user.orgId)
    },
    staleTime: 30_000,
  })

  const _createTransactionMutation = useMutation({
    mutationFn: async ({ formData }: { formData: StockLedgerFormData; product?: Product }) => {
      if (!user?.orgId || !user?.id) {
        throw new Error('User not authenticated')
      }
      return await createStockTransaction(user.orgId, user.id, formData)
    },
    onMutate: async ({ formData, product }: { formData: StockLedgerFormData; product?: Product }) => {
      if (!user?.orgId) {
        return { previousEntries: undefined as (StockLedger & { product: Product })[] | undefined }
      }
      await queryClient.cancelQueries({ queryKey: stockLedgerQueryKey })
      const previousEntries =
        queryClient.getQueryData<(StockLedger & { product: Product })[]>(stockLedgerQueryKey) || []

      const existingProduct =
        product ||
        previousEntries.find(entry => entry.product_id === formData.product_id)?.product ||
        buildPlaceholderProduct(user.orgId, formData.product_id)

      const optimisticEntry: StockLedger & { product: Product } = {
        id: `temp-ledger-${Date.now()}`,
        org_id: user.orgId,
        product_id: formData.product_id,
        transaction_type: formData.transaction_type,
        quantity: formData.quantity,
        notes: formData.notes || null,
        created_at: new Date().toISOString(),
        created_by: user.id,
        cost_provisional: false,
        product: existingProduct,
      }

      queryClient.setQueryData<(StockLedger & { product: Product })[]>(stockLedgerQueryKey, [
        optimisticEntry,
        ...previousEntries,
      ])

      return { previousEntries, optimisticId: optimisticEntry.id }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(stockLedgerQueryKey, context.previousEntries)
      }
    },
    onSuccess: (newEntry, variables, context) => {
      queryClient.setQueryData<(StockLedger & { product: Product })[]>(
        stockLedgerQueryKey,
        currentEntries => {
          const normalizedEntries = currentEntries || []
          const resolvedProduct =
            newEntry.product ||
            variables?.product ||
            normalizedEntries.find(entry => entry.product_id === newEntry.product_id)?.product ||
            (user?.orgId ? buildPlaceholderProduct(user.orgId, newEntry.product_id) : undefined)

          if (!resolvedProduct) {
            return normalizedEntries
          }

          const entryWithProduct: StockLedger & { product: Product } = {
            ...(newEntry as StockLedger),
            product: resolvedProduct,
          }

          return [
            entryWithProduct,
            ...normalizedEntries.filter(entry => entry.id !== context?.optimisticId),
          ]
        }
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: stockLedgerQueryKey })
    },
  })

  const loadLatestLedger = useCallback(async () => {
    if (!user?.orgId) return
    await queryClient.invalidateQueries({ queryKey: stockLedgerQueryKey })
  }, [queryClient, stockLedgerQueryKey, user?.orgId])

  useEffect(() => {
    registerRefreshHandler(loadLatestLedger)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, loadLatestLedger])



  // Wrapper to handle stock adjustments (calls adjust_stock_level RPC)
  const handleAdjustment = async (data: { product_id: string; quantity: number; notes?: string }) => {
    if (!user?.orgId) return
    await adjustStockLevel(user.orgId, data.product_id, data.quantity, data.notes || '')
    await loadLatestLedger()
  }

  // Unified handler for StockAdjustmentModal (always uses signed delta)
  const handleStockSubmit = async (data: { product_id: string; quantity: number; notes?: string }) => {
    await handleAdjustment(data)
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
    <FocusPageLayout title="Stock Ledger" backTo="/inventory">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-md">
        {/* Page Header */}
        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setIsStockModalOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Adjust Stock</span>
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${filterType === 'all'
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
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${filterType === 'in'
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
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${filterType === 'out'
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
            className={`px-md py-sm min-h-[44px] rounded-md text-sm font-medium transition-colors duration-200 ${filterType === 'adjustment'
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
                  onClick={() => setIsStockModalOpen(true)}
                  className="min-h-[44px]"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Adjust Stock
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

        {/* Stock Adjustment Modal */}
        {user && (
          <StockAdjustmentModal
            isOpen={isStockModalOpen}
            onClose={() => setIsStockModalOpen(false)}
            onSubmit={handleStockSubmit}
            orgId={user.orgId!}
            title="Adjust Stock"
          />
        )}
      </div>
    </FocusPageLayout>
  )
}

function buildPlaceholderProduct(orgId: string, productId: string): Product {
  const timestamp = new Date().toISOString()
  return {
    id: productId,
    org_id: orgId,
    name: 'Updating stock...',
    sku: '',
    ean: null,
    description: null,
    category: null,
    category_id: null,
    branch_id: null,
    unit: 'pcs',
    cost_price: null,
    selling_price: null,
    min_stock_level: 0,
    tax_rate: null,
    hsn_sac_code: null,
    master_product_id: null,
    serial_tracked: false,
    status: 'active',
    created_at: timestamp,
    updated_at: timestamp,
  }
}
