import { useEffect, useState } from 'react'
import { Card, CardContent } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Input } from '../ui/Input'
import { getBlockedInvoices } from '../../lib/api/invoiceValidation'
import type { BlockedInvoice } from '../../lib/api/invoiceValidation'
import { ExclamationTriangleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { BlockedInvoiceDetails } from './BlockedInvoiceDetails'

export function BlockedInvoices() {
  const [blockedInvoices, setBlockedInvoices] = useState<BlockedInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<BlockedInvoice | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [orgFilter, setOrgFilter] = useState('')

  useEffect(() => {
    loadBlockedInvoices()
  }, [])

  const loadBlockedInvoices = async () => {
    setLoading(true)
    try {
      const invoices = await getBlockedInvoices()
      setBlockedInvoices(invoices)
    } catch (error) {
      console.error('Error loading blocked invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceClick = (invoice: BlockedInvoice) => {
    setSelectedInvoice(invoice)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedInvoice(null)
    loadBlockedInvoices() // Reload in case issues were fixed
  }

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
        return 'bg-warning-light text-warning-dark'
      case 'missing_hsn':
        return 'bg-error-light text-error-dark'
      case 'invalid_hsn':
        return 'bg-error-light text-error-dark'
      case 'product_not_found':
        return 'bg-error-light text-error-dark'
      default:
        return 'bg-neutral-100 text-secondary-text'
    }
  }

  const filteredInvoices = orgFilter
    ? blockedInvoices.filter(inv => 
        inv.invoice.org_id?.toLowerCase().includes(orgFilter.toLowerCase())
      )
    : blockedInvoices

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
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Blocked Invoices</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Invoices that cannot be finalized due to validation errors
        </p>
      </div>

      {/* Filter */}
      <div>
        <Input
          type="text"
          placeholder="Filter by org ID..."
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        />
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="p-xl text-center">
            <p className="text-secondary-text">
              {orgFilter ? 'No blocked invoices found for this org.' : 'No blocked invoices found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-sm">
          {filteredInvoices.map((blockedInvoice) => (
            <Card
              key={blockedInvoice.invoice.id}
              onClick={() => handleInvoiceClick(blockedInvoice)}
              className="cursor-pointer"
            >
              <CardContent className="p-md">
                <div className="flex items-start justify-between gap-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm mb-xs">
                      <ExclamationTriangleIcon className="h-5 w-5 text-error flex-shrink-0" />
                      <h3 className="text-base font-semibold text-primary-text">
                        Invoice {blockedInvoice.invoice.invoice_number}
                      </h3>
                      <span className="px-sm py-xs rounded-full bg-error-light text-error-dark text-xs font-medium">
                        {blockedInvoice.errors.length} error{blockedInvoice.errors.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-xs text-sm text-secondary-text">
                      <p>Org ID: {blockedInvoice.invoice.org_id || 'N/A'}</p>
                      <p>Created: {blockedInvoice.invoice.created_at ? new Date(blockedInvoice.invoice.created_at).toLocaleString() : 'N/A'}</p>
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {blockedInvoice.errors.slice(0, 3).map((error, idx) => (
                          <span
                            key={idx}
                            className={`px-sm py-xs rounded-full text-xs font-medium ${getErrorTypeColor(error.type)}`}
                          >
                            {getErrorTypeLabel(error.type)}
                          </span>
                        ))}
                        {blockedInvoice.errors.length > 3 && (
                          <span className="px-sm py-xs rounded-full bg-neutral-100 text-secondary-text text-xs font-medium">
                            +{blockedInvoice.errors.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-muted-text flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedInvoice && (
        <BlockedInvoiceDetails
          isOpen={isModalOpen}
          onClose={handleModalClose}
          blockedInvoice={selectedInvoice}
        />
      )}
    </div>
  )
}

