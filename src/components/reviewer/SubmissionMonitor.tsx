import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { getRecentSubmissions, getSubmissionStats, getSubmissionAnomalies } from '../../lib/api/submissions'
import type { MasterProduct } from '../../lib/api/master-products'
import type { SubmissionStats, SubmissionAnomaly } from '../../lib/api/submissions'
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export function SubmissionMonitor() {
  const [recentSubmissions, setRecentSubmissions] = useState<MasterProduct[]>([])
  const [stats, setStats] = useState<SubmissionStats | null>(null)
  const [anomalies, setAnomalies] = useState<SubmissionAnomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<7 | 30>(7)

  useEffect(() => {
    loadData()
  }, [timeRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const [submissions, submissionStats, submissionAnomalies] = await Promise.all([
        getRecentSubmissions(timeRange),
        getSubmissionStats(timeRange),
        getSubmissionAnomalies(),
      ])
      setRecentSubmissions(submissions)
      setStats(submissionStats)
      setAnomalies(submissionAnomalies)
    } catch (error) {
      console.error('Error loading submission data:', error)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary-text">Submission Monitor</h1>
          <p className="mt-xs text-sm text-secondary-text">
            Monitor product submissions and detect anomalies
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => setTimeRange(7)}
            className={`px-md py-sm text-sm font-medium rounded-md transition-colors ${
              timeRange === 7
                ? 'bg-primary text-on-primary'
                : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange(30)}
            className={`px-md py-sm text-sm font-medium rounded-md transition-colors ${
              timeRange === 30
                ? 'bg-primary text-on-primary'
                : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-sm p-md">
              <ChartBarIcon className="h-5 w-5 text-primary" />
              <p className="text-xs font-medium text-secondary-text">Total</p>
              <p className="text-2xl font-bold text-primary-text">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-sm p-md">
              <ClockIcon className="h-5 w-5 text-warning" />
              <p className="text-xs font-medium text-secondary-text">Pending</p>
              <p className="text-2xl font-bold text-primary-text">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-sm p-md">
              <CheckCircleIcon className="h-5 w-5 text-success" />
              <p className="text-xs font-medium text-secondary-text">Approved</p>
              <p className="text-2xl font-bold text-primary-text">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-sm p-md">
              <XCircleIcon className="h-5 w-5 text-error" />
              <p className="text-xs font-medium text-secondary-text">Rejected</p>
              <p className="text-2xl font-bold text-primary-text">{stats.rejected}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-sm">
              <ExclamationTriangleIcon className="h-5 w-5 text-warning" />
              Anomalies Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-sm">
              {anomalies.map((anomaly, idx) => (
                <div
                  key={idx}
                  className="border border-warning rounded-md p-md bg-warning-light/10"
                >
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary-text mb-xs">
                        {anomaly.type === 'high_volume' ? 'High Volume Submission' : 'Duplicate Submission'}
                      </p>
                      <p className="text-sm text-secondary-text">{anomaly.description}</p>
                      {anomaly.org_id && (
                        <p className="text-xs text-muted-text mt-xs">Org ID: {anomaly.org_id}</p>
                      )}
                    </div>
                    <span className="px-sm py-xs rounded-full bg-warning text-on-primary text-xs font-medium">
                      {anomaly.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions ({timeRange} days)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSubmissions.length === 0 ? (
            <p className="text-sm text-secondary-text text-center p-md">
              No submissions in the last {timeRange} days
            </p>
          ) : (
            <div className="space-y-sm">
              {recentSubmissions.slice(0, 10).map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between rounded-md border border-neutral-200 p-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-text truncate">
                      {submission.name}
                    </p>
                    <p className="text-xs text-secondary-text">SKU: {submission.sku}</p>
                    <p className="text-xs text-muted-text">
                      {new Date(submission.created_at || '').toLocaleString()}
                    </p>
                  </div>
                  {getStatusBadge(submission.approval_status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

