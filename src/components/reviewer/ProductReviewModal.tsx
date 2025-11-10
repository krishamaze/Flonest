import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ReviewActions } from './ReviewActions'
import { getMasterProductReviews } from '../../lib/api/master-product-review'
import { useAuth } from '../../contexts/AuthContext'
import type { MasterProduct } from '../../lib/api/master-products'
import type { MasterProductReview } from '../../lib/api/master-product-review'
import { ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface ProductReviewModalProps {
  isOpen: boolean
  onClose: () => void
  product: MasterProduct
}

export function ProductReviewModal({ isOpen, onClose, product }: ProductReviewModalProps) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<MasterProductReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)

  useEffect(() => {
    if (isOpen && product.id) {
      loadReviews()
    }
  }, [isOpen, product.id])

  const loadReviews = async () => {
    setLoadingReviews(true)
    try {
      const reviewHistory = await getMasterProductReviews(product.id)
      setReviews(reviewHistory)
    } catch (error) {
      console.error('Error loading review history:', error)
    } finally {
      setLoadingReviews(false)
    }
  }

  const handleReviewComplete = () => {
    onClose()
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircleIcon className="h-4 w-4 text-success" />
      case 'rejected':
        return <XCircleIcon className="h-4 w-4 text-error" />
      default:
        return <ClockIcon className="h-4 w-4 text-warning" />
    }
  }

  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Product" className="max-w-2xl">
      <div className="space-y-lg max-h-[80vh] overflow-y-auto">
        {/* Product Details */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-sm">
            <div>
              <p className="text-sm text-secondary-text">Name</p>
              <p className="text-base font-medium text-primary-text">{product.name}</p>
            </div>
            <div>
              <p className="text-sm text-secondary-text">SKU</p>
              <p className="text-base font-medium text-primary-text">{product.sku}</p>
            </div>
            {product.barcode_ean && (
              <div>
                <p className="text-sm text-secondary-text">Barcode/EAN</p>
                <p className="text-base font-medium text-primary-text">{product.barcode_ean}</p>
              </div>
            )}
            {product.category && (
              <div>
                <p className="text-sm text-secondary-text">Category</p>
                <p className="text-base font-medium text-primary-text">{product.category}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-secondary-text">Unit</p>
              <p className="text-base font-medium text-primary-text">{product.base_unit}</p>
            </div>
            {product.base_price && (
              <div>
                <p className="text-sm text-secondary-text">Base Price</p>
                <p className="text-base font-medium text-primary-text">₹{product.base_price.toLocaleString()}</p>
              </div>
            )}
            {product.hsn_code && (
              <div>
                <p className="text-sm text-secondary-text">HSN Code</p>
                <p className="text-base font-medium text-primary-text">{product.hsn_code}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-secondary-text">Status</p>
              <p className="text-base font-medium text-primary-text capitalize">{product.approval_status}</p>
            </div>
            {product.rejection_reason && (
              <div>
                <p className="text-sm text-secondary-text">Rejection Reason</p>
                <p className="text-base font-medium text-error">{product.rejection_reason}</p>
              </div>
            )}
            {product.submitted_org_id && (
              <div>
                <p className="text-sm text-secondary-text">Submitted</p>
                <p className="text-base font-medium text-primary-text">
                  {new Date(product.created_at || '').toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Actions */}
        {(product.approval_status === 'pending' || product.approval_status === 'auto_pass') && (
          <Card>
            <CardHeader>
              <CardTitle>Review Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewActions
                product={product}
                reviewerId={user.id}
                onReviewComplete={handleReviewComplete}
              />
            </CardContent>
          </Card>
        )}

        {/* Review History */}
        <Card>
          <CardHeader>
            <CardTitle>Review History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReviews ? (
              <div className="flex justify-center p-md">
                <LoadingSpinner size="sm" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-secondary-text text-center p-md">
                No review history available
              </p>
            ) : (
              <div className="space-y-sm">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border border-neutral-200 rounded-md p-sm"
                  >
                    <div className="flex items-start gap-sm">
                      {getActionIcon(review.action)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-sm mb-xs">
                          <p className="text-sm font-medium text-primary-text capitalize">
                            {review.action.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-text">
                            {new Date(review.reviewed_at).toLocaleString()}
                          </p>
                        </div>
                        {review.note && (
                          <p className="text-sm text-secondary-text mb-xs">{review.note}</p>
                        )}
                        {review.field_changes && Object.keys(review.field_changes).length > 0 && (
                          <div className="text-xs text-muted-text">
                            <p className="font-medium mb-xs">Changes:</p>
                            <ul className="list-disc list-inside space-y-xs">
                              {Object.entries(review.field_changes).map(([key, value]) => (
                                <li key={key}>
                                  {key}: {String(value)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Modal>
  )
}

