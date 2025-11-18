/**
 * React Query hooks for Products
 * 
 * Implements optimistic updates for instant UI feedback when creating/updating/deleting products.
 * All mutations update the React Query cache immediately, reverting only on error.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/api/products'
import { getCurrentStockForProducts } from '../lib/api/stockCalculations'
import type { Product, ProductWithStock } from '../types'

export interface GetProductsParams {
  status?: 'active' | 'inactive'
  category?: string
  search?: string
}

export interface GetProductsOptions {
  page?: number
  pageSize?: number
}

/**
 * Query hook for products with pagination
 */
export const useProducts = (
  orgId: string | null | undefined,
  params: GetProductsParams = {},
  options: GetProductsOptions = {}
) => {
  return useInfiniteQuery<{ data: Product[]; total: number }, Error>({
    queryKey: ['products', orgId, params, options],
    queryFn: async ({ pageParam = 1 }): Promise<{ data: Product[]; total: number }> => {
      if (!orgId) {
        throw new Error('Organization ID is required')
      }

      return getProducts(orgId, params, { ...options, page: pageParam as number })
    },
    getNextPageParam: (lastPage, allPages) => {
      const pageSize = options.pageSize || 20
      const totalPages = Math.ceil(lastPage.total / pageSize)
      const nextPage = allPages.length + 1
      return nextPage <= totalPages ? nextPage : undefined
    },
    initialPageParam: 1,
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds - matches cache window
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook for products with stock data
 */
export const useProductsWithStock = (
  orgId: string | null | undefined,
  params: GetProductsParams = {},
  options: GetProductsOptions = {}
) => {
  return useQuery<ProductWithStock[], Error>({
    queryKey: ['products-with-stock', orgId, params, options],
    queryFn: async (): Promise<ProductWithStock[]> => {
      if (!orgId) {
        throw new Error('Organization ID is required')
      }

      const result = await getProducts(orgId, params, { ...options, page: 1, pageSize: 1000 })
      
      // Load stock for all products
      if (result.data.length > 0) {
        const productIds = result.data.map(p => p.id)
        const stockMap = await getCurrentStockForProducts(productIds, orgId)
        
        return result.data.map(product => ({
          ...product,
          current_stock: stockMap[product.id] || 0,
        }))
      }

      return []
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds - matches cache window
    refetchOnWindowFocus: false,
  })
}

/**
 * Create product mutation
 * OPTIMISTIC UPDATE: Adds product to cache immediately, reverts on error
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient()

  type ProductsContext = {
    previousProducts?: { pages: { data: Product[]; total: number }[] }
    previousProductsWithStock?: ProductWithStock[]
  }

  return useMutation<Product, Error, { orgId: string; data: Parameters<typeof createProduct>[1] }, ProductsContext>({
    mutationFn: async ({ orgId, data }) => {
      return createProduct(orgId, data)
    },
    // OPTIMISTIC UPDATE: Add product to cache immediately
    onMutate: async ({ orgId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products', orgId] })
      await queryClient.cancelQueries({ queryKey: ['products-with-stock', orgId] })

      // Snapshot previous values for rollback
      const previousProducts = queryClient.getQueryData<{ pages: { data: Product[]; total: number }[] }>(['products', orgId])
      const previousProductsWithStock = queryClient.getQueryData<ProductWithStock[]>(['products-with-stock', orgId])

      // Create optimistic product (will be replaced with server response)
      const optimisticProduct: Product = {
        id: `temp-${Date.now()}`,
        org_id: orgId,
        name: data.name,
        sku: data.sku,
        ean: data.ean || null,
        description: data.description || null,
        category: data.category || null,
        unit: data.unit || 'pcs',
        cost_price: data.cost_price || null,
        selling_price: data.selling_price || null,
        min_stock_level: data.min_stock_level ?? 0,
        hsn_sac_code: data.hsn_sac_code || null,
        tax_rate: data.tax_rate || null,
        status: 'active',
        master_product_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_id: null,
        category_id: null,
        serial_tracked: false,
      }

      // Optimistically update products list
      if (previousProducts) {
        const newPages = [...previousProducts.pages]
        if (newPages.length > 0) {
          newPages[0] = {
            ...newPages[0],
            data: [optimisticProduct, ...newPages[0].data],
            total: newPages[0].total + 1,
          }
          queryClient.setQueryData(['products', orgId], { ...previousProducts, pages: newPages })
        }
      }

      // Optimistically update products with stock
      if (previousProductsWithStock) {
        queryClient.setQueryData<ProductWithStock[]>(['products-with-stock', orgId], [
          { ...optimisticProduct, current_stock: 0 },
          ...previousProductsWithStock,
        ])
      }

      return { previousProducts, previousProductsWithStock }
    },
    // On error, rollback to previous values
    onError: (_error, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products', variables.orgId], context.previousProducts)
      }
      if (context?.previousProductsWithStock) {
        queryClient.setQueryData(['products-with-stock', variables.orgId], context.previousProductsWithStock)
      }
    },
    // On success, invalidate to refetch fresh data
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products', variables.orgId] })
      queryClient.invalidateQueries({ queryKey: ['products-with-stock', variables.orgId] })
    },
  })
}

/**
 * Update product mutation
 * OPTIMISTIC UPDATE: Updates product in cache immediately, reverts on error
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient()

  type ProductsContext = {
    previousProducts?: { pages: { data: Product[]; total: number }[] }
    previousProductsWithStock?: ProductWithStock[]
  }

  return useMutation<Product, Error, { productId: string; orgId: string; data: Parameters<typeof updateProduct>[1] }, ProductsContext>({
    mutationFn: async ({ productId, data }) => {
      return updateProduct(productId, data)
    },
    // OPTIMISTIC UPDATE: Update product in cache immediately
    onMutate: async ({ productId, orgId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['products', orgId] })
      await queryClient.cancelQueries({ queryKey: ['products-with-stock', orgId] })

      // Snapshot previous values
      const previousProducts = queryClient.getQueryData<{ pages: { data: Product[]; total: number }[] }>(['products', orgId])
      const previousProductsWithStock = queryClient.getQueryData<ProductWithStock[]>(['products-with-stock', orgId])

      // Optimistically update products list
      if (previousProducts) {
        const newPages = previousProducts.pages.map(page => ({
          ...page,
          data: page.data.map(p => (p.id === productId ? { ...p, ...data, updated_at: new Date().toISOString() } : p)),
        }))
        queryClient.setQueryData(['products', orgId], { ...previousProducts, pages: newPages })
      }

      // Optimistically update products with stock
      if (previousProductsWithStock) {
        queryClient.setQueryData<ProductWithStock[]>(['products-with-stock', orgId], 
          previousProductsWithStock.map(p => p.id === productId ? { ...p, ...data, updated_at: new Date().toISOString() } : p)
        )
      }

      return { previousProducts, previousProductsWithStock }
    },
    // On error, rollback
    onError: (_error, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products', variables.orgId], context.previousProducts)
      }
      if (context?.previousProductsWithStock) {
        queryClient.setQueryData(['products-with-stock', variables.orgId], context.previousProductsWithStock)
      }
    },
    // On success, invalidate to refetch
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products', variables.orgId] })
      queryClient.invalidateQueries({ queryKey: ['products-with-stock', variables.orgId] })
    },
  })
}

/**
 * Delete product mutation
 * OPTIMISTIC UPDATE: Removes product from cache immediately, reverts on error
 */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient()

  type ProductsContext = {
    previousProducts?: { pages: { data: Product[]; total: number }[] }
    previousProductsWithStock?: ProductWithStock[]
  }

  return useMutation<void, Error, { productId: string; orgId: string }, ProductsContext>({
    mutationFn: async ({ productId }) => {
      return deleteProduct(productId)
    },
    // OPTIMISTIC UPDATE: Remove product from cache immediately
    onMutate: async ({ productId, orgId }) => {
      await queryClient.cancelQueries({ queryKey: ['products', orgId] })
      await queryClient.cancelQueries({ queryKey: ['products-with-stock', orgId] })

      // Snapshot previous values
      const previousProducts = queryClient.getQueryData<{ pages: { data: Product[]; total: number }[] }>(['products', orgId])
      const previousProductsWithStock = queryClient.getQueryData<ProductWithStock[]>(['products-with-stock', orgId])

      // Optimistically remove from products list
      if (previousProducts) {
        const newPages = previousProducts.pages.map(page => ({
          ...page,
          data: page.data.filter(p => p.id !== productId),
          total: Math.max(0, page.total - 1),
        }))
        queryClient.setQueryData(['products', orgId], { ...previousProducts, pages: newPages })
      }

      // Optimistically remove from products with stock
      if (previousProductsWithStock) {
        queryClient.setQueryData<ProductWithStock[]>(['products-with-stock', orgId], 
          previousProductsWithStock.filter(p => p.id !== productId)
        )
      }

      return { previousProducts, previousProductsWithStock }
    },
    // On error, rollback
    onError: (_error, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products', variables.orgId], context.previousProducts)
      }
      if (context?.previousProductsWithStock) {
        queryClient.setQueryData(['products-with-stock', variables.orgId], context.previousProductsWithStock)
      }
    },
    // On success, invalidate to refetch
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products', variables.orgId] })
      queryClient.invalidateQueries({ queryKey: ['products-with-stock', variables.orgId] })
    },
  })
}

