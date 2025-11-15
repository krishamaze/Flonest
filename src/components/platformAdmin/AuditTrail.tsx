import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { getMasterProductReviews } from '../../lib/api/master-product-review'
import type { MasterProductReview } from '../../lib/api/master-product-review'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface AuditTrailProps {
  masterProductId: string
  showTitle?: boolean
}

export function AuditTrail({ masterProductId, showTitle = true }: AuditTrailProps) {
  const [reviews, setReviews] = useState<MasterProductReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReviews()
  }, [masterProductId])

  const loadReviews = async () => {
    setLoading(true)
    try {
      const reviewHistory = await getMasterProductReviews(masterProductId)
      setReviews(reviewHistory)
    } catch (error) {
      console.error('Error loading review history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-success" />
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-error" />
      case 'edited':
        return <PencilIcon className="h-5 w-5 text-primary" />
      default:
        return <ClockIcon className="h-5 w-5 text-warning" />
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'submitted':
        return 'Submitted for Review'
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'edited':
        return 'Edited & Approved'
      case 'auto_passed':
        return 'Auto-Approved'
      case 'migrated':
        return 'Migrated'
      default:
        return action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-md text-center">
          <p className="text-sm text-secondary-text">No review history available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? '' : 'p-md'}>
        <div className="space-y-md">
          {reviews.map((review, idx) => (
            <div
              key={review.id}
              className={`relative ${idx < reviews.length - 1 ? 'pb-md border-l-2 border-neutral-200 pl-md' : 'pl-md'}`}
            >
              {idx < reviews.length - 1 && (
                <div className="absolute -left-[5px] top-0 h-3 w-3 rounded-full bg-neutral-200"></div>
              )}
              <div className="flex items-start gap-sm">
                <div className="flex-shrink-0 mt-xs">
                  {getActionIcon(review.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-sm mb-xs">
                    <p className="text-sm font-semibold text-primary-text">
                      {getActionLabel(review.action)}
                    </p>
                    {review.previous_approval_status && review.new_approval_status && (
                      <div className="flex items-center gap-xs text-xs text-muted-text">
                        <span className="px-sm py-xs rounded bg-neutral-100">
                          {review.previous_approval_status}
                        </span>
                        <ArrowRightIcon className="h-3 w-3" />
                        <span className="px-sm py-xs rounded bg-primary-light text-on-primary">
                          {review.new_approval_status}
                        </span>
                      </div>
                    )}
                  </div>
                  {review.note && (
                    <p className="text-sm text-secondary-text mb-xs">{review.note}</p>
                  )}
                  {review.field_changes && Object.keys(review.field_changes).length > 0 && (
                    <div className="text-xs text-muted-text mb-xs">
                      <p className="font-medium mb-xs">Field Changes:</p>
                      <ul className="list-disc list-inside space-y-xs">
                        {Object.entries(review.field_changes).map(([key, value]) => (
                          <li key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-text">
                    {new Date(review.reviewed_at).toLocaleString()}
                    {review.reviewed_by && ` • Reviewed by: ${review.reviewed_by}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

