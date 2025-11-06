import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Product, ProductWithStock } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { ProductForm } from '../components/forms/ProductForm'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
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
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
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
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or EAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCategoryFilter('')}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                categoryFilter === ''
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
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
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  categoryFilter === category
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
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
            <p className="text-sm text-gray-600">
              {searchQuery || categoryFilter ? 'No products found' : 'No products yet. Add your first product to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {productsWithStock.map((product) => {
              const stockStatus = product.current_stock === 0 
                ? { label: 'Out of Stock', color: 'text-red-600 bg-red-50' }
                : product.current_stock < (product.min_stock_level || 0)
                ? { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-50' }
                : { label: 'In Stock', color: 'text-green-600 bg-green-50' }
            return (
              <Card key={product.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-gray-900 truncate">
                        {product.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>SKU: {product.sku}</span>
                        {product.ean && <span>• EAN: {product.ean}</span>}
                        {product.unit && <span>• Unit: {product.unit}</span>}
                      </div>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label} ({product.current_stock} {product.unit || 'pcs'})
                        </span>
                        {product.category && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                            {product.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {product.selling_price && (
                        <p className="text-base font-semibold text-gray-900">
                          ${product.selling_price.toFixed(2)}
                        </p>
                      )}
                      {product.cost_price && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Cost: ${product.cost_price.toFixed(2)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(product)}
                          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                          aria-label="Edit product"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                          aria-label="Delete product"
                        >
                          <TrashIcon className="h-4 w-4" />
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
              <div className="text-sm text-gray-600">
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
                <span className="text-sm text-gray-600">
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
      />
    </div>
  )
}

