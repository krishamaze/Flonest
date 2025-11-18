import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import type { Product, ProductFormData, ProductWithStock } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { ProductForm } from '../components/forms/ProductForm'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/api/products'
import { getCurrentStockForProducts } from '../lib/api/stockCalculations'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

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

export function ProductsPage() {
  const { user } = useAuth()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Debounced search input -> query value
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

  // Reset pagination whenever category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter])

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    const handler = async () => {
      if (!user?.orgId) return
      await queryClient.invalidateQueries({ queryKey: baseProductQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['product-categories', user.orgId] })
    }
    registerRefreshHandler(handler)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, queryClient, baseProductQueryKey, user?.orgId])

  const productsWithStock = productsQuery.data?.items ?? []
  const totalProducts = productsQuery.data?.total ?? 0
  const totalPages = Math.ceil(totalProducts / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  const createProductMutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      if (!user?.orgId) {
        throw new Error('User not authenticated')
      }
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
        if (!current || productPagination.page !== 1) {
          return current
        }

        if (!productMatchesFilters(productWithStock, productFilters)) {
          return current
        }

        const replacedItems = current.items.map(item =>
          item.id === context?.optimisticId ? productWithStock : item
        )

        const alreadyReplaced = replacedItems.some(item => item.id === productWithStock.id)
        const nextItems = alreadyReplaced
          ? replacedItems
          : [productWithStock, ...replacedItems].slice(0, current.pageSize)

        return {
          ...current,
          items: nextItems,
        }
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

  const handleCreateProduct = async (data: ProductFormData) => {
    return await createProductMutation.mutateAsync(data)
  }

  const handleUpdateProduct = async (data: ProductFormData) => {
    if (!editingProduct) {
      throw new Error('No product selected')
    }
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

  const handleEditClick = (product: ProductWithStock) => {
    setEditingProduct(product)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
  }

  if (!user?.orgId || productsQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const loading = productsQuery.isFetching && !productsQuery.isLoading

  return (
    <div className="space-y-md">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary-text">Products</h1>
        <Button
          variant="primary"
          size="sm"
          className="flex items-center gap-1.5"
          onClick={() => {
            setEditingProduct(null)
            setIsFormOpen(true)
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Add Product</span>
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by name, SKU, or EAN..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-bg-card py-sm pl-[2.5rem] pr-md text-sm min-h-[44px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            aria-label="Search products"
          />
        </div>

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCategoryFilter('')}
              className={`whitespace-nowrap rounded-md px-md py-sm min-h-[44px] text-sm font-medium transition-colors.duration-200 ${
                categoryFilter === ''
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
              }`}
              aria-label="Show all categories"
              aria-pressed={categoryFilter === ''}
            >
              All Categories
            </button>
            {availableCategories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setCategoryFilter(category)
                }}
                className={`whitespace-nowrap rounded-md px-md py-sm min-h-[44px] text-sm font-medium transition-colors.duration-200 ${
                  categoryFilter === category
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
                }`}
                aria-label={`Filter by ${category}`}
                aria-pressed={categoryFilter === category}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products List */}
      {productsWithStock.length === 0 && !loading ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <CubeIcon className="h-12 w-12 text-muted-text mx-auto mb-md" aria-hidden="true" />
            <p className="text-sm font-medium text-primary-text mb-sm">
              {searchInput || categoryFilter ? 'No products found' : 'No products yet'}
            </p>
            <p className="text-sm text-secondary-text mb-md">
              {searchInput || categoryFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Add your first product to get started with inventory management.'}
            </p>
            {!searchInput && !categoryFilter && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsFormOpen(true)}
                className="min-h-[44px]"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add First Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {productsWithStock.map((product) => {
              const stockStatus =
                product.current_stock === 0
                  ? { label: 'Out of Stock', color: 'text-error bg-error-light' }
                  : product.current_stock < (product.min_stock_level || 0)
                  ? { label: 'Low Stock', color: 'text-warning bg-warning-light' }
                  : { label: 'In Stock', color: 'text-success bg-success-light' }
              return (
                <Card key={product.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-primary-text truncate">
                          {product.name}
                        </h3>
                        <div className="mt-xs flex flex-wrap items-center gap-sm text-xs text-secondary-text">
                          <span>SKU: {product.sku}</span>
                          {product.ean && <span>• EAN: {product.ean}</span>}
                          {product.unit && <span>• Unit: {product.unit}</span>}
                        </div>
                        {product.description && (
                          <p className="text-xs text-muted-text mt-xs line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label} ({product.current_stock} {product.unit || 'pcs'})
                          </span>
                          {product.category && (
                            <span className="inline-flex items-center rounded-full px-sm py-xs text-xs font-medium bg-neutral-100 text-secondary-text">
                              {product.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {product.selling_price && (
                          <p className="text-base font-semibold text-primary-text">
                            ${product.selling_price.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                        {product.cost_price && (
                          <p className="text-xs text-muted-text mt-xs">
                            Cost: ${product.cost_price.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(product)}
                            className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-secondary-text hover:bg-neutral-100 hover:text-primary-text transition-colors duration-200"
                            aria-label={`Edit product ${product.name}`}
                          >
                            <PencilIcon className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-error hover:bg-error-light hover:text-error-dark transition-colors duration-200"
                            aria-label={`Delete product ${product.name}`}
                          >
                            <TrashIcon className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-secondary-text">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalProducts)} of {totalProducts} products
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={!hasPrevPage}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-secondary-text">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={!hasNextPage}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Product Form */}
      {user && (
        <ProductForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
          product={editingProduct}
          orgId={user.orgId!}
          userId={user.id}
        />
      )}
    </div>
  )
}

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

