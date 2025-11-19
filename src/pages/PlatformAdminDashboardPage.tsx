import { useEffect, useState } from 'react'
import { useRefresh } from '../contexts/RefreshContext'
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
  ChevronRightIcon,
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
    <div className="space-y-lg pt-sm">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 divide-x divide-neutral-200 border-b border-neutral-200 pb-md">
        <Link 
          to="/platform-admin/queue"
          className="flex flex-col items-center px-sm text-center group"
        >
          <span className="text-xs font-medium text-secondary-text mb-1 group-hover:text-primary transition-colors">Pending</span>
          <span className="text-2xl font-semibold text-primary-text">
            {stats?.pendingCount || 0}
          </span>
        </Link>

        <Link 
          to="/platform-admin/gst-verification"
          className="flex flex-col items-center px-sm text-center group"
        >
          <span className="text-xs font-medium text-secondary-text mb-1 group-hover:text-primary transition-colors">GST Verify</span>
          <span className="text-2xl font-semibold text-primary-text">
            {stats?.gstVerificationCount || 0}
          </span>
        </Link>

        <Link 
          to="/platform-admin/blocked-invoices"
          className="flex flex-col items-center px-sm text-center group"
        >
          <span className="text-xs font-medium text-secondary-text mb-1 group-hover:text-error transition-colors">Blocked</span>
          <span className="text-2xl font-semibold text-primary-text">
            {stats?.blockedInvoicesCount || 0}
          </span>
        </Link>
      </div>

      {/* Quick Actions - Horizontal Scroll */}
      <div className="space-y-sm">
        <h2 className="text-sm font-semibold text-primary-text px-xs">Quick Actions</h2>
        <div className="flex gap-md overflow-x-auto pb-sm px-xs -mx-xs scrollbar-hide">
          <Link
            to="/platform-admin/queue"
            className="flex flex-col items-center gap-xs min-w-[72px]"
          >
            <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-secondary-text hover:border-primary hover:text-primary transition-colors">
              <ClipboardDocumentCheckIcon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-secondary-text text-center leading-tight">Review<br/>Queue</span>
          </Link>

          <Link
            to="/platform-admin/hsn"
            className="flex flex-col items-center gap-xs min-w-[72px]"
          >
            <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-secondary-text hover:border-primary hover:text-primary transition-colors">
              <DocumentTextIcon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-secondary-text text-center leading-tight">HSN<br/>Manager</span>
          </Link>

          <Link
            to="/platform-admin/gst-verification"
            className="flex flex-col items-center gap-xs min-w-[72px]"
          >
            <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-secondary-text hover:border-primary hover:text-primary transition-colors">
              <BuildingOfficeIcon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-secondary-text text-center leading-tight">GST<br/>Verify</span>
          </Link>

          <Link
            to="/platform-admin/monitor"
            className="flex flex-col items-center gap-xs min-w-[72px]"
          >
            <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-secondary-text hover:border-primary hover:text-primary transition-colors">
              <ChartBarIcon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-secondary-text text-center leading-tight">Monitor</span>
          </Link>

          <Link
            to="/platform-admin/blocked-invoices"
            className="flex flex-col items-center gap-xs min-w-[72px]"
          >
            <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-secondary-text hover:border-error hover:text-error transition-colors">
              <ExclamationTriangleIcon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-secondary-text text-center leading-tight">Blocked</span>
          </Link>
        </div>
      </div>

      {/* Recent Submissions List */}
      {stats && stats.recentSubmissions.length > 0 && (
        <div className="space-y-sm">
          <div className="flex items-center justify-between px-xs">
            <h2 className="text-sm font-semibold text-primary-text">Recent Submissions</h2>
            <Link to="/platform-admin/queue" className="text-xs text-primary font-medium hover:underline">
              View All
            </Link>
          </div>
          
          <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
            {stats.recentSubmissions.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between py-md px-xs hover:bg-neutral-50 transition-colors cursor-default"
              >
                <div className="flex items-center gap-md min-w-0">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-secondary-text uppercase border border-neutral-200">
                    {product.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-text truncate max-w-[180px]">
                      {product.name}
                    </p>
                    <p className="text-xs text-secondary-text font-mono">
                      {product.sku}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-warning" />
                  <ChevronRightIcon className="h-4 w-4 text-neutral-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
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

