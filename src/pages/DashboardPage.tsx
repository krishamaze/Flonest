import { useEffect, useState, useCallback } from 'react'
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

  const loadDashboardStats = useCallback(async () => {
    if (!user) return

    try {
      // Execute all queries in parallel for better performance
      const [inventoryCountResult, inventoryResult, invoicesCountResult] = await Promise.all([
        supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.orgId),
        supabase
          .from('inventory')
          .select('quantity, cost_price, selling_price')
          .eq('org_id', user.orgId),
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.orgId)
      ])

      const inventory = inventoryResult.data || []
      const lowStockItems = inventory.filter(
        (item: any) => item.quantity < 10
      ).length

      const totalValue = inventory.reduce(
        (sum: number, item: any) => sum + item.quantity * item.selling_price,
        0
      )

      setStats({
        totalProducts: inventoryCountResult.count || 0,
        lowStockItems,
        totalValue,
        totalInvoices: invoicesCountResult.count || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadDashboardStats()
  }, [loadDashboardStats])

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
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user?.email}
        </p>
      </div>

      {/* Stats Cards - 12px gap, 16px padding */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            {/* Card icon: 20px max */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
              <CubeIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600">Total Products</p>
              <p className="text-xl font-semibold text-gray-900">
                {stats?.totalProducts || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600">Low Stock</p>
              <p className="text-xl font-semibold text-gray-900">
                {stats?.lowStockItems || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600">Total Value</p>
              <p className="text-xl font-semibold text-gray-900">
                ${stats?.totalValue.toFixed(2) || '0.00'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <ArrowTrendingDownIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600">Total Invoices</p>
              <p className="text-xl font-semibold text-gray-900">
                {stats?.totalInvoices || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]">
              <CubeIcon className="h-5 w-5 text-primary-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Add Product</p>
                <p className="text-xs text-gray-600">Create new inventory item</p>
              </div>
            </button>
            <button className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]">
              <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Add Stock</p>
                <p className="text-xs text-gray-600">Increase stock quantity</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

