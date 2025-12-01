/**
 * Party Details Page
 * 
 * Displays customer details with transaction history and receivables
 * Route: /customers/:id
 */

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCustomerById } from '../hooks/useCustomers'
import { useQuery } from '@tanstack/react-query'
import { getInvoicesByOrg } from '../lib/api/invoices/read'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export function PartyDetailsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    // Fetch customer details
    const { data: customer, isLoading: customerLoading } = useCustomerById(id || null)

    // Fetch invoices for this customer
    const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
        queryKey: ['customer-invoices', user?.orgId, id],
        queryFn: async () => {
            if (!user?.orgId || !id) return []
            return getInvoicesByOrg(user.orgId, { customer_id: id })
        },
        enabled: !!user?.orgId && !!id,
        staleTime: 30 * 1000,
    })

    if (!id) {
        return (
            <div className="p-4">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-error">Invalid customer ID</p>
                        <div className="mt-4 text-center">
                            <Button onClick={() => navigate('/customers')}>Back to Customers</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (customerLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (!customer) {
        return (
            <div className="p-4">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-error">Customer not found</p>
                        <div className="mt-4 text-center">
                            <Button onClick={() => navigate('/customers')}>Back to Customers</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const master = customer.master_customer
    const displayName = customer.alias_name || master?.legal_name || 'Unknown'

    // Calculate balances
    const totalInvoiced = invoices
        .filter(i => i.status !== 'draft')
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
    const totalPaid = invoices
        .filter(i => i.status !== 'draft')
        .reduce((sum, inv) => sum + (inv.paid_amount || 0), 0)
    const balanceReceivable = totalInvoiced - totalPaid

    // Helper to determine payment status
    const getPaymentStatus = (invoice: any): 'paid' | 'partial' | 'unpaid' => {
        const total = invoice.total_amount || 0
        const paid = invoice.paid_amount || 0
        if (paid >= total) return 'paid'
        if (paid > 0) return 'partial'
        return 'unpaid'
    }

    const statusColors = {
        paid: 'bg-green-100 text-green-800',
        partial: 'bg-cyan-100 text-cyan-800',
        unpaid: 'bg-orange-100 text-orange-800',
    }

    return (
        <div className="space-y-md p-4 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/customers')}
                    className="rounded-md p-2 hover:bg-neutral-100"
                    aria-label="Back to customers"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-semibold text-primary-text">Party Details</h1>
            </div>

            {/* Customer Info Card */}
            <Card className="bg-blue-50">
                <CardContent className="p-4">
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary-text">{displayName}</h2>
                        {master?.mobile && (
                            <p className="text-sm text-secondary-text">{master.mobile}</p>
                        )}

                        {balanceReceivable > 0 && (
                            <div className="pt-2 border-t border-blue-200">
                                <p className="text-xs text-green-600 font-medium">Receivable</p>
                                <p className="text-2xl font-bold text-green-700">
                                    ₹{balanceReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}

                        {customer.notes && (
                            <div className="pt-2 border-t border-blue-200">
                                <p className="text-xs font-medium text-secondary-text">Notes</p>
                                <p className="text-sm text-primary-text">{customer.notes}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Transaction History */}
            <div>
                <h3 className="text-base font-semibold text-primary-text mb-3">
                    Transactions ({invoices.filter(i => i.status !== 'draft').length})
                </h3>

                {invoicesLoading ? (
                    <div className="flex h-32 items-center justify-center">
                        <LoadingSpinner size="md" />
                    </div>
                ) : invoices.filter(i => i.status !== 'draft').length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="text-sm text-secondary-text">No transactions yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {invoices
                            .filter(i => i.status !== 'draft')
                            .map((invoice) => {
                                const paymentStatus = getPaymentStatus(invoice)

                                return (
                                    <Link key={invoice.id} to={`/invoices/${invoice.id}`}>
                                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-sm font-medium text-primary-text">
                                                                Sale
                                                            </p>
                                                            {invoice.invoice_number && (
                                                                <p className="text-xs text-muted-text">
                                                                    #{invoice.invoice_number}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-secondary-text">
                                                            {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-IN', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: '2-digit'
                                                            }) : 'N/A'}
                                                        </p>

                                                        {paymentStatus !== 'paid' && (
                                                            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium uppercase ${statusColors[paymentStatus]}`}>
                                                                {paymentStatus}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs text-secondary-text">Total</p>
                                                        <p className="text-base font-semibold text-primary-text">
                                                            ₹{(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </p>
                                                        {paymentStatus === 'partial' && (
                                                            <>
                                                                <p className="text-xs text-secondary-text mt-1">Balance</p>
                                                                <p className="text-sm font-medium text-orange-600">
                                                                    ₹{((invoice.total_amount || 0) - (invoice.paid_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                )
                            })}
                    </div>
                )}
            </div>
        </div>
    )
}
