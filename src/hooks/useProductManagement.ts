import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRefresh } from '../contexts/RefreshContext'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/api/products'
import { getCurrentStockForProducts } from '../lib/api/stockCalculations'
import type { Product, ProductFormData, ProductWithStock } from '../types'

type ProductsQueryResult = {
  items: ProductWithStock[]
  total: number
  page: number
  pageSize: number
}

type ProductFilterState = {
  status: 'active'
  category?: string
  search?: string
}

export function useProductManagement(user: any) {
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const queryClient = useQueryClient()

  // State
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Derived State
  const productFilters = useMemo<ProductFilterState>(() => ({
    status: 'active',
    category: categoryFilter || undefined,
    search: debouncedSearch || undefined,
  }), [categoryFilter, debouncedSearch])

  const productPagination = useMemo(() => ({
    page: currentPage,
    pageSize,
  }), [currentPage, pageSize])

  const baseProductQueryKey = useMemo(
    () => ['products', user?.orgId] as const,
    [user?.orgId]
  )

  const productQueryKey = useMemo(
    () => [...baseProductQueryKey, productFilters, productPagination] as const,
    [baseProductQueryKey, productFilters, productPagination]
  )

  // Queries
  const productsQuery = useQuery<ProductsQueryResult>({
    queryKey: productQueryKey,
    enabled: !!user?.orgId,
    queryFn: async () => {
      if (!user?.orgId) {
        return { items: [], total: 0, page: productPagination.page, pageSize: productPagination.pageSize }
      }

      const result = await getProducts(
        user.orgId,
        {
          status: productFilters.status,
          category: productFilters.category,
          search: productFilters.search,
        },
        productPagination
      )

      const productIds = result.data.map(p => p.id)
      const stockMap = productIds.length > 0 ? await getCurrentStockForProducts(productIds, user.orgId) : {}

      const items: ProductWithStock[] = result.data.map(product => ({
        ...product,
        current_stock: stockMap[product.id] || 0,
      }))

      return {
        items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
    staleTime: 30_000,
  })

  const { data: availableCategories = [] } = useQuery<string[]>({
    queryKey: ['product-categories', user?.orgId],
    enabled: !!user?.orgId,
    queryFn: async () => {
      if (!user?.orgId) {
        return []
      }
      const allProducts = await getProducts(user.orgId, { status: 'active' }, { page: 1, pageSize: 1000 })
      return Array.from(new Set(allProducts.data.map(p => p.category).filter(Boolean) as string[])).sort()
    },
    staleTime: 5 * 60 * 1000,
  })

  // Effects
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setCurrentPage(1)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchInput])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter])

  useEffect(() => {
    const handler = async () => {
      if (!user?.orgId) return
      await queryClient.invalidateQueries({ queryKey: baseProductQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['product-categories', user.orgId] })
    }
    registerRefreshHandler(handler)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, queryClient, baseProductQueryKey, user?.orgId])

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      if (!user?.orgId) throw new Error('User not authenticated')
      return await createProduct(user.orgId, formData)
    },
    onMutate: async (formData) => {
      if (!user?.orgId) return {}
      await queryClient.cancelQueries({ queryKey: baseProductQueryKey })
      const previousData = queryClient.getQueryData<ProductsQueryResult>(productQueryKey)
      const shouldShowOptimistic =
        productPagination.page === 1 && productMatchesFilters(formData, productFilters)
      const optimisticId = `temp-product-${Date.now()}`

      if (previousData && shouldShowOptimistic) {
        const optimisticProduct = buildOptimisticProduct(formData, user.orgId, optimisticId)
        queryClient.setQueryData<ProductsQueryResult>(productQueryKey, {
          ...previousData,
          items: [optimisticProduct, ...previousData.items].slice(0, previousData.pageSize),
          total: previousData.total + 1,
        })
      }

      updateCategoriesCache(queryClient, user.orgId, formData.category || null)
      return { previousData, optimisticId }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(productQueryKey, context.previousData)
      }
    },
    onSuccess: (createdProduct, _variables, context) => {
      const productWithStock: ProductWithStock = { ...createdProduct, current_stock: 0 }
      queryClient.setQueryData<ProductsQueryResult>(productQueryKey, current => {
        if (!current || productPagination.page !== 1) return current
        if (!productMatchesFilters(productWithStock, productFilters)) return current

        const replacedItems = current.items.map(item =>
          item.id === context?.optimisticId ? productWithStock : item
        )

        const alreadyReplaced = replacedItems.some(item => item.id === productWithStock.id)
        const nextItems = alreadyReplaced
          ? replacedItems
          : [productWithStock, ...replacedItems].slice(0, current.pageSize)

        return { ...current, items: nextItems }
      })
      updateCategoriesCache(queryClient, user?.orgId ?? null, createdProduct.category)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseProductQueryKey })
      queryClient.invalidateQueries({ queryKey: ['product-categories', user?.orgId] })
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: async ({ productId, changes }: { productId: string; changes: ProductFormData }) => {
      return await updateProduct(productId, changes)
    },
    onMutate: async ({ productId, changes }) => {
      await queryClient.cancelQueries({ queryKey: baseProductQueryKey })
      const previousData = queryClient.getQueryData<ProductsQueryResult>(productQueryKey)
      if (previousData) {
        queryClient.setQueryData<ProductsQueryResult>(productQueryKey, {
          ...previousData,
          items: previousData.items.map(item =>
            item.id === productId ? applyProductFormChanges(item, changes) : item
          ),
        })
      }
      return { previousData }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(productQueryKey, context.previousData)
      }
    },
    onSuccess: (updatedProduct, variables) => {
      queryClient.setQueryData<ProductsQueryResult>(productQueryKey, current => {
        if (!current) return current
        return {
          ...current,
          items: current.items.map(item =>
            item.id === variables.productId
              ? { ...updatedProduct, current_stock: item.current_stock }
              : item
          ),
        }
      })
      updateCategoriesCache(queryClient, user?.orgId ?? null, updatedProduct.category)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseProductQueryKey })
      queryClient.invalidateQueries({ queryKey: ['product-categories', user?.orgId] })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => deleteProduct(productId),
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: baseProductQueryKey })
      const previousData = queryClient.getQueryData<ProductsQueryResult>(productQueryKey)
      if (previousData) {
        queryClient.setQueryData<ProductsQueryResult>(productQueryKey, {
          ...previousData,
          items: previousData.items.filter(item => item.id !== productId),
          total: Math.max(0, previousData.total - 1),
        })
      }
      return { previousData }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(productQueryKey, context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseProductQueryKey })
      queryClient.invalidateQueries({ queryKey: ['product-categories', user?.orgId] })
    },
  })

  // Handlers
  const handleCreateProduct = async (data: ProductFormData) => {
    try {
      return await createProductMutation.mutateAsync(data)
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  }

  const handleUpdateProduct = async (data: ProductFormData) => {
    if (!editingProduct) throw new Error('No product selected')
    return await updateProductMutation.mutateAsync({ productId: editingProduct.id, changes: data })
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await deleteProductMutation.mutateAsync(productId)
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product. Please try again.')
    }
  }

  const handleAddClick = () => {
    setEditingProduct(null)
    setIsFormOpen(true)
  }

  const handleEditClick = (product: ProductWithStock) => {
    setEditingProduct(product)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
  }

  const productsWithStock = productsQuery.data?.items ?? []
  const totalProducts = productsQuery.data?.total ?? 0
  const totalPages = Math.ceil(totalProducts / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return {
    // State
    searchInput,
    setSearchInput,
    categoryFilter,
    setCategoryFilter,
    isFormOpen,
    setIsFormOpen,
    editingProduct,
    currentPage,
    setCurrentPage,
    
    // Data
    products: productsWithStock,
    totalProducts,
    totalPages,
    hasNextPage,
    hasPrevPage,
    availableCategories,
    isLoading: productsQuery.isLoading,
    isFetching: productsQuery.isFetching,
    isError: productsQuery.isError,
    error: productsQuery.error,
    refetch: productsQuery.refetch,

    // Actions
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleAddClick,
    handleEditClick,
    handleFormClose,
  }
}

