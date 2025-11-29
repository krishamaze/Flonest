import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
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
import { canManageOrgSettings, canManageUsers, canAccessAgentPortal } from '../lib/permissions'
import { toast } from 'react-toastify'
import { AddAdvisorForm } from '../components/advisors/AddAdvisorForm'
import { BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import {
  useDashboardStats,
  usePendingMemberships,
  useApproveMembership,
} from '../hooks/useDashboard'
import { WelcomeOfferPanel } from '../components/dashboard/WelcomeOfferPanel'

export function DashboardPage() {
  const { user, currentOrg } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [showAddAdvisorForm, setShowAddAdvisorForm] = useState(false)

  // React Query hooks - parallel queries eliminate loading waterfalls
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats(user?.orgId)
  const { data: pendingMemberships = [], isLoading: membershipsLoading } = usePendingMemberships(
    user?.orgId,
    canManageOrgSettings(user)
  )
  const approveMutation = useApproveMembership()

  // Show error toast if stats query fails
  useEffect(() => {
    if (statsError) {
      console.error('Error loading dashboard stats:', statsError)
    }
  }, [statsError])

  const handleApproveMembership = async (membershipId: string) => {
    if (!user?.orgId) return

    try {
      // OPTIMISTIC UPDATE: Mutation removes membership from cache immediately
      await approveMutation.mutateAsync({
        membershipId,
        orgId: user.orgId,
      })
      toast.success('Membership approved successfully')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Failed to approve membership')
    }
  }

  // Register refresh handler for pull-to-refresh using React Query refetch
  useEffect(() => {
    const refreshHandler = async () => {
      // Refetch all dashboard-related queries in parallel
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['dashboard-stats', user?.orgId] }),
        queryClient.refetchQueries({ queryKey: ['pending-memberships', user?.orgId] }),
      ])
    }
    registerRefreshHandler(refreshHandler)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, queryClient, user?.orgId])

  // BUGFIX: Ensure page is visible on mount (prevent blank screen from stuck transitions)
  useEffect(() => {
    // Reset any stuck CSS states that might cause blank screen
    const resetVisibility = () => {
      document.body.style.display = 'block'
      document.body.style.visibility = 'visible'
    }

    resetVisibility()

    // Also reset after a brief delay to catch any late-applying styles
    const timer = setTimeout(resetVisibility, 100)
    return () => clearTimeout(timer)
  }, [])

  const loading = statsLoading || membershipsLoading

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-lg">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-text leading-tight">Dashboard</h1>
        <p className="mt-xs text-sm text-secondary-text leading-relaxed">
          Welcome back, {user?.email}
        </p>
      </div>

      {/* Welcome Offer Panel - Only show for org owners */}
      {user && !user.platformAdmin && user.role === 'org_owner' && (
        <WelcomeOfferPanel
          tenantName={currentOrg?.orgName}
          onUpgrade={() => navigate('/settings?tab=billing')}
        />
      )}

      {/* Stats Cards - compact horizontal layout */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-start gap-1 p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-light mb-xs">
              <CubeIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] font-medium text-secondary-text leading-tight">Total Products</p>
            <p className="text-lg font-bold text-primary-text">
              {stats?.totalProducts || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-start gap-1 p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-light mb-xs">
              <ExclamationTriangleIcon className="h-4 w-4 text-warning" />
            </div>
            <p className="text-[10px] font-medium text-secondary-text leading-tight">Low Stock</p>
            <p className="text-lg font-bold text-primary-text">
              {stats?.lowStockItems || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-start gap-1 p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-success-light mb-xs">
              <ArrowTrendingUpIcon className="h-4 w-4 text-success" />
            </div>
            <p className="text-[10px] font-medium text-secondary-text leading-tight">Total Value</p>
            <p className="text-lg font-bold text-primary-text">
              ₹{stats?.totalValue ? stats.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-start gap-1 p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-100 mb-xs">
              <ArrowTrendingDownIcon className="h-4 w-4 text-secondary-text" />
            </div>
            <p className="text-[10px] font-medium text-secondary-text leading-tight">Total Invoices</p>
            <p className="text-lg font-bold text-primary-text">
              {stats?.totalInvoices || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-start gap-1 p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-success-light mb-xs">
              <ArrowTrendingUpIcon className="h-4 w-4 text-success" />
            </div>
            <p className="text-[10px] font-medium text-secondary-text leading-tight">Finalized Drafts</p>
            <p className="text-lg font-bold text-primary-text">
              {stats?.finalizedDrafts || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals (Admin only) */}
      {canManageOrgSettings(user) && pendingMemberships.length > 0 && (
        <Card className="shadow-sm border-warning">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-sm">
              <ExclamationTriangleIcon className="h-5 w-5 text-warning" />
              Pending Advisor Approvals ({pendingMemberships.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-md pt-0">
            <div className="space-y-lg">
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
        <CardContent className="p-md pt-0">
          <div className="grid gap-md sm:grid-cols-2">
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
                onClick={() => setShowAddAdvisorForm(true)}
                className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
                aria-label="Add Staff"
              >
                <UserPlusIcon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-text">Add Advisor</p>
                  <p className="text-xs text-secondary-text">
                    {user?.role === 'org_owner' ? 'Add advisor' : 'Request advisor approval'}
                  </p>
                </div>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Portal Card (if user has agent access) */}
      {canAccessAgentPortal(user) && (
        <Card className="shadow-md border-primary">
          <CardContent className="p-md">
            <button
              onClick={() => navigate('/role-selector')}
              className="w-full flex items-center gap-md p-md rounded-lg bg-primary/10 border-2 border-primary hover:bg-primary/20 transition-all"
            >
              <BuildingOfficeIcon className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-base font-bold text-text-primary">Agent Portal</p>
                <p className="text-sm text-text-secondary">
                  Manage deliveries for partner businesses
                </p>
              </div>
              <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Add Staff Form Modal */}
      {canManageUsers(user) && (
        <AddAdvisorForm
          isOpen={showAddAdvisorForm}
          onClose={() => setShowAddAdvisorForm(false)}
          onSuccess={() => {
            // Mutation already invalidates pending-memberships cache
          }}
        />
      )}
    </div>
  )
}

