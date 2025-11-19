import { useEffect, useState } from 'react'
import { useRefresh } from '../contexts/RefreshContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { getPendingReviews } from '../lib/api/master-product-review'
import { getBlockedInvoices } from '../lib/api/invoiceValidation'
import { supabase } from '../lib/supabase'
import type { MasterProduct } from '../lib/api/master-products'
import {
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import { Link, useLocation } from 'react-router-dom'
import { ReviewQueue } from '../components/platformAdmin/ReviewQueue'
import { HSNManager } from '../components/platformAdmin/HSNManager'
import { BlockedInvoices } from '../components/platformAdmin/BlockedInvoices'
import { SubmissionMonitor } from '../components/platformAdmin/SubmissionMonitor'
import { GstVerificationQueue } from '../components/platformAdmin/GstVerificationQueue'

interface PlatformAdminStats {
  pendingCount: number
  blockedInvoicesCount: number
  gstVerificationCount: number
  recentSubmissions: MasterProduct[]
}

function PlatformAdminDashboardHome() {
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [stats, setStats] = useState<PlatformAdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    registerRefreshHandler(loadStats)
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler])

  const loadStats = async () => {
    try {
      // Get pending reviews
      const pending = await getPendingReviews()
      
      // Get blocked invoices count
      const blockedInvoices = await getBlockedInvoices()
      const blockedInvoicesCount = blockedInvoices.length

      // Get pending GST verifications
      const { count: gstCount, error: gstError } = await supabase
        .from('orgs')
        .select('*', { count: 'exact', head: true })
        .eq('gst_verification_status', 'unverified')
        .not('gst_number', 'is', null)

      if (gstError) console.error('Error fetching GST stats:', gstError)

      // Get recent submissions (last 5)
      const recentSubmissions = pending.slice(0, 5)

      setStats({
        pendingCount: pending.length,
        blockedInvoicesCount,
        gstVerificationCount: gstCount || 0,
        recentSubmissions,
      })
    } catch (error) {
      console.error('Error loading platform admin stats:', error)
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
    <div className="space-y-lg">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Platform Admin Dashboard</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Overview of pending tasks and system status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center gap-sm p-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning-light">
              <ClockIcon className="h-5 w-5 text-warning" />
            </div>
            <p className="text-xs font-medium text-secondary-text">Pending Reviews</p>
            <p className="text-2xl font-bold text-primary-text">
              {stats?.pendingCount || 0}
            </p>
            <Link
              to="/platform-admin/queue"
              className="text-xs text-primary hover:underline"
            >
              View Queue →
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center gap-sm p-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
              <BuildingOfficeIcon className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs font-medium text-secondary-text">GST Verifications</p>
            <p className="text-2xl font-bold text-primary-text">
              {stats?.gstVerificationCount || 0}
            </p>
            <Link
              to="/platform-admin/gst-verification"
              className="text-xs text-primary hover:underline"
            >
              Verify Now →
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center gap-sm p-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-error-light">
              <ExclamationTriangleIcon className="h-5 w-5 text-error" />
            </div>
            <p className="text-xs font-medium text-secondary-text">Blocked Invoices</p>
            <p className="text-2xl font-bold text-primary-text">
              {stats?.blockedInvoicesCount || 0}
            </p>
            <Link
              to="/platform-admin/blocked-invoices"
              className="text-xs text-primary hover:underline"
            >
              View Details →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-md">
        <h2 className="text-lg font-medium text-primary-text">Quick Actions</h2>
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/platform-admin/queue"
            className="group flex flex-col gap-sm rounded-lg border border-neutral-200 bg-white p-md transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-50 group-hover:bg-primary-light">
              <ClipboardDocumentCheckIcon className="h-4 w-4 text-secondary-text group-hover:text-primary" />
            </div>
            <div>
              <p className="font-medium text-primary-text">Review Queue</p>
              <p className="text-xs text-secondary-text mt-xxs">Approve product submissions</p>
            </div>
          </Link>

          <Link
            to="/platform-admin/hsn"
            className="group flex flex-col gap-sm rounded-lg border border-neutral-200 bg-white p-md transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-50 group-hover:bg-primary-light">
              <DocumentTextIcon className="h-4 w-4 text-secondary-text group-hover:text-primary" />
            </div>
            <div>
              <p className="font-medium text-primary-text">HSN Manager</p>
              <p className="text-xs text-secondary-text mt-xxs">Manage tax codes</p>
            </div>
          </Link>

          <Link
            to="/platform-admin/gst-verification"
            className="group flex flex-col gap-sm rounded-lg border border-neutral-200 bg-white p-md transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-50 group-hover:bg-primary-light">
              <BuildingOfficeIcon className="h-4 w-4 text-secondary-text group-hover:text-primary" />
            </div>
            <div>
              <p className="font-medium text-primary-text">GSTIN Verification</p>
              <p className="text-xs text-secondary-text mt-xxs">Verify organization GSTs</p>
            </div>
          </Link>

          <Link
            to="/platform-admin/monitor"
            className="group flex flex-col gap-sm rounded-lg border border-neutral-200 bg-white p-md transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-50 group-hover:bg-primary-light">
              <ChartBarIcon className="h-4 w-4 text-secondary-text group-hover:text-primary" />
            </div>
            <div>
              <p className="font-medium text-primary-text">Submission Monitor</p>
              <p className="text-xs text-secondary-text mt-xxs">View activity logs</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Submissions */}
      {stats && stats.recentSubmissions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Recent Submissions</CardTitle>
            <Link
              to="/platform-admin/queue"
              className="text-sm text-primary hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-neutral-100">
              {stats.recentSubmissions.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between px-md py-sm hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-start gap-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-neutral-100 text-xs font-medium text-secondary-text uppercase">
                      {product.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-text truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-xs text-xs text-secondary-text">
                        <span>SKU: {product.sku}</span>
                        {product.created_at && (
                          <>
                            <span>•</span>
                            <span>{new Date(product.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="ml-md shrink-0 rounded-full bg-warning-light px-sm py-xs text-xs font-medium text-warning-dark">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function PlatformAdminDashboardPage() {
  const location = useLocation()

  // If we're on a sub-route, render the appropriate component
  if (location.pathname === '/platform-admin/queue') {
    return <ReviewQueue />
  }

  if (location.pathname === '/platform-admin/gst-verification') {
    return <GstVerificationQueue />
  }

  if (location.pathname === '/platform-admin/hsn') {
    return <HSNManager />
  }

  if (location.pathname === '/platform-admin/blocked-invoices') {
    return <BlockedInvoices />
  }

  if (location.pathname === '/platform-admin/monitor') {
    return <SubmissionMonitor />
  }

  // Default: show dashboard home
  return <PlatformAdminDashboardHome />
}