// Helpers
function buildOptimisticProduct(
  formData: ProductFormData,
  orgId: string,
  id: string
): ProductWithStock {
  const timestamp = new Date().toISOString()
  return {
    id,
    org_id: orgId,
    branch_id: null,
    category: formData.category || null,
    category_id: null,
    cost_price: formData.cost_price ?? null,
    created_at: timestamp,
    description: formData.description || null,
    ean: formData.ean || null,
    hsn_sac_code: formData.hsn_sac_code ?? null,
    master_product_id: null,
    min_stock_level: formData.min_stock_level ?? 0,
    name: formData.name,
    selling_price: formData.selling_price ?? null,
    serial_tracked: false,
    sku: formData.sku,
    status: 'active',
    tax_rate: formData.tax_rate ?? null,
    unit: formData.unit || 'pcs',
    updated_at: timestamp,
    current_stock: 0,
  }
}

function applyProductFormChanges(
  product: ProductWithStock,
  changes: ProductFormData
): ProductWithStock {
  return {
    ...product,
    name: changes.name ?? product.name,
    sku: changes.sku ?? product.sku,
    ean: changes.ean !== undefined ? changes.ean || null : product.ean,
    description: changes.description !== undefined ? changes.description || null : product.description,
    category: changes.category !== undefined ? changes.category || null : product.category,
    unit: changes.unit ?? product.unit,
    cost_price: changes.cost_price !== undefined ? changes.cost_price ?? null : product.cost_price,
    selling_price: changes.selling_price !== undefined ? changes.selling_price ?? null : product.selling_price,
    min_stock_level: changes.min_stock_level ?? product.min_stock_level,
    tax_rate: changes.tax_rate !== undefined ? changes.tax_rate ?? null : product.tax_rate,
    hsn_sac_code: changes.hsn_sac_code !== undefined ? changes.hsn_sac_code ?? null : product.hsn_sac_code,
    updated_at: new Date().toISOString(),
  }
}

function productMatchesFilters(
  product: { name: string; sku: string; ean?: string | null; category?: string | null },
  filters: ProductFilterState
): boolean {
  if (filters.category && (product.category || '') !== filters.category) {
    return false
  }

  if (filters.search) {
    const haystack = `${product.name} ${product.sku} ${product.ean ?? ''}`.toLowerCase()
    return haystack.includes(filters.search.toLowerCase())
  }

  return true
}

function updateCategoriesCache(
  queryClient: QueryClient,
  orgId: string | null | undefined,
  category: string | null | undefined
) {
  if (!orgId || !category) return
  queryClient.setQueryData<string[]>(['product-categories', orgId], (existing = []) => {
    if (existing.includes(category)) {
      return existing
    }
    return [...existing, category].sort()
  })
}
