import { Modal } from '../ui/Modal'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import type { BlockedInvoice } from '../../lib/api/invoiceValidation'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

interface BlockedInvoiceDetailsProps {
  isOpen: boolean
  onClose: () => void
  blockedInvoice: BlockedInvoice
}

export function BlockedInvoiceDetails({
  isOpen,
  onClose,
  blockedInvoice,
}: BlockedInvoiceDetailsProps) {
  const { invoice, errors } = blockedInvoice

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case 'product_not_approved':
        return 'Product Not Approved'
      case 'missing_hsn':
        return 'Missing HSN Code'
      case 'invalid_hsn':
        return 'Invalid HSN Code'
      case 'product_not_found':
        return 'Product Not Found'
      default:
        return type
    }
  }

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'product_not_approved':
        return 'bg-warning-light text-warning-dark border-warning'
      case 'missing_hsn':
        return 'bg-error-light text-error-dark border-error'
      case 'invalid_hsn':
        return 'bg-error-light text-error-dark border-error'
      case 'product_not_found':
        return 'bg-error-light text-error-dark border-error'
      default:
        return 'bg-neutral-100 text-secondary-text border-neutral-200'
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Blocked Invoice Details" className="max-w-2xl">
      <div className="space-y-lg max-h-[80vh] overflow-y-auto">
        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-sm">
            <div>
              <p className="text-sm text-secondary-text">Invoice Number</p>
              <p className="text-base font-medium text-primary-text">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-sm text-secondary-text">Organization ID</p>
              <p className="text-base font-medium text-primary-text">{invoice.org_id}</p>
            </div>
            <div>
              <p className="text-sm text-secondary-text">Status</p>
              <p className="text-base font-medium text-primary-text capitalize">{invoice.status}</p>
            </div>
            <div>
              <p className="text-sm text-secondary-text">Created</p>
              <p className="text-base font-medium text-primary-text">
                {new Date(invoice.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary-text">Total Amount</p>
              <p className="text-base font-medium text-primary-text">
                ₹{invoice.total_amount?.toLocaleString() || '0.00'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Validation Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-sm">
              <ExclamationTriangleIcon className="h-5 w-5 text-error" />
              Validation Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-sm">
              {errors.map((error, idx) => (
                <div
                  key={idx}
                  className={`border-l-4 rounded-md p-md ${getErrorTypeColor(error.type)}`}
                >
                  <div className="flex items-start justify-between gap-sm mb-xs">
                    <p className="font-semibold">{getErrorTypeLabel(error.type)}</p>
                    <span className="text-xs opacity-75">Item #{error.item_index}</span>
                  </div>
                  <p className="text-sm mb-xs">{error.message}</p>
                  {error.product_id && (
                    <p className="text-xs opacity-75">Product ID: {error.product_id}</p>
                  )}
                  {error.master_product_id && (
                    <div className="mt-xs">
                      <Link
                        to={`/reviewer/queue`}
                        className="text-xs text-primary hover:underline"
                        onClick={onClose}
                      >
                        Review Product →
                      </Link>
                    </div>
                  )}
                  {error.hsn_code && (
                    <div className="mt-xs">
                      <Link
                        to={`/reviewer/hsn`}
                        className="text-xs text-primary hover:underline"
                        onClick={onClose}
                      >
                        Manage HSN Codes →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <Card>
          <CardContent className="p-md">
            <p className="text-sm text-secondary-text">
              To fix these errors:
            </p>
            <ul className="list-disc list-inside space-y-xs text-sm text-secondary-text mt-sm">
              <li>Approve products that are pending review</li>
              <li>Add HSN codes to products that are missing them</li>
              <li>Ensure HSN codes exist in the HSN master table</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Modal>
  )
}

