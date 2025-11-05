import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import {
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface DashboardStats {
  totalProducts: number
  lowStockItems: number
  totalValue: number
  totalInvoices: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [user])

  const loadDashboardStats = async () => {
    if (!user) return

    try {
      // Get total inventory items
      const { count: totalProducts } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenantId)

      // Get inventory with details
      const { data: inventory } = await supabase
        .from('inventory')
        .select('quantity, cost_price, selling_price')
        .eq('tenant_id', user.tenantId)

      const lowStockItems = inventory?.filter(
        (item: any) => item.quantity < 10
      ).length || 0

      const totalValue = inventory?.reduce(
        (sum: number, item: any) => sum + item.quantity * item.selling_price,
        0
      ) || 0

      // Get total invoices
      const { count: totalInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenantId)

      setStats({
        totalProducts: totalProducts || 0,
        lowStockItems,
        totalValue,
        totalInvoices: totalInvoices || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user?.email}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
              <CubeIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalProducts || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.lowStockItems || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <ArrowTrendingUpIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats?.totalValue.toFixed(2) || '0.00'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <ArrowTrendingDownIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalInvoices || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50">
              <CubeIcon className="h-6 w-6 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">Add Product</p>
                <p className="text-sm text-gray-600">Create new inventory item</p>
              </div>
            </button>
            <button className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50">
              <ArrowTrendingUpIcon className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">Stock In</p>
                <p className="text-sm text-gray-600">Add inventory</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

