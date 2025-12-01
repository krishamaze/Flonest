import { usePurchaseBill } from '../../hooks/usePurchaseBill'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface PurchaseBillViewProps {
  billId: string
  orgId: string
  userId: string
  onClose?: () => void
}

export function PurchaseBillView({ billId, orgId, userId, onClose }: PurchaseBillViewProps) {
  const {
    bill,
    org,
    loading,
    actionLoading,
    error,
    loadBill,
    approveBill,
    postBill,
    revertToDraft
  } = usePurchaseBill(billId, orgId, userId)

  // Status-based action buttons
  const renderActionButtons = () => {
    if (!bill) return null

    switch (bill.status) {
      case 'draft':
        return (
          <div className="flex gap-4">
            <Button
              variant="primary"
              onClick={approveBill}
              disabled={actionLoading}
              isLoading={actionLoading}
            >
              Approve Bill
            </Button>
          </div>
        )

      case 'approved':
        return (
          <div className="flex gap-4">
            <Button
              variant="primary"
              onClick={postBill}
              disabled={actionLoading}
              isLoading={actionLoading}
            >
              Post to Inventory
            </Button>
          </div>
        )

      case 'posted':
        const postedDate = bill.posted_at
          ? new Date(bill.posted_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          : 'N/A'

        return (
          <div className="text-sm text-muted-text">
            ✓ Bill posted to inventory on {postedDate}
          </div>
        )

      case 'flagged_hsn_mismatch':
        const mismatchCount = bill.items?.filter((item: any) => item.hsn_mismatch === true).length || 0
        return (
          <div className="space-y-2">
            <div className="text-sm text-warning">
              ⚠ HSN mismatch detected in {mismatchCount} item(s). Bills with HSN mismatches cannot be posted to inventory.
            </div>
            <div className="text-xs text-secondary-text">
              Revert to draft to edit vendor HSN codes, then approve again.
            </div>
            <Button
              variant="primary"
              onClick={revertToDraft}
              disabled={actionLoading}
              isLoading={actionLoading}
            >
              Revert to Draft
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'bg-neutral-100 text-neutral-700' },
      approved: { label: 'Approved', className: 'bg-blue-100 text-blue-700' },
      posted: { label: 'Posted', className: 'bg-green-100 text-green-700' },
      flagged_hsn_mismatch: { label: 'HSN Mismatch', className: 'bg-yellow-100 text-yellow-700' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: 'bg-neutral-100 text-neutral-700',
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !bill) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-error mb-4">{error}</p>
            <Button onClick={loadBill}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!bill || !org) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-secondary-text">Purchase bill not found</p>
        </CardContent>
      </Card>
    )
  }

  const billDate = bill.bill_date
    ? new Date(bill.bill_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : 'N/A'

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-text">
            Purchase Bill #{bill.bill_number}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-secondary-text">
              {billDate}
            </p>
            {getStatusBadge(bill.status)}
          </div>
        </div>
        <div className="flex gap-2">
          {onClose && (
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card>
          <CardContent className="p-4 bg-error/10 border border-error rounded">
            <p className="text-error text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Bill Details */}
      <Card>
        <CardHeader>
          <CardTitle>Bill Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vendor Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">Vendor</h3>
              <div className="text-sm space-y-1">
                {bill.vendor_name && (
                  <p className="font-medium">{bill.vendor_name}</p>
                )}
                {bill.vendor_gstin && (
                  <p className="text-secondary-text">GSTIN: {bill.vendor_gstin}</p>
                )}
                {bill.vendor_state_code && (
                  <p className="text-secondary-text">State Code: {bill.vendor_state_code}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Organization</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{org.name}</p>
                {org.address && <p className="text-secondary-text">{org.address}</p>}
                {org.gst_number && (
                  <p className="text-secondary-text">GSTIN: {org.gst_number}</p>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Items</h3>
            <div className="border border-neutral-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left p-2 border-b">Description</th>
                    <th className="text-right p-2 border-b">Qty</th>
                    <th className="text-right p-2 border-b">Rate</th>
                    <th className="text-right p-2 border-b">HSN</th>
                    <th className="text-right p-2 border-b">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items?.map((item, index) => {
                    const product = (item as any).product
                    const productName =
                      product?.name ||
                      product?.master_product?.name ||
                      item.description ||
                      'Unknown Product'

                    // Check for HSN mismatch
                    const hasMismatch = (item as any).hsn_mismatch === true
                    const matchStatus = (item as any).hsn_match_status
                    const systemHsn = product?.hsn_sac_code || product?.master_product?.hsn_code || null

                    return (
                      <tr
                        key={item.id || index}
                        className={`border-b ${hasMismatch ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{productName}</div>
                            {hasMismatch && (
                              <div className="text-xs text-warning mt-1">
                                ⚠ HSN Mismatch: Vendor ({item.vendor_hsn_code}) vs System ({systemHsn || 'N/A'})
                              </div>
                            )}
                            {matchStatus === 'match' && (
                              <div className="text-xs text-green-600 mt-1">
                                ✓ HSN Verified
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2 text-right">
                          ₹{item.unit_price.toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          <div className={hasMismatch ? 'text-warning font-medium' : 'text-secondary-text'}>
                            {item.vendor_hsn_code || '-'}
                          </div>
                          {systemHsn && (
                            <div className="text-xs text-muted-text">
                              System: {systemHsn}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          ₹{item.total_amount?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-text">Total Amount</span>
                <span className="font-medium">
                  ₹{bill.total_amount?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {bill.notes && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Notes</h3>
              <p className="text-sm text-secondary-text">{bill.notes}</p>
            </div>
          )}

          {/* Workflow Actions */}
          <div className="pt-4 border-t border-neutral-200">
            {renderActionButtons()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
