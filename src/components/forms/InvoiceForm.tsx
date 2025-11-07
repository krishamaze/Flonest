import { useState, FormEvent, useEffect, useMemo } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { isMobileDevice } from '../../lib/deviceDetection'
import { IdentifierInput } from '../customers/IdentifierInput'
import { CustomerResultCard } from '../customers/CustomerResultCard'
import { Card, CardContent } from '../ui/Card'
import type { InvoiceFormData, InvoiceItemFormData, CustomerWithMaster, Org, ProductWithMaster } from '../../types'
import { lookupOrCreateCustomer, checkCustomerExists, searchCustomersByIdentifier } from '../../lib/api/customers'
import { getAllProducts } from '../../lib/api/products'
import { createInvoice } from '../../lib/api/invoices'
import { calculateItemGST, extractStateCodeFromGSTIN, getCustomerStateCode } from '../../lib/utils/gstCalculation'
import { isOrgGstEnabled } from '../../lib/utils/orgGst'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { IdentifierType } from '../../lib/utils/identifierValidation'
import { detectIdentifierType, validateMobile, validateGSTIN, normalizeIdentifier } from '../../lib/utils/identifierValidation'

interface InvoiceFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (invoiceId: string) => Promise<void>
  orgId: string
  userId: string
  org: Org
  title?: string
}

type Step = 1 | 2 | 3 | 4

