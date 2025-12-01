import { useQuery } from '@tanstack/react-query'
import { getCustomerBalances, getReceivablesStats, type CustomerBalance } from '../lib/api/customer-balances'

/**
 * Hook to fetch customer balances with receivables tracking
 * Returns customers sorted by balance_due DESC
 */
export const useCustomerBalances = (orgId: string | null | undefined) => {
  return useQuery<CustomerBalance[]>({
    queryKey: ['customer-balances', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')
      return getCustomerBalances(orgId)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to fetch aggregated receivables statistics
 * Used for dashboard stats cards
 */
export const useReceivablesStats = (orgId: string | null | undefined) => {
  return useQuery({
    queryKey: ['receivables-stats', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')
      return getReceivablesStats(orgId)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}
