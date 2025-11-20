import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Input } from '../components/ui/Input'
import { getPendingMasterProducts } from '../lib/api/master-products'
import type { MasterProduct } from '../lib/api/master-products'
import {
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { StatusHelpText } from '../components/ui/StatusHelpText'

export function PendingProductsPage() {
  const { user } = useAuth()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [products, setProducts] = useState<MasterProduct[]>([])
  const [filteredProducts, setFilteredProducts] = useState<MasterProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (user) {
      loadProducts()
    }
  }, [user])

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    registerRefreshHandler(loadProducts)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler])

  useEffect(() => {
    let filtered = products

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (statusFilter === 'pending') {
          return p.approval_status === 'pending' || p.approval_status === 'auto_pass'
        }
        return p.approval_status === statusFilter
      })
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.category && p.category.toLowerCase().includes(query))
      )
    }

    setFilteredProducts(filtered)
  }, [products, statusFilter, searchQuery])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Filter is applied in useEffect above
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const loadProducts = async () => {
    if (!user || !user.orgId) return

    setLoading(true)
    try {
      const pending = await getPendingMasterProducts(user.orgId)
      setProducts(pending)
    } catch (error) {
      console.error('Error loading pending products:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'auto_pass':
        return (
          <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-warning-light text-warning-dark text-xs font-medium">
            <ClockIcon className="h-3 w-3" />
            Pending Review
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
        <h1 className="text-xl font-semibold text-primary-text">My Product Submissions</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Track the status of your product submissions
        </p>
        <div className="mt-sm">
          <StatusHelpText status="pending" />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-md">
        {/* Status Filter */}
        <div className="flex gap-sm border-b border-neutral-200 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            All ({products.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            Pending ({products.filter(p => p.approval_status === 'pending' || p.approval_status === 'auto_pass').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'approved'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            Approved ({products.filter(p => p.approval_status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'rejected'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            Rejected ({products.filter(p => p.approval_status === 'rejected').length})
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
            <p className="text-sm text-secondary-text">
              {searchQuery || statusFilter !== 'all'
                ? 'No products found matching your filters.'
                : 'No product submissions yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-sm">
          {filteredProducts.map((product) => (
            <Card key={product.id}>
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
                      <p className="text-xs text-muted-text">
                        Submitted: {new Date(product.created_at || '').toLocaleString()}
                      </p>
                      {product.rejection_reason && (
                        <div className="mt-sm p-sm rounded-md bg-error-light">
                          <p className="text-xs font-medium text-error-dark mb-xs">Rejection Reason:</p>
                          <p className="text-sm text-error-dark">{product.rejection_reason}</p>
                        </div>
                      )}
                      {product.reviewed_at && (
                        <p className="text-xs text-muted-text">
                          Reviewed: {new Date(product.reviewed_at).toLocaleString()}
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
    </div>
  )
}

