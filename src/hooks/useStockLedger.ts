/**
 * React Query hooks for Stock Ledger
 * 
 * Implements optimistic updates for instant UI feedback when creating stock transactions.
 * All mutations update the React Query cache immediately, reverting only on error.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStockLedgerWithProducts, createStockTransaction } from '../lib/api/stockLedger'
import type { StockLedger, Product } from '../types'

export interface StockLedgerWithProduct extends StockLedger {
  product: Product
}

/**
 * Query hook for stock ledger entries with product details
 */
export const useStockLedger = (
  orgId: string | null | undefined,
  productId?: string
) => {
  return useQuery<StockLedgerWithProduct[], Error>({
    queryKey: ['stock-ledger', orgId, productId],
    queryFn: async (): Promise<StockLedgerWithProduct[]> => {
      if (!orgId) {
        throw new Error('Organization ID is required')
      }

      return getStockLedgerWithProducts(orgId, productId)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds - matches cache window
    refetchOnWindowFocus: false,
  })
}

/**
 * Create stock transaction mutation
 * OPTIMISTIC UPDATE: Adds transaction to cache immediately, reverts on error
 */
export const useCreateStockTransaction = () => {
  const queryClient = useQueryClient()

  type StockLedgerContext = {
    previousLedger?: StockLedgerWithProduct[]
  }

  return useMutation<StockLedger, Error, { orgId: string; userId: string; data: Parameters<typeof createStockTransaction>[2] }, StockLedgerContext>({
    mutationFn: async ({ orgId, userId, data }) => {
      return createStockTransaction(orgId, userId, data)
    },
    // OPTIMISTIC UPDATE: Add transaction to cache immediately
    onMutate: async ({ orgId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['stock-ledger', orgId] })

      // Snapshot previous value for rollback
      const previousLedger = queryClient.getQueryData<StockLedgerWithProduct[]>(['stock-ledger', orgId])

      // Create optimistic transaction (will be replaced with server response)
      // Note: We don't have product data here, so we'll add a placeholder
      // The real product will be fetched on success
      const optimisticTransaction: StockLedgerWithProduct = {
        id: `temp-${Date.now()}`, // Temporary ID, will be replaced by server response
        org_id: orgId,
        product_id: data.product_id,
        transaction_type: data.transaction_type,
        quantity: data.quantity,
        notes: data.notes || null,
        created_by: '', // Will be set by server
        created_at: new Date().toISOString(),
        cost_provisional: false,
        product: {
          id: data.product_id,
          org_id: orgId,
          name: 'Loading...',
          sku: '',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Product,
      }

      // Optimistically add to ledger (prepend for newest-first order)
      if (previousLedger) {
        queryClient.setQueryData<StockLedgerWithProduct[]>(['stock-ledger', orgId], [
          optimisticTransaction,
          ...previousLedger,
        ])
      }

      // Also invalidate products-with-stock to refresh stock counts
      queryClient.invalidateQueries({ queryKey: ['products-with-stock', orgId] })

      return { previousLedger }
    },
    // On error, rollback to previous value
    onError: (_error, variables, context) => {
      if (context?.previousLedger) {
        queryClient.setQueryData(['stock-ledger', variables.orgId], context.previousLedger)
      }
    },
    // On success, invalidate to refetch fresh data (with proper product details)
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock-ledger', variables.orgId] })
      queryClient.invalidateQueries({ queryKey: ['products-with-stock', variables.orgId] })
    },
  })
}

