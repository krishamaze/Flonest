/**
 * Invoice View Component
 * 
 * Displays finalized invoices with GST-compliant formatting
 * Includes print/PDF export functionality
 */

import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getInvoiceById, postSalesInvoice } from '../../lib/api/invoices'
import { getOrgById } from '../../lib/api/orgs'
import { printInvoice } from '../../lib/utils/invoicePDFGenerator'
import type { Invoice } from '../../types'
import type { Org } from '../../types'
import type { CustomerWithMaster } from '../../types'
import type { ProductWithMaster } from '../../types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface InvoiceViewProps {
  invoiceId: string
  orgId: string
  userId: string
  onClose?: () => void
}

interface InvoiceWithDetails extends Invoice {
  items: Array<{
    id: string
    product_id: string
    quantity: number
    unit: string
    unit_price: number
    total_amount: number
    description?: string | null
    product?: ProductWithMaster
  }>
  customer?: CustomerWithMaster
}

export function InvoiceView({ invoiceId, orgId, userId, onClose }: InvoiceViewProps) {
  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInvoice()
  }, [invoiceId, orgId])

  const loadInvoice = async () => {
    try {
      setLoading(true)
      setError(null)

      const [invoiceData, orgData] = await Promise.all([
        getInvoiceById(invoiceId),
        getOrgById(orgId),
      ])

      setInvoice(invoiceData as InvoiceWithDetails)
      setOrg(orgData)
    } catch (err) {
      console.error('Error loading invoice:', err)
      setError(err instanceof Error ? err.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!invoice || !org || !invoice.customer) {
      return
    }

    printInvoice(invoice, org, invoice.customer)
  }

  // Removed unused handleDownloadPDF function
  // const handleDownloadPDF = () => {
  //   if (!invoice || !org || !invoice.customer) {
  //     return
  //   }
  //   downloadInvoicePDF(invoice, org, invoice.customer)
  // }

  // POST ACTION: finalized → posted (calls RPC for atomic stock deduction)
  const handlePost = async () => {
    if (!invoice || invoice.status !== 'finalized') return

    try {
      setActionLoading(true)
      setError(null)
      
      await postSalesInvoice(invoiceId, orgId, userId)
      
      // Reload invoice to get updated status
      await loadInvoice()
      
      toast.success('Invoice posted to inventory successfully. Stock has been deducted.')
    } catch (err) {
      // Error message is already translated by getUserFriendlyError in API
      const errorMessage = err instanceof Error ? err.message : 'Failed to post invoice'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  // Status-based action buttons
  const renderActionButtons = () => {
    if (!invoice) return null

    switch (invoice.status) {
      case 'draft':
        return (
          <div className="text-sm text-secondary-text">
            Finalize the invoice to enable posting to inventory.
          </div>
        )

      case 'finalized':
        return (
          <div className="space-y-2">
            <Button
              variant="primary"
              onClick={handlePost}
              disabled={actionLoading}
              isLoading={actionLoading}
            >
              Post to Inventory
            </Button>
            <div className="text-xs text-secondary-text">
              This will deduct stock from inventory and mark the invoice as posted.
            </div>
          </div>
        )

      case 'posted':
        return (
          <div className="text-sm text-success">
            ✓ Invoice posted to inventory on{' '}
            {invoice.updated_at
              ? new Date(invoice.updated_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'N/A'}
          </div>
        )

      case 'cancelled':
        return (
          <div className="text-sm text-error">
            This invoice has been cancelled and cannot be posted.
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-error mb-4">{error}</p>
            <Button onClick={loadInvoice}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!invoice || !org) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-secondary-text">Invoice not found</p>
        </CardContent>
      </Card>
    )
  }

  const invoiceDate = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('en-IN', {
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
            Invoice #{invoice.invoice_number}
          </h2>
          <p className="text-sm text-secondary-text mt-1">
            {invoiceDate} • <span className="capitalize">{invoice.status}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="primary">
            Print / PDF
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {error && (
        <Card>
          <CardContent className="p-4">
            <div className="text-error text-sm">{error}</div>
          </CardContent>
        </Card>
      )}

      {renderActionButtons() && (
        <Card>
          <CardContent className="p-4">
            {renderActionButtons()}
          </CardContent>
        </Card>
      )}

      {/* Invoice Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">Sold By</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{org.name}</p>
                {org.address && <p className="text-secondary-text">{org.address}</p>}
                {org.gst_number && (
                  <p className="text-secondary-text">GSTIN: {org.gst_number}</p>
                )}
                {org.tax_identifier && (
                  <p className="text-secondary-text">PAN: {org.tax_identifier}</p>
                )}
              </div>
            </div>

            {invoice.customer && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Bill To</h3>
                <div className="text-sm space-y-1">
                  <p className="font-medium">
                    {invoice.customer.master_customer?.legal_name ||
                      invoice.customer.alias_name ||
                      'N/A'}
                  </p>
                  {(invoice.customer.billing_address ||
                    invoice.customer.master_customer?.address) && (
                    <p className="text-secondary-text">
                      {invoice.customer.billing_address ||
                        invoice.customer.master_customer?.address}
                    </p>
                  )}
                  {(invoice.customer.gst_number ||
                    invoice.customer.master_customer?.gstin) && (
                    <p className="text-secondary-text">
                      GSTIN:{' '}
                      {invoice.customer.gst_number ||
                        invoice.customer.master_customer?.gstin}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Items</h3>
            <div className="border border-neutral-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left p-2 border-b">Description</th>
                    <th className="text-right p-2 border-b">Qty</th>
                    <th className="text-right p-2 border-b">Rate</th>
                    <th className="text-right p-2 border-b">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => {
                    const product = item.product as ProductWithMaster | undefined
                    const productName =
                      product?.name || product?.master_product?.name || 'Unknown Product'

                    return (
                      <tr key={item.id || index} className="border-b">
                        <td className="p-2">{productName}</td>
                        <td className="p-2 text-right">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2 text-right">
                          ₹{item.unit_price.toFixed(2)}
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
                <span className="text-secondary-text">Subtotal</span>
                <span className="font-medium">
                  ₹{invoice.subtotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              {invoice.cgst_amount && invoice.cgst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-text">CGST</span>
                  <span className="font-medium">
                    ₹{invoice.cgst_amount.toFixed(2)}
                  </span>
                </div>
              )}
              {invoice.sgst_amount && invoice.sgst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-text">SGST</span>
                  <span className="font-medium">
                    ₹{invoice.sgst_amount.toFixed(2)}
                  </span>
                </div>
              )}
              {invoice.igst_amount && invoice.igst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-text">IGST</span>
                  <span className="font-medium">
                    ₹{invoice.igst_amount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-neutral-200">
                <span>Total</span>
                <span>₹{invoice.total_amount?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