export function InvoiceForm({
  isOpen,
  onClose,
  onSubmit,
  orgId,
  userId,
  org,
  title,
}: InvoiceFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [identifier, setIdentifier] = useState('')
  const [identifierValid, setIdentifierValid] = useState(false)
  const [identifierType, setIdentifierType] = useState<IdentifierType>('invalid')
  const [searching, setSearching] = useState(false)
  const [lookupPerformed, setLookupPerformed] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMaster | null>(null)
  const [showMasterForm, setShowMasterForm] = useState(false)
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [masterFormData, setMasterFormData] = useState<{ customer_name: string; address: string; email: string; additionalIdentifier: string }>({
    customer_name: '',
    address: '',
    email: '',
    additionalIdentifier: '',
  })
  const [products, setProducts] = useState<ProductWithMaster[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [items, setItems] = useState<InvoiceItemFormData[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load products when form opens
  useEffect(() => {
    if (isOpen && orgId) {
      setLoadingProducts(true)
      getAllProducts(orgId, { status: 'active' })
        .then((products) => setProducts(products as ProductWithMaster[]))
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
      setIdentifierType('invalid')
      setLookupPerformed(false)
      setSelectedCustomer(null)
      setShowMasterForm(false)
      setShowAddNewForm(false)
      setMasterFormData({ customer_name: '', address: '', email: '', additionalIdentifier: '' })
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
    setShowAddNewForm(false)
    setLookupPerformed(false)

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
        // Master doesn't exist - show "Add New Customer" option
        // Don't auto-show form, let user click the card
      }
    } catch (error) {
      console.error('Error looking up customer:', error)
      setErrors({
        identifier: error instanceof Error ? error.message : 'Failed to lookup customer',
      })
    } finally {
      setSearching(false)
      setLookupPerformed(true)
    }
  }

  const handleCreateMasterCustomer = async () => {
    // Validate form
    const formErrors: Record<string, string> = {}
    
    if (!masterFormData.customer_name.trim() || masterFormData.customer_name.trim().length < 2) {
      formErrors.customer_name = 'Customer name is required and must be at least 2 characters'
    }
    
    if (masterFormData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterFormData.email.trim())) {
      formErrors.email = 'Please enter a valid email address'
    }

    // Validate additional identifier if provided
    if (masterFormData.additionalIdentifier.trim()) {
      const additionalType = identifierType === 'mobile' ? 'gstin' : 'mobile'
      const detected = detectIdentifierType(masterFormData.additionalIdentifier.trim())
      if (detected !== additionalType) {
        formErrors.additionalIdentifier = additionalType === 'mobile' 
          ? 'Please enter a valid 10-digit mobile number'
          : 'Please enter a valid 15-character GSTIN'
      } else {
        const isValid = additionalType === 'mobile' 
          ? validateMobile(masterFormData.additionalIdentifier.trim())
          : validateGSTIN(masterFormData.additionalIdentifier.trim())
        if (!isValid) {
          formErrors.additionalIdentifier = additionalType === 'mobile'
            ? 'Mobile must be exactly 10 digits starting with 6, 7, 8, or 9'
            : 'Invalid GSTIN format'
        }
      }
    }
    
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setSearching(true)
    setErrors({})

    try {
      const additionalNormalized = masterFormData.additionalIdentifier.trim()
        ? normalizeIdentifier(masterFormData.additionalIdentifier.trim(), identifierType === 'mobile' ? 'gstin' : 'mobile')
        : undefined

      const masterData: any = {
        legal_name: masterFormData.customer_name.trim(),
        address: masterFormData.address.trim() || undefined,
        email: masterFormData.email.trim() || undefined,
      }

      if (identifierType === 'mobile' && additionalNormalized) {
        masterData.gstin = additionalNormalized
      } else if (identifierType === 'gstin' && additionalNormalized) {
        masterData.mobile = additionalNormalized
      }

      const result = await lookupOrCreateCustomer(
        identifier,
        orgId,
        userId,
        masterData
      )
      setSelectedCustomer({
        ...result.customer,
        master_customer: result.master,
      })
      setShowMasterForm(false)
      setShowAddNewForm(false)
      setMasterFormData({ customer_name: '', address: '', email: '', additionalIdentifier: '' })
      // Auto-advance to Step 2
      setCurrentStep(2)
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

  const handleProductChange = (index: number, productId: string) => {
    const updated = [...items]
    const selectedProduct = products.find((p) => p.id === productId)
    
    updated[index] = {
      ...updated[index],
      product_id: productId,
      unit_price: selectedProduct?.selling_price || updated[index].unit_price || 0,
    }
    
    // Recalculate line_total
    updated[index].line_total = (updated[index].quantity || 0) * updated[index].unit_price

    setItems(updated)
  }

  // Calculate totals with per-item GST calculation
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0)
    
    const gstEnabled = isOrgGstEnabled(org)
    if (!gstEnabled || !selectedCustomer) {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: subtotal,
      }
    }

    // Get seller state code from org GSTIN or state field
    const sellerStateCode = org.gst_number 
      ? extractStateCodeFromGSTIN(org.gst_number) 
      : (org.state ? org.state.slice(0, 2) : null)

    if (!sellerStateCode) {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: subtotal,
      }
    }

    // Get buyer state code with fallback logic
    const buyerStateCode = getCustomerStateCode(selectedCustomer, sellerStateCode)

    // Calculate GST per item
    let cgst_amount = 0
    let sgst_amount = 0
    let igst_amount = 0

    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id) as ProductWithMaster | undefined
      const productGstRate = product?.master_product?.gst_rate

      if (!productGstRate || productGstRate <= 0) {
        continue
      }

      // Calculate item GST (GST-inclusive pricing)
      const itemGst = calculateItemGST(
        item.line_total,
        productGstRate,
        sellerStateCode,
        buyerStateCode || undefined,
        true // isGstInclusive = true
      )

      cgst_amount += itemGst.cgst_amount
      sgst_amount += itemGst.sgst_amount
      igst_amount += itemGst.igst_amount
    }

    // Round aggregated amounts
    cgst_amount = Math.round(cgst_amount * 100) / 100
    sgst_amount = Math.round(sgst_amount * 100) / 100
    igst_amount = Math.round(igst_amount * 100) / 100

    const total_amount = subtotal + cgst_amount + sgst_amount + igst_amount

    return {
      subtotal,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_amount,
    }
  }, [items, org, selectedCustomer, products])

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

      const invoice = await createInvoice(
        orgId,
        userId,
        invoiceData,
        org,
        selectedCustomer
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
            <h3 className="text-lg font-semibold text-primary-text mb-md">Step 1: Select Customer</h3>
            <IdentifierInput
              value={identifier}
              onChange={setIdentifier}
              onValidationChange={(isValid, type) => {
                setIdentifierValid(isValid)
                setIdentifierType(type)
              }}
              autoFocus={isOpen && currentStep === 1}
              disabled={isSubmitting || searching}
            />

            {identifierValid && !selectedCustomer && !showMasterForm && !showAddNewForm && (
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

            {/* Horizontal swipeable customer selection area - show after lookup completes */}
            {lookupPerformed && !searching && identifierValid && (
              <div className="mt-4">
                <div 
                  className="flex gap-md overflow-x-auto pb-sm -mx-md px-md"
                  style={{
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {selectedCustomer && (
                    <div className="flex-shrink-0" style={{ minWidth: '280px', scrollSnapAlign: 'start' }}>
                      <CustomerResultCard
                        customer={selectedCustomer}
                        onSelect={() => setCurrentStep(2)}
                      />
                    </div>
                  )}
                  
                  {/* Add New Customer Card */}
                  <div className="flex-shrink-0" style={{ minWidth: '280px', scrollSnapAlign: 'start' }}>
                    <Card 
                      className="border-2 border-success-light shadow-sm"
                    >
                      <CardContent className="p-md">
                        <div className="space-y-md">
                          {/* Icon and Title */}
                          <div>
                            <div className="flex items-center gap-sm mb-xs">
                              <div className="w-8 h-8 rounded-md bg-success-light flex items-center justify-center flex-shrink-0">
                                <PlusIcon className="h-4 w-4 text-success" />
                              </div>
                              <h3 className="text-base font-semibold text-primary-text">Add New Customer</h3>
                            </div>
                            <p className="text-xs text-secondary-text">
                              Create a new customer record
                            </p>
                          </div>

                          {/* Placeholder content to match height */}
                          <div className="space-y-xs text-xs text-secondary-text opacity-50">
                            <div>Enter customer details</div>
                            <div>Mobile or GSTIN required</div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-sm pt-sm">
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => {
                                setShowAddNewForm(true)
                                setShowMasterForm(false)
                              }}
                              className="flex-1 min-h-[44px]"
                              aria-label="Add new customer"
                            >
                              Add New Customer
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Add New Customer Form */}
            {showAddNewForm && (
              <div className="mt-md space-y-md p-md border border-neutral-200 rounded-md bg-neutral-50">
                <h4 className="text-sm font-semibold text-primary-text">Add New Customer</h4>
                <p className="text-xs text-secondary-text">
                  Please provide customer details to create a new customer record.
                </p>

                <Input
                  label="Customer Name"
                  type="text"
                  value={masterFormData.customer_name}
                  onChange={(e) =>
                    setMasterFormData({ ...masterFormData, customer_name: e.target.value })
                  }
                  disabled={isSubmitting || searching}
                  required
                  placeholder="Enter customer name"
                  error={errors.customer_name}
                />

                {/* Dynamic Identifier Field */}
                {identifierType !== 'invalid' && (
                  <Input
                    label={identifierType === 'mobile' ? 'GSTIN (Optional)' : 'Mobile Number (Optional)'}
                    type="text"
                    value={masterFormData.additionalIdentifier}
                    onChange={(e) =>
                      setMasterFormData({ ...masterFormData, additionalIdentifier: e.target.value })
                    }
                    disabled={isSubmitting || searching}
                    placeholder={identifierType === 'mobile' ? 'Enter 15-character GSTIN' : 'Enter 10-digit mobile number'}
                    error={errors.additionalIdentifier}
                  />
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
                  error={errors.email}
                />

                <div>
                  <label className="block text-sm font-medium text-secondary-text mb-xs">
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
                    className="w-full px-md py-sm border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-neutral-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddNewForm(false)
                      setMasterFormData({ customer_name: '', address: '', email: '', additionalIdentifier: '' })
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
              <p className="mt-sm text-sm text-error">{errors.identifier}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Add Products */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-md">Step 2: Add Products</h3>

            {items.length === 0 ? (
              <div className="text-center py-lg border-2 border-dashed border-neutral-300 rounded-md">
                <p className="text-sm text-secondary-text mb-md">No items added yet</p>
                <Button type="button" variant="primary" onClick={handleAddItem}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  return (
                    <div key={index} className="border border-neutral-200 rounded-md p-md space-y-md">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-primary-text">Item {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-error hover:text-error-dark"
                          disabled={isSubmitting}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <Select
                        label="Product *"
                        value={item.product_id || ''}
                        onChange={(e) => {
                          handleProductChange(index, e.target.value)
                        }}
                        options={[
                          { value: '', label: 'Select a product' },
                          ...products.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.sku}) - $${p.selling_price?.toFixed(2) || '0.00'}`,
                          })),
                        ]}
                        disabled={isSubmitting || loadingProducts}
                        required
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Quantity"
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity.toString()}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                          disabled={isSubmitting}
                          required
                          placeholder="1"
                        />

                        <Input
                          label="Unit Price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price.toString()}
                          onChange={(e) =>
                            handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          disabled={isSubmitting}
                          required
                          placeholder="0.00"
                        />
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-secondary-text">
                          Line Total: <span className="font-semibold text-primary-text">${item.line_total.toFixed(2)}</span>
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
              <p className="mt-sm text-sm text-error">{errors.items}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-md">Step 3: Review Invoice</h3>

            {/* Customer Info */}
            {selectedCustomer && (
              <div className="mb-lg p-md bg-neutral-50 rounded-md">
                <h4 className="text-sm font-semibold text-primary-text mb-sm">Customer</h4>
                <p className="text-sm text-primary-text">
                  {selectedCustomer.alias_name || selectedCustomer.master_customer.legal_name}
                </p>
                {selectedCustomer.master_customer.mobile && (
                  <p className="text-xs text-secondary-text">Mobile: {selectedCustomer.master_customer.mobile}</p>
                )}
                {selectedCustomer.master_customer.gstin && (
                  <p className="text-xs text-secondary-text">GSTIN: {selectedCustomer.master_customer.gstin}</p>
                )}
              </div>
            )}

            {/* Items Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary-text">Items</h4>
              {items.map((item, index) => {
                const product = products.find((p) => p.id === item.product_id)
                return (
                  <div key={index} className="flex justify-between text-sm border-b border-neutral-200 pb-sm">
                    <div>
                      <span className="font-medium text-primary-text">{product?.name || 'Unknown Product'}</span>
                      <span className="text-secondary-text ml-sm">x {item.quantity}</span>
                    </div>
                    <span className="font-medium text-primary-text">${item.line_total.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-lg pt-md border-t border-neutral-200 space-y-sm">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-text">Subtotal</span>
                <span className="font-medium text-primary-text">${totals.subtotal.toFixed(2)}</span>
              </div>
              {isOrgGstEnabled(org) && (
                <>
                  {totals.cgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-text">CGST</span>
                      <span className="font-medium text-primary-text">${totals.cgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.sgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-text">SGST</span>
                      <span className="font-medium text-primary-text">${totals.sgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.igst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-text">IGST</span>
                      <span className="font-medium text-primary-text">${totals.igst_amount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-lg font-semibold pt-sm border-t border-neutral-200">
                <span className="text-primary-text">Total</span>
                <span className="text-primary-text">${totals.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-md border-t border-neutral-200">
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
        <p className="text-sm text-error">{errors.submit}</p>
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

