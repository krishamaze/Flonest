import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { CustomerWithMaster } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { CustomerForm } from '../components/forms/CustomerForm'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon } from '@heroicons/react/24/outline'
import { getCustomersByOrg, updateOrgCustomer } from '../lib/api/customers'

export function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<CustomerWithMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithMaster | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadCustomers = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const data = await getCustomersByOrg(user.orgId)
      setCustomers(data)
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadCustomers()
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, loadCustomers])

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

  const handleUpdateCustomer = async (data: any) => {
    if (!editingCustomer) return
    await updateOrgCustomer(editingCustomer.id, data)
    await loadCustomers()
    setEditingCustomer(null)
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
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
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm min-h-[44px] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
          aria-label="Search customers"
        />
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-gray-900 mb-2">
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </p>
            <p className="text-sm text-gray-600">
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
                      <h3 className="text-base font-medium text-gray-900 truncate">
                        {displayName}
                      </h3>
                      {customer.alias_name && master.legal_name && (
                        <p className="text-xs text-gray-500 mt-0.5">Legal: {master.legal_name}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
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
                          className="rounded-lg p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
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

