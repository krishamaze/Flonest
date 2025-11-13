import { useEffect, useState } from 'react'
import { useRefresh } from '../contexts/RefreshContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { getPendingReviews } from '../lib/api/master-product-review'
import { getBlockedInvoices } from '../lib/api/invoiceValidation'
import type { MasterProduct } from '../lib/api/master-products'
import {
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { Link, useLocation } from 'react-router-dom'
import { ReviewQueue } from '../components/reviewer/ReviewQueue'
import { HSNManager } from '../components/reviewer/HSNManager'
import { BlockedInvoices } from '../components/reviewer/BlockedInvoices'
import { SubmissionMonitor } from '../components/reviewer/SubmissionMonitor'

interface ReviewerStats {
  pendingCount: number
  blockedInvoicesCount: number
  recentSubmissions: MasterProduct[]
}

function ReviewerDashboardHome() {
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [stats, setStats] = useState<ReviewerStats | null>(null)
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

      // Get recent submissions (last 5)
      const recentSubmissions = pending.slice(0, 5)

      setStats({
        pendingCount: pending.length,
        blockedInvoicesCount,
        recentSubmissions,
      })
    } catch (error) {
      console.error('Error loading reviewer stats:', error)
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
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Reviewer Dashboard</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Manage product approvals and reviews
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-md">
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center gap-sm p-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning-light">
              <ClockIcon className="h-5 w-5 text-warning" />
            </div>
            <p className="text-xs font-medium text-secondary-text">Pending Reviews</p>
            <p className="text-2xl font-bold text-primary-text">
              {stats?.pendingCount || 0}
            </p>
            <Link
              to="/reviewer/queue"
              className="text-xs text-primary hover:underline"
            >
              View Queue →
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center gap-sm p-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-error-light">
              <ExclamationTriangleIcon className="h-5 w-5 text-error" />
            </div>
            <p className="text-xs font-medium text-secondary-text">Blocked Invoices</p>
            <p className="text-2xl font-bold text-primary-text">
              {stats?.blockedInvoicesCount || 0}
            </p>
            <Link
              to="/reviewer/blocked-invoices"
              className="text-xs text-primary hover:underline"
            >
              View Details →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-md pt-0">
          <div className="grid gap-md sm:grid-cols-2">
            <Link
              to="/reviewer/queue"
              className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
            >
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text">Review Queue</p>
                <p className="text-xs text-secondary-text">Approve or reject products</p>
              </div>
            </Link>
            <Link
              to="/reviewer/hsn"
              className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
            >
              <DocumentTextIcon className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text">HSN Manager</p>
                <p className="text-xs text-secondary-text">Manage HSN codes</p>
              </div>
            </Link>
            <Link
              to="/reviewer/blocked-invoices"
              className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
            >
              <ExclamationTriangleIcon className="h-5 w-5 text-error shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text">Blocked Invoices</p>
                <p className="text-xs text-secondary-text">View invoices with errors</p>
              </div>
            </Link>
            <Link
              to="/reviewer/monitor"
              className="flex items-center gap-md rounded-md border border-neutral-200 p-md text-left min-h-[44px] transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98]"
            >
              <ChartBarIcon className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text">Submission Monitor</p>
                <p className="text-xs text-secondary-text">Monitor submissions</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      {stats && stats.recentSubmissions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent className="p-md pt-0">
            <div className="space-y-sm">
              {stats.recentSubmissions.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-md border border-neutral-200 p-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-text truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-secondary-text">SKU: {product.sku}</p>
                  </div>
                  <span className="text-xs px-sm py-xs rounded-full bg-warning-light text-warning-dark">
                    Pending
                  </span>
                </div>
              ))}
            </div>
            <Link
              to="/reviewer/queue"
              className="mt-md block text-center text-sm text-primary hover:underline"
            >
              View All →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function ReviewerDashboardPage() {
  const location = useLocation()

  // If we're on a sub-route, render the appropriate component
  if (location.pathname === '/reviewer/queue') {
    return <ReviewQueue />
  }

  if (location.pathname === '/reviewer/hsn') {
    return <HSNManager />
  }

  if (location.pathname === '/reviewer/blocked-invoices') {
    return <BlockedInvoices />
  }

  if (location.pathname === '/reviewer/monitor') {
    return <SubmissionMonitor />
  }

  // Default: show dashboard home
  return <ReviewerDashboardHome />
}

