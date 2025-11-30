import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { useCustomers, useUpdateOrgCustomer } from '../hooks/useCustomers'
import type { CustomerWithMaster } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { CustomerForm } from '../components/forms/CustomerForm'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

export function CustomersPage() {
  const { user } = useAuth()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithMaster | null>(null)

  // React Query hooks
  const { data: customers = [], isLoading: loading, refetch } = useCustomers(user?.orgId)
  const { mutate: updateCustomer } = useUpdateOrgCustomer(user?.orgId)

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    registerRefreshHandler(() => refetch())
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, refetch])

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const master = customer.master_customer
    const alias = customer.alias_name?.toLowerCase() || ''
    const legalName = master.legal_name?.toLowerCase() || ''
    const mobile = master.mobile || ''
    const gstin = master.gstin?.toLowerCase() || ''
    const email = master.email?.toLowerCase() || ''

    return (
      alias.includes(query) ||
      legalName.includes(query) ||
      mobile.includes(query) ||
      gstin.includes(query) ||
      email.includes(query)
    )
  })

  const handleUpdateCustomer = (data: any) => {
    if (!editingCustomer) return

    updateCustomer(
      { customerId: editingCustomer.id, data },
      {
        onSuccess: () => {
          setEditingCustomer(null)
          setIsFormOpen(false)
          toast.success('Customer updated successfully')
        },
        onError: (error) => {
          console.error('Error updating customer:', error)
          toast.error('Failed to update customer')
        },
      }
    )
  }

  const handleEditClick = (customer: CustomerWithMaster) => {
    setEditingCustomer(customer)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingCustomer(null)
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary-text">Customers</h1>
        <Button
          variant="secondary"
          size="sm"
          className="flex items-center gap-1.5"
          disabled
          title="Add customers via invoice creation"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Add Customer</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search by name, mobile, GSTIN, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-bg-card py-sm pl-[2.5rem] pr-md text-sm min-h-[44px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          aria-label="Search customers"
        />
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-secondary-text mb-sm">
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </p>
            <p className="text-xs text-secondary-text">
              {searchQuery
                ? 'Try adjusting your search criteria'
                : 'Customers are created automatically when you add them to an invoice.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => {
            const master = customer.master_customer
            const displayName = customer.alias_name || master.legal_name

            return (
              <Card key={customer.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-primary-text truncate">
                        {displayName}
                      </h3>
                      {customer.alias_name && master.legal_name && (
                        <p className="text-xs text-muted-text mt-xs">Legal: {master.legal_name}</p>
                      )}
                      <div className="mt-sm flex flex-wrap items-center gap-sm text-xs text-secondary-text">
                        {master.mobile && (
                          <span>Mobile: {master.mobile}</span>
                        )}
                        {master.gstin && (
                          <span>• GSTIN: {master.gstin}</span>
                        )}
                        {master.email && (
                          <span>• Email: {master.email}</span>
                        )}
                      </div>
                      {master.address && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {master.address}
                        </p>
                      )}
                      {customer.billing_address && (
                        <p className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Billing: </span>
                          {customer.billing_address}
                        </p>
                      )}
                      {customer.notes && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          <span className="font-medium">Notes: </span>
                          {customer.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(customer)}
                          className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-secondary-text hover:bg-neutral-100 hover:text-primary-text transition-colors duration-200"
                          aria-label={`Edit customer ${displayName}`}
                        >
                          <PencilIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Customer Form */}
      {editingCustomer && (
        <CustomerForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleUpdateCustomer}
          customer={editingCustomer}
        />
      )}
    </div>
  )
}

