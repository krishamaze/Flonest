import { useQuery } from '@tanstack/react-query'
import {
  searchMasterProducts,
  getMasterProduct,
  type MasterProduct,
} from '../lib/api/master-products'

/**
 * Query hook to search master products with debouncing
 * Use with a debounced search query for best performance
 */
export const useSearchMasterProducts = (
  query: string | null | undefined,
  enabled: boolean = true
) => {
  return useQuery<MasterProduct[]>({
    queryKey: ['master-products-search', query],
    queryFn: async () => {
      if (!query || !query.trim()) return []
      return searchMasterProducts({ q: query, limit: 10 })
    },
    enabled: enabled && !!query && query.trim().length > 0,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to get a single master product by ID
 */
export const useMasterProduct = (masterProductId: string | null | undefined) => {
  return useQuery<MasterProduct>({
    queryKey: ['master-product', masterProductId],
    queryFn: async () => {
      if (!masterProductId) throw new Error('Master product ID is required')
      return getMasterProduct(masterProductId)
    },
    enabled: !!masterProductId,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  })
}
