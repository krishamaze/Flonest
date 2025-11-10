import { useEffect, useState, useCallback, useRef } from 'react'
import { getPendingReviews } from '../../lib/api/master-product-review'
import type { MasterProduct } from '../../lib/api/master-products'
import { Card, CardContent } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Input } from '../ui/Input'
import {
  MagnifyingGlassIcon,
  ClockIcon,
  XCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { ProductReviewModal } from './ProductReviewModal'
import { StatusHelpText } from '../ui/StatusHelpText'

type FilterType = 'pending' | 'rejected' | 'all'

export function ReviewQueue() {
  const [products, setProducts] = useState<MasterProduct[]>([])
  const [filteredProducts, setFilteredProducts] = useState<MasterProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const pending = await getPendingReviews()
      setProducts(pending)
    } catch (error) {
      console.error('Error loading pending reviews:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Filter and search products
  useEffect(() => {
    let filtered = products

    // Apply status filter
    if (filter === 'pending') {
      filtered = filtered.filter(p => p.approval_status === 'pending' || p.approval_status === 'auto_pass')
    } else if (filter === 'rejected') {
      filtered = filtered.filter(p => p.approval_status === 'rejected')
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.category && p.category.toLowerCase().includes(query))
      )
    }

    setFilteredProducts(filtered)
  }, [products, filter, searchQuery])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      // Filter is already applied in the useEffect above
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const handleProductClick = (product: MasterProduct) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedProduct(null)
    loadProducts() // Reload to get updated status
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'auto_pass':
        return (
          <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-warning-light text-warning-dark text-xs font-medium">
            <ClockIcon className="h-3 w-3" />
            Pending
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-error-light text-error-dark text-xs font-medium">
            <XCircleIcon className="h-3 w-3" />
            Rejected
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-success-light text-success-dark text-xs font-medium">
            <CheckCircleIcon className="h-3 w-3" />
            Approved
          </span>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Review Queue</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Review and approve product submissions
        </p>
        <div className="mt-sm">
          <StatusHelpText status="pending" />
        </div>
      </div>

      {/* Filters and Search */}
      <div className="space-y-md">
        {/* Filter Tabs */}
        <div className="flex gap-sm border-b border-neutral-200">
          <button
            onClick={() => setFilter('pending')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors ${
              filter === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            Pending ({products.filter(p => p.approval_status === 'pending' || p.approval_status === 'auto_pass').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors ${
              filter === 'rejected'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            Rejected ({products.filter(p => p.approval_status === 'rejected').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            All ({products.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-md top-1/2 -translate-y-1/2 h-5 w-5 text-muted-text" />
          <Input
            type="text"
            placeholder="Search by name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-xl"
          />
        </div>
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-xl text-center">
            <p className="text-secondary-text">
              {searchQuery ? 'No products found matching your search.' : 'No products to review.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-sm">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              onClick={() => handleProductClick(product)}
              className="cursor-pointer"
            >
              <CardContent className="p-md">
                <div className="flex items-start justify-between gap-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm mb-xs">
                      <h3 className="text-base font-semibold text-primary-text truncate">
                        {product.name}
                      </h3>
                      {getStatusBadge(product.approval_status)}
                    </div>
                    <div className="space-y-xs text-sm text-secondary-text">
                      <p>SKU: {product.sku}</p>
                      {product.category && <p>Category: {product.category}</p>}
                      {product.hsn_code && <p>HSN: {product.hsn_code}</p>}
                      {product.submitted_org_id && (
                        <p className="text-xs text-muted-text">
                          Submitted: {new Date(product.created_at || '').toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedProduct && (
        <ProductReviewModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          product={selectedProduct}
        />
      )}
    </div>
  )
}

