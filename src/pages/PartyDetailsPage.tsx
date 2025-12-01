/**
 * Party Details Page
 * 
 * Displays customer details with transaction history and receivables
 * Route: /customers/:id
 * UX Pattern: Full-screen with sticky header
 */

import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCustomerById, useSoftDeleteCustomer, useCanDeleteCustomer } from '../hooks/useCustomers'
import { useQuery } from '@tanstack/react-query'
import { getInvoicesByOrg } from '../lib/api/invoices/read'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ActionSheet } from '../components/ui/ActionSheet'
import { ArrowLeftIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

export function PartyDetailsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [showActionSheet, setShowActionSheet] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

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

    // Delete functionality
    const { mutate: deleteCustomer } = useSoftDeleteCustomer(user?.orgId)
    const { data: deleteCheck } = useCanDeleteCustomer(id || null)

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

    const handleEdit = () => {
        toast.info('Edit functionality coming soon')
    }

    const handleDelete = () => {
        setDeleteConfirmOpen(true)
    }

    return (
        <div className="min-h-screen bg-bg-page">
            {/* Sticky Header */}
            <header className="sticky top-0 z-10 bg-bg-card border-b border-neutral-200">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="rounded-md p-2 hover:bg-neutral-100 transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>

                    <h1 className="text-lg font-semibold text-primary-text">
                        Party Details
                    </h1>

                    <button
                        onClick={() => setShowActionSheet(true)}
                        className="rounded-md p-2 hover:bg-neutral-100 transition-colors"
                        aria-label="More actions"
                    >
                        <EllipsisVerticalIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>

            {/* Scrollable Content */}
            <main className="space-y-md p-4 pb-20">
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
            </main>

            {/* Action Sheet */}
            <ActionSheet
                isOpen={showActionSheet}
                onClose={() => setShowActionSheet(false)}
                title={displayName}
                items={[
                    {
                        id: 'edit',
                        label: 'Edit Customer',
                        icon: <PencilIcon className="h-5 w-5" />,
                        onClick: handleEdit
                    },
                    {
                        id: 'delete',
                        label: 'Delete Customer',
                        icon: <TrashIcon className="h-5 w-5" />,
                        onClick: handleDelete,
                        variant: 'destructive' as const
                    }
                ]}
            />

            {/* Delete Confirmation Dialog */}
            {deleteConfirmOpen && customer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
                    <div className="bg-bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-primary-text mb-2">
                            Delete Customer?
                        </h3>
                        {deleteCheck?.can_delete ? (
                            <>
                                <p className="text-sm text-secondary-text mb-4">
                                    This will soft delete <strong>{displayName}</strong>.
                                    You can restore within 30 days.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <Button
                                        variant="secondary"
                                        onClick={() => setDeleteConfirmOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        className="bg-error hover:bg-error/90"
                                        onClick={() => {
                                            if (!customer.id) return
                                            deleteCustomer(
                                                { customerId: customer.id },
                                                {
                                                    onSuccess: (result) => {
                                                        toast.success(`Customer deleted. Recoverable until ${new Date(result.expires_at).toLocaleDateString()}`)
                                                        navigate('/customers')
                                                    },
                                                    onError: (error) => {
                                                        toast.error(error.message || 'Failed to delete customer')
                                                        setDeleteConfirmOpen(false)
                                                    }
                                                }
                                            )
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-error mb-4">
                                    Cannot delete this customer because they have {deleteCheck?.invoice_count || 0} existing transaction(s).
                                </p>
                                <div className="flex justify-end">
                                    <Button
                                        variant="primary"
                                        onClick={() => setDeleteConfirmOpen(false)}
                                    >
                                        OK
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
