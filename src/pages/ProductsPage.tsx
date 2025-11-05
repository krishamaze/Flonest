import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { InventoryWithProduct } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<InventoryWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadProducts()
  }, [user])

  const loadProducts = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:master_products(*)
        `)
        .eq('tenant_id', user.tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const productsWithStatus = (data || []).map((item: any) => ({
        ...item,
        stockStatus: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock'
      }))

      setProducts(productsWithStatus)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter((product) =>
    product.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.product?.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStockStatus = (product: InventoryWithProduct) => {
    if (product.quantity === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50' }
    if (product.quantity < 10) return { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-50' }
    return { label: 'In Stock', color: 'text-green-600 bg-green-50' }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button variant="primary" size="sm" className="flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Add Product</span>
        </Button>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">
              {searchQuery ? 'No products found' : 'No products yet. Add your first product to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((item) => {
            const stockStatus = getStockStatus(item)
            const product = item.product
            if (!product) return null

            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">SKU: {product.sku}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {product.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ${item.selling_price.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Cost: ${item.cost_price.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

