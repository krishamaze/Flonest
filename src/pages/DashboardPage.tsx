import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import {
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { getPendingMemberships, approveMembership } from '../lib/api/memberships'
import { canManageOrgSettings, canManageUsers } from '../lib/permissions'
import { toast } from 'react-toastify'
import { AddStaffForm } from '../components/staff/AddStaffForm'

interface DashboardStats {
  totalProducts: number
  lowStockItems: number
  totalValue: number
  totalInvoices: number
  finalizedDrafts: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingMemberships, setPendingMemberships] = useState<any[]>([])
  const [showAddStaffForm, setShowAddStaffForm] = useState(false)

  const loadDashboardStats = useCallback(async () => {
    if (!user || !user.orgId) return

    try {
      // Execute all queries in parallel for better performance
      const [inventoryCountResult, inventoryResult, invoicesCountResult, finalizedDraftsResult] = await Promise.all([
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
          .eq('org_id', user.orgId),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', user.orgId)
          .eq('status', 'finalized')
          .not('draft_data', 'is', null)
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
        finalizedDrafts: finalizedDraftsResult.count || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadPendingMemberships = useCallback(async () => {
    if (!user || !user.orgId || !canManageOrgSettings(user)) return

    try {
      const pending = await getPendingMemberships(user.orgId!)
      setPendingMemberships(pending)
    } catch (error) {
      console.error('Error loading pending memberships:', error)
    }
  }, [user])

  const handleApproveMembership = async (membershipId: string) => {
    try {
      await approveMembership(membershipId)
      toast.success('Membership approved successfully')
      // Reload pending memberships
      await loadPendingMemberships()
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve membership')
    }
  }

  useEffect(() => {
    loadDashboardStats()
    loadPendingMemberships()
  }, [loadDashboardStats, loadPendingMemberships])

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
        <h1 className="text-xl font-semibold text-primary-text">Dashboard</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Welcome back, {user?.email}
        </p>
      </div>

      {/* Stats Cards - compact horizontal layout */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Card className="shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary-light">
              <CubeIcon className="h-3 w-3 text-primary" />
            </div>
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Total Products</p>
            <p className="text-sm font-semibold text-primary-text">
              {stats?.totalProducts || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-warning-light">
              <ExclamationTriangleIcon className="h-3 w-3 text-warning" />
            </div>
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Low Stock</p>
            <p className="text-sm font-semibold text-primary-text">
              {stats?.lowStockItems || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-success-light">
              <ArrowTrendingUpIcon className="h-3 w-3 text-success" />
            </div>
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Total Value</p>
            <p className="text-sm font-semibold text-primary-text">
              ${stats?.totalValue ? stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-100">
              <ArrowTrendingDownIcon className="h-3 w-3 text-secondary-text" />
            </div>
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Total Invoices</p>
            <p className="text-sm font-semibold text-primary-text">
              {stats?.totalInvoices || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs rounded-md flex-shrink-0" style={{ minWidth: '120px', maxWidth: '140px' }}>
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-success-light">
              <ArrowTrendingUpIcon className="h-3 w-3 text-success" />
            </div>
            <p className="text-[9px] font-medium text-secondary-text leading-tight text-center">Finalized Drafts</p>
            <p className="text-sm font-semibold text-primary-text">
              {stats?.finalizedDrafts || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals (Owner only) */}
      {canManageOrgSettings(user) && pendingMemberships.length > 0 && (
        <Card className="shadow-sm border-warning">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-sm">
              <ExclamationTriangleIcon className="h-5 w-5 text-warning" />
              Pending Staff Approvals ({pendingMemberships.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {pendingMemberships.map((item) => (
                <div
                  key={item.membership.id}
                  className="flex items-center justify-between gap-md p-md rounded-md border border-warning-light bg-warning-light/20"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-text">
                      {item.profile.email}
                    </p>
                    <p className="text-xs text-secondary-text mt-xs">
                      Branch: {item.branch?.name || 'Unknown'} • Created by Branch Head
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApproveMembership(item.membership.id)}
                    className="flex-shrink-0"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-xs" />
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <button 
              className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
              aria-label="Add Product"
            >
              <CubeIcon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text">Add Product</p>
                <p className="text-xs text-secondary-text">Create new inventory item</p>
              </div>
            </button>
            <button 
              className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
              aria-label="Add Stock"
            >
              <ArrowTrendingUpIcon className="h-5 w-5 text-success shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text">Add Stock</p>
                <p className="text-xs text-secondary-text">Increase stock quantity</p>
              </div>
            </button>
            {canManageUsers(user) && (
              <button 
                onClick={() => setShowAddStaffForm(true)}
                className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
                aria-label="Add Staff"
              >
                <UserPlusIcon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-text">Add Staff</p>
                  <p className="text-xs text-secondary-text">
                    {user?.role === 'owner' ? 'Add staff member' : 'Request staff approval'}
                  </p>
                </div>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Form Modal */}
      {canManageUsers(user) && (
        <AddStaffForm
          isOpen={showAddStaffForm}
          onClose={() => setShowAddStaffForm(false)}
          onSuccess={() => {
            loadPendingMemberships()
          }}
        />
      )}
    </div>
  )
}

