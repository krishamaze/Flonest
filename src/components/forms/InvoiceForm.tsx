import { useState, FormEvent, useEffect, useMemo } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { isMobileDevice } from '../../lib/deviceDetection'
import { IdentifierInput } from '../customers/IdentifierInput'
import { CustomerResultCard } from '../customers/CustomerResultCard'
import type { InvoiceFormData, InvoiceItemFormData, Product, CustomerWithMaster } from '../../types'
import { lookupOrCreateCustomer, checkCustomerExists, searchCustomersByIdentifier } from '../../lib/api/customers'
import { getAllProducts } from '../../lib/api/products'
import { createInvoice } from '../../lib/api/invoices'
import { calculateGST, extractStateCodeFromGSTIN, getGSTRate } from '../../lib/utils/gstCalculation'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { IdentifierType } from '../../lib/utils/identifierValidation'

interface InvoiceFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (invoiceId: string) => Promise<void>
  orgId: string
  userId: string
  orgState?: string
  orgGstEnabled?: boolean
  title?: string
}

type Step = 1 | 2 | 3 | 4

export function InvoiceForm({
  isOpen,
  onClose,
  onSubmit,
  orgId,
  userId,
  orgState,
  orgGstEnabled = false,
  title,
}: InvoiceFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [identifier, setIdentifier] = useState('')
  const [identifierValid, setIdentifierValid] = useState(false)
  const [, setIdentifierType] = useState<IdentifierType>('invalid')
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMaster | null>(null)
  const [showMasterForm, setShowMasterForm] = useState(false)
  const [masterFormData, setMasterFormData] = useState<{ legal_name: string; address: string; email: string }>({
    legal_name: '',
    address: '',
    email: '',
  })
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [items, setItems] = useState<InvoiceItemFormData[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load products when form opens
  useEffect(() => {
    if (isOpen && orgId) {
      setLoadingProducts(true)
      getAllProducts(orgId, { status: 'active' })
        .then(setProducts)
        .catch((error) => {
          console.error('Error loading products:', error)
        })
        .finally(() => setLoadingProducts(false))
    }
  }, [isOpen, orgId])

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1)
      setIdentifier('')
      setIdentifierValid(false)
      setSelectedCustomer(null)
      setShowMasterForm(false)
      setMasterFormData({ legal_name: '', address: '', email: '' })
      setItems([])
      setErrors({})
    }
  }, [isOpen])

  // Step 1: Customer Selection
  const handleLookupCustomer = async () => {
    if (!identifierValid || !identifier.trim()) {
      setErrors({ identifier: 'Please enter a valid mobile number or GSTIN' })
      return
    }

    setSearching(true)
    setErrors({})
    setShowMasterForm(false)

    try {
      // First, check if org customer exists (master + org link)
      const orgCustomer = await searchCustomersByIdentifier(identifier, orgId)
      
      if (orgCustomer) {
        // Customer exists with org link - show details
        setSelectedCustomer(orgCustomer)
        return
      }

      // Check if master customer exists (but no org link)
      const master = await checkCustomerExists(identifier)
      
      if (master) {
        // Master exists but no org link - create org link and show
        const result = await lookupOrCreateCustomer(identifier, orgId, userId)
        setSelectedCustomer({
          ...result.customer,
          master_customer: result.master,
        })
      } else {
        // Master doesn't exist - show form to collect details
        setShowMasterForm(true)
      }
    } catch (error) {
      console.error('Error looking up customer:', error)
      setErrors({
        identifier: error instanceof Error ? error.message : 'Failed to lookup customer',
      })
    } finally {
      setSearching(false)
    }
  }

  const handleCreateMasterCustomer = async () => {
    // Validate form
    const formErrors: Record<string, string> = {}
    
    if (!masterFormData.legal_name.trim() || masterFormData.legal_name.trim().length < 2) {
      formErrors.legal_name = 'Legal name is required and must be at least 2 characters'
    }
    
    if (masterFormData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterFormData.email.trim())) {
      formErrors.email = 'Please enter a valid email address'
    }
    
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setSearching(true)
    setErrors({})

    try {
      const result = await lookupOrCreateCustomer(
        identifier,
        orgId,
        userId,
        {
          legal_name: masterFormData.legal_name.trim(),
          address: masterFormData.address.trim() || undefined,
          email: masterFormData.email.trim() || undefined,
        }
      )
      setSelectedCustomer({
        ...result.customer,
        master_customer: result.master,
      })
      setShowMasterForm(false)
      setMasterFormData({ legal_name: '', address: '', email: '' })
    } catch (error) {
      console.error('Error creating customer:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create customer',
      })
    } finally {
      setSearching(false)
    }
  }

  // Step 2: Add Products
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: '',
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItemFormData, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }

    // Recalculate line_total if quantity or unit_price changed
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = (updated[index].quantity || 0) * (updated[index].unit_price || 0)
    }

    setItems(updated)
  }

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0)
    const gstRate = getGSTRate(orgGstEnabled || false)
    let cgst_amount = 0
    let sgst_amount = 0

    if (gstRate > 0 && orgState && selectedCustomer?.master_customer.state_code) {
      const sellerStateCode = extractStateCodeFromGSTIN(orgState) || orgState.slice(0, 2)
      const buyerStateCode = selectedCustomer.master_customer.state_code
      const gstCalc = calculateGST(subtotal, gstRate, sellerStateCode, buyerStateCode)
      cgst_amount = gstCalc.cgst_amount
      sgst_amount = gstCalc.sgst_amount
    }

    const total_amount = subtotal + cgst_amount + sgst_amount

    return {
      subtotal,
      cgst_amount,
      sgst_amount,
      total_amount,
      gstRate,
    }
  }, [items, orgGstEnabled, orgState, selectedCustomer])

  // Step 3: Review
  // Step 4: Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedCustomer) {
      setErrors({ customer: 'Please select a customer' })
      setCurrentStep(1)
      return
    }

    if (items.length === 0) {
      setErrors({ items: 'Please add at least one item' })
      setCurrentStep(2)
      return
    }

    // Validate all items
    const invalidItems = items.some(
      (item) => !item.product_id || item.quantity <= 0 || item.unit_price <= 0
    )
    if (invalidItems) {
      setErrors({ items: 'Please fill all item fields correctly' })
      setCurrentStep(2)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const invoiceData: InvoiceFormData = {
        customer_id: selectedCustomer.id,
        items: items.map((item) => ({
          ...item,
          line_total: item.quantity * item.unit_price,
        })),
      }

      const customerStateCode = selectedCustomer.master_customer.state_code
      const invoice = await createInvoice(
        orgId,
        userId,
        invoiceData,
        orgState,
        orgGstEnabled || false,
        customerStateCode
      )

      await onSubmit(invoice.id)
      onClose()
    } catch (error) {
      console.error('Error creating invoice:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create invoice',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceedToStep2 = selectedCustomer !== null
  const canProceedToStep3 = items.length > 0 && items.every((item) => item.product_id && item.quantity > 0 && item.unit_price > 0)

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Customer Selection */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Select Customer</h3>
            <IdentifierInput
              value={identifier}
              onChange={setIdentifier}
              onValidationChange={(isValid, type) => {
                setIdentifierValid(isValid)
                setIdentifierType(type)
              }}
              disabled={isSubmitting || searching}
            />

            {identifierValid && !selectedCustomer && !showMasterForm && (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleLookupCustomer}
                  isLoading={searching}
                  disabled={!identifierValid || searching}
                  className="w-full"
                >
                  {searching ? 'Searching...' : 'Lookup Customer'}
                </Button>
              </div>
            )}

            {selectedCustomer && (
              <div className="mt-4">
                <CustomerResultCard
                  customer={selectedCustomer}
                  onSelect={() => setCurrentStep(2)}
                />
              </div>
            )}

            {showMasterForm && !selectedCustomer && (
              <div className="mt-4 space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900">Customer Not Found</h4>
                <p className="text-xs text-gray-600">
                  Please provide customer details to create a new customer record.
                </p>

                <Input
                  label="Legal Name *"
                  type="text"
                  value={masterFormData.legal_name}
                  onChange={(e) =>
                    setMasterFormData({ ...masterFormData, legal_name: e.target.value })
                  }
                  disabled={isSubmitting || searching}
                  required
                  placeholder="Enter legal business name"
                />
                {errors.legal_name && (
                  <p className="text-xs text-red-600">{errors.legal_name}</p>
                )}

                <Input
                  label="Email"
                  type="email"
                  value={masterFormData.email}
                  onChange={(e) =>
                    setMasterFormData({ ...masterFormData, email: e.target.value })
                  }
                  disabled={isSubmitting || searching}
                  placeholder="Enter email address (optional)"
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email}</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={masterFormData.address}
                    onChange={(e) =>
                      setMasterFormData({ ...masterFormData, address: e.target.value })
                    }
                    disabled={isSubmitting || searching}
                    placeholder="Enter address (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowMasterForm(false)
                      setMasterFormData({ legal_name: '', address: '', email: '' })
                      setErrors({})
                    }}
                    disabled={isSubmitting || searching}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCreateMasterCustomer}
                    isLoading={searching}
                    disabled={isSubmitting || searching}
                    className="flex-1"
                  >
                    Create Customer
                  </Button>
                </div>
              </div>
            )}

            {errors.identifier && (
              <p className="mt-2 text-sm text-red-600">{errors.identifier}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Add Products */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Step 2: Add Products</h3>

            {items.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-sm text-gray-600 mb-4">No items added yet</p>
                <Button type="button" variant="primary" onClick={handleAddItem}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">Item {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700"
                          disabled={isSubmitting}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <Select
                        label="Product *"
                        value={item.product_id}
                        onChange={(e) => {
                          const selectedProduct = products.find((p) => p.id === e.target.value)
                          handleItemChange(index, 'product_id', e.target.value)
                          if (selectedProduct && selectedProduct.selling_price) {
                            handleItemChange(index, 'unit_price', selectedProduct.selling_price)
                          }
                        }}
                        options={[
                          { value: '', label: 'Select a product' },
                          ...products.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.sku}) - $${p.selling_price?.toFixed(2) || '0.00'}`,
                          })),
                        ]}
                        disabled={isSubmitting || loadingProducts}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Quantity *"
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity.toString()}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                          disabled={isSubmitting}
                        />

                        <Input
                          label="Unit Price *"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price.toString()}
                          onChange={(e) =>
                            handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          Line Total: <span className="font-semibold text-gray-900">${item.line_total.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}

                <Button type="button" variant="secondary" onClick={handleAddItem} disabled={isSubmitting}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Another Item
                </Button>
              </div>
            )}

            {errors.items && (
              <p className="mt-2 text-sm text-red-600">{errors.items}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Step 3: Review Invoice</h3>

            {/* Customer Info */}
            {selectedCustomer && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Customer</h4>
                <p className="text-sm text-gray-900">
                  {selectedCustomer.alias_name || selectedCustomer.master_customer.legal_name}
                </p>
                {selectedCustomer.master_customer.mobile && (
                  <p className="text-xs text-gray-600">Mobile: {selectedCustomer.master_customer.mobile}</p>
                )}
                {selectedCustomer.master_customer.gstin && (
                  <p className="text-xs text-gray-600">GSTIN: {selectedCustomer.master_customer.gstin}</p>
                )}
              </div>
            )}

            {/* Items Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900">Items</h4>
              {items.map((item, index) => {
                const product = products.find((p) => p.id === item.product_id)
                return (
                  <div key={index} className="flex justify-between text-sm border-b border-gray-200 pb-2">
                    <div>
                      <span className="font-medium text-gray-900">{product?.name || 'Unknown Product'}</span>
                      <span className="text-gray-600 ml-2">x {item.quantity}</span>
                    </div>
                    <span className="font-medium text-gray-900">${item.line_total.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">${totals.subtotal.toFixed(2)}</span>
              </div>
              {orgGstEnabled && totals.gstRate > 0 && (
                <>
                  {totals.cgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">CGST ({totals.gstRate / 2}%)</span>
                      <span className="font-medium text-gray-900">${totals.cgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.sgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">SGST ({totals.gstRate / 2}%)</span>
                      <span className="font-medium text-gray-900">${totals.sgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">${totals.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentStep((s) => (s - 1) as Step)}
              disabled={isSubmitting}
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentStep < 3 && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (currentStep === 1 && canProceedToStep2) {
                  setCurrentStep(2)
                } else if (currentStep === 2 && canProceedToStep3) {
                  setCurrentStep(3)
                }
              }}
              disabled={
                isSubmitting ||
                (currentStep === 1 && !canProceedToStep2) ||
                (currentStep === 2 && !canProceedToStep3)
              }
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          )}

          {currentStep === 3 && (
            <>
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Create Invoice (Draft)
              </Button>
            </>
          )}
        </div>
      </div>

      {errors.submit && (
        <p className="text-sm text-red-600">{errors.submit}</p>
      )}
    </form>
  )

  const formTitle = title || 'Create Invoice'

  if (isMobileDevice()) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={formTitle}>
        {FormContent}
      </Drawer>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formTitle}>
      {FormContent}
    </Modal>
  )
}

