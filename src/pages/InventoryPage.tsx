import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Invoice } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import {
  PlusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

export function InventoryPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const loadInvoices = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', user.tenantId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  // Memoize status calculations to avoid recalculating on every render
  const invoiceStats = useMemo(() => {
    return {
      finalized: invoices.filter((inv) => inv.status === 'finalized').length,
      drafts: invoices.filter((inv) => inv.status === 'draft').length,
      total: invoices.length
    }
  }, [invoices])

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-50 border-gray-200 text-gray-700'
    switch (status) {
      case 'finalized':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'draft':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700'
      case 'cancelled':
        return 'bg-red-50 border-red-200 text-red-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <Button variant="primary" size="sm" className="flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">New Invoice</span>
        </Button>
      </div>

      {/* Stats Cards - 12px gap, 16px padding */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-green-50 border-green-200 shadow-sm">
          <CardContent className="p-4 text-center">
            {/* Card icon: 20px max */}
            <DocumentTextIcon className="mx-auto h-5 w-5 text-green-600 mb-2" />
            <p className="text-xs font-medium text-gray-600">Finalized</p>
            <p className="text-xl font-semibold text-gray-900">
              {invoiceStats.finalized}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <DocumentTextIcon className="mx-auto h-5 w-5 text-yellow-600 mb-2" />
            <p className="text-xs font-medium text-gray-600">Drafts</p>
            <p className="text-xl font-semibold text-gray-900">
              {invoiceStats.drafts}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <DocumentTextIcon className="mx-auto h-5 w-5 text-blue-600 mb-2" />
            <p className="text-xs font-medium text-gray-600">Total</p>
            <p className="text-xl font-semibold text-gray-900">
              {invoiceStats.total}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-600">
              No invoices yet. Create your first invoice to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card
              key={invoice.id}
              className={`border shadow-sm ${getStatusColor(invoice.status)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-900">
                      Invoice #{invoice.invoice_number}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(invoice.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-gray-900">
                      ₹{invoice.total_amount.toFixed(2)}
                    </p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize mt-1 ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

