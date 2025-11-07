import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Product, ProductWithStock } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { ProductForm } from '../components/forms/ProductForm'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, CubeIcon } from '@heroicons/react/24/outline'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/api/products'
import { getCurrentStockForProducts } from '../lib/api/stockCalculations'

export function ProductsPage() {
  const { user } = useAuth()
  const [productsWithStock, setProductsWithStock] = useState<ProductWithStock[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [pageSize] = useState(20)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  const loadProducts = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const result = await getProducts(
        user.orgId,
        {
          status: 'active',
          category: categoryFilter || undefined,
          search: searchQuery.trim() || undefined,
        },
        {
          page: currentPage,
          pageSize,
        }
      )

      setTotalProducts(result.total)

      // Load stock for all products
      if (result.data.length > 0) {
        const productIds = result.data.map(p => p.id)
        const stockMap = await getCurrentStockForProducts(productIds, user.orgId)
        
        const productsWithStockData: ProductWithStock[] = result.data.map(product => ({
          ...product,
          current_stock: stockMap[product.id] || 0,
        }))
        setProductsWithStock(productsWithStockData)
      } else {
        setProductsWithStock([])
      }

      // Load available categories for filter
      const allProducts = await getProducts(user.orgId, { status: 'active' }, { page: 1, pageSize: 1000 })
      const categories = Array.from(new Set(allProducts.data.map(p => p.category).filter(Boolean) as string[]))
      setAvailableCategories(categories.sort())
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }, [user, currentPage, categoryFilter, searchQuery, pageSize])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1) // Reset to first page on search
      loadProducts()
    }, 300) // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    loadProducts()
  }, [currentPage, categoryFilter])

  // Calculate pagination
  const totalPages = Math.ceil(totalProducts / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  const handleCreateProduct = async (data: any) => {
    if (!user) return
    await createProduct(user.orgId, data)
    await loadProducts()
  }

  const handleUpdateProduct = async (data: any) => {
    if (!editingProduct) return
    await updateProduct(editingProduct.id, data)
    await loadProducts()
    setEditingProduct(null)
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await deleteProduct(productId)
      await loadProducts()
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-bg-card py-sm pl-[2.5rem] pr-md text-sm min-h-[44px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            aria-label="Search products"
          />
        </div>

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCategoryFilter('')}
              className={`whitespace-nowrap rounded-md px-md py-sm min-h-[44px] text-sm font-medium transition-colors duration-200 ${
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
                  setCurrentPage(1)
                }}
                className={`whitespace-nowrap rounded-md px-md py-sm min-h-[44px] text-sm font-medium transition-colors duration-200 ${
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
              {searchQuery || categoryFilter ? 'No products found' : 'No products yet'}
            </p>
            <p className="text-sm text-secondary-text mb-md">
              {searchQuery || categoryFilter 
                ? 'Try adjusting your search or filter criteria' 
                : 'Add your first product to get started with inventory management.'}
            </p>
            {!searchQuery && !categoryFilter && (
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
              const stockStatus = product.current_stock === 0 
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
                          ${product.selling_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                      {product.cost_price && (
                        <p className="text-xs text-muted-text mt-xs">
                          Cost: ${product.cost_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      <ProductForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
        product={editingProduct}
        orgId={user?.orgId}
        userId={user?.id}
      />
    </div>
  )
}

