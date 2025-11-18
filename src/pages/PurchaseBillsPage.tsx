import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { SmartEntryInput, type SmartEntryInputRef } from '../components/entry/SmartEntryInput'
import { ProductForm } from '../components/forms/ProductForm'
import { Modal } from '../components/ui/Modal'
import { toast } from 'react-toastify'
import { 
  createPurchaseBill, 
  generatePurchaseBillNumber,
  type PurchaseBillFormData,
  type PurchaseBillItemFormData 
} from '../lib/api/purchaseBills'
import { getOrgById } from '../lib/api/orgs'
import { useBillCalculations, type BillItem } from '../hooks/useBillCalculations'
import { GST_STATE_CODE_MAP } from '../lib/constants/gstStateCodes'
import type { Product, Org } from '../types'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

export function PurchaseBillsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // Removed unused loading state
  const [submitting, setSubmitting] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const [newProductQuery, setNewProductQuery] = useState('')
  const smartEntryInputRef = useRef<SmartEntryInputRef>(null)
  const [highlightedItemIndex, setHighlightedItemIndex] = useState<number | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  // Removed unused orgLoading state

  // Form state
  const [formData, setFormData] = useState<PurchaseBillFormData>({
    bill_number: '',
    vendor_name: '',
    vendor_gstin: '',
    vendor_state_code: '',
    bill_date: new Date().toISOString().split('T')[0],
    branch_id: null,
    notes: '',
    items: [],
  })

  // Load org details and initial bill number
  useEffect(() => {
    if (user?.orgId) {
      loadOrgDetails()
      loadBillNumber()
    }
  }, [user?.orgId])

  const loadOrgDetails = async () => {
    if (!user?.orgId) return
    try {
      const orgData = await getOrgById(user.orgId)
      setOrg(orgData)
      
      // DATA INTEGRITY: Fail fast if org state_code is missing
      if (orgData && !orgData.state_code && !orgData.state) {
        toast.error(
          'Organization state code is missing. Please update your organization settings with a valid state code before creating purchase bills.',
          { autoClose: 10000 }
        )
      }
    } catch (error: any) {
      console.error('Failed to load org details:', error)
      toast.error('Failed to load organization details')
    }
  }
  
  // Prepare state code options for dropdown
  const stateCodeOptions = Object.entries(GST_STATE_CODE_MAP)
    .map(([code, name]) => ({
      value: code,
      label: `${code} - ${name}`,
    }))
    .sort((a, b) => a.value.localeCompare(b.value))

  // Auto-focus SmartEntryInput on mount
  useEffect(() => {
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      smartEntryInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const loadBillNumber = async () => {
    if (!user?.orgId) return
    try {
      const number = await generatePurchaseBillNumber(user.orgId)
      setFormData(prev => ({ ...prev, bill_number: number }))
    } catch (error: any) {
      console.error('Failed to generate bill number:', error)
    }
  }

  // Handle product found from SmartEntryInput
  const handleProductFound = (data: {
    type: 'SERIAL_FOUND' | 'PRODUCT_FOUND'
    product_id: string
    product_name: string
    product_sku: string
    selling_price: number | null
    hsn_code: string | null
    gst_rate: number | null
  }) => {
    // Check if product already added
    if (formData.items.some(item => item.product_id === data.product_id)) {
      toast.info('Product already added to bill')
      return
    }

    // Add item to bill
    const newItem: PurchaseBillItemFormData = {
      product_id: data.product_id,
      master_product_id: null, // Will be populated if available
      description: data.product_name,
      quantity: 1,
      unit: 'pcs',
      unit_price: data.selling_price || 0,
      vendor_hsn_code: data.hsn_code || null,
      vendor_gst_rate: data.gst_rate || null,
      total_amount: data.selling_price || 0,
    }

    const newIndex = formData.items.length
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }))

    // Highlight the newly added item
    setHighlightedItemIndex(newIndex)
    setTimeout(() => {
      setHighlightedItemIndex(null)
    }, 1000)

    toast.success(`Added: ${data.product_name}`)
  }

  // Handle unknown entry - show product creation form
  const handleUnknownEntry = (query: string) => {
    setNewProductQuery(query)
    setShowProductForm(true)
  }

  // Handle error from SmartEntryInput
  const handleEntryError = (message: string) => {
    toast.error(`Entry error: ${message}`)
  }

  // Update item quantity
  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return

    setFormData(prev => {
      const updatedItems = [...prev.items]
      updatedItems[index].quantity = quantity
      updatedItems[index].total_amount = quantity * updatedItems[index].unit_price
      return { ...prev, items: updatedItems }
    })
  }

  // Update item price
  const handleUpdatePrice = (index: number, price: number) => {
    if (price < 0) return

    setFormData(prev => {
      const updatedItems = [...prev.items]
      updatedItems[index].unit_price = price
      updatedItems[index].total_amount = updatedItems[index].quantity * price
      return { ...prev, items: updatedItems }
    })
  }

  // Remove item
  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  // Convert items to BillItem format for calculation
  // Use quantity * unit_price (GST-exclusive) to match backend calculation
  const billItems: BillItem[] = formData.items.map(item => ({
    line_total: item.quantity * item.unit_price, // GST-exclusive base amount
    tax_rate: item.vendor_gst_rate,
    hsn_sac_code: item.vendor_hsn_code,
  }))

  // Calculate bill totals with GST using the hook
  // Use GST-exclusive pricing to match backend calculation
  const calculations = useBillCalculations(
    billItems,
    org?.state_code || org?.state || null,
    formData.vendor_state_code || null,
    false // GST-exclusive pricing (matches backend)
  )

  // Submit form
  const handleSubmit = async () => {
    if (!user?.orgId || !user?.id) {
      toast.error('User not authenticated')
      return
    }

    // DATA INTEGRITY: Validate org has state_code
    if (!org) {
      toast.error('Organization details not loaded. Please refresh the page.')
      return
    }
    
    const orgStateCode = org.state_code || org.state
    if (!orgStateCode) {
      toast.error(
        'Organization state code is missing. Please update your organization settings with a valid state code before creating purchase bills.',
        { autoClose: 10000 }
      )
      return
    }

    if (!formData.bill_number.trim()) {
      toast.error('Bill number is required')
      return
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    try {
      setSubmitting(true)
      // Normalize vendor_state_code: empty string -> null
      const normalizedData: PurchaseBillFormData = {
        ...formData,
        vendor_state_code: formData.vendor_state_code?.trim() || null,
      }
      const bill = await createPurchaseBill(user.orgId, user.id, normalizedData)
      toast.success('Purchase bill created successfully')
      // Navigate to details page to show workflow actions
      navigate(`/purchase-bills/${bill.id}`)
    } catch (error: any) {
      console.error('Failed to create purchase bill:', error)
      toast.error(error.message || 'Failed to create purchase bill')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user?.orgId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-text">Create Purchase Bill</h1>
      </div>

      {/* Bill Header */}
      <Card>
        <CardHeader>
          <CardTitle>Bill Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Bill Number"
              value={formData.bill_number}
              onChange={(e) => setFormData(prev => ({ ...prev, bill_number: e.target.value }))}
              required
              disabled={submitting}
            />
            <Input
              label="Bill Date"
              type="date"
              value={formData.bill_date}
              onChange={(e) => setFormData(prev => ({ ...prev, bill_date: e.target.value }))}
              required
              disabled={submitting}
            />
            <Input
              label="Vendor Name"
              value={formData.vendor_name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value || null }))}
              disabled={submitting}
            />
            <Input
              label="Vendor GSTIN"
              value={formData.vendor_gstin || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, vendor_gstin: e.target.value || null }))}
              disabled={submitting}
              placeholder="15-character GSTIN"
            />
            <Select
              label="Vendor State Code"
              value={formData.vendor_state_code || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, vendor_state_code: e.target.value || null }))}
              disabled={submitting}
              options={[
                { value: '', label: 'Select state code...' },
                ...stateCodeOptions,
              ]}
            />
          </div>
          <Input
            label="Notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value || null }))}
            disabled={submitting}
          />
        </CardContent>
      </Card>

      {/* Smart Entry Input */}
      <Card>
        <CardHeader>
          <CardTitle>Add Items</CardTitle>
        </CardHeader>
        <CardContent>
          <SmartEntryInput
            ref={smartEntryInputRef}
            orgId={user.orgId}
            placeholder="Scan barcode, enter SKU, or serial number"
            onProductFound={handleProductFound}
            onUnknownEntry={handleUnknownEntry}
            onError={handleEntryError}
            disabled={submitting}
          />
        </CardContent>
      </Card>

      {/* Items List */}
      {formData.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items ({formData.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div
                  key={index}
                  className={`border rounded-md p-4 space-y-3 transition-colors duration-1000 ${
                    highlightedItemIndex === index
                      ? 'bg-yellow-100 border-yellow-300'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-primary-text">
                        {item.description || 'Item'}
                      </h4>
                      {item.vendor_hsn_code && (
                        <p className="text-xs text-muted-text mt-1">
                          HSN: {item.vendor_hsn_code}
                          {item.vendor_gst_rate !== null && ` • GST: ${item.vendor_gst_rate}%`}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
                      disabled={submitting}
                      aria-label="Remove item"
                    >
                      <TrashIcon className="h-5 w-5 text-error" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-secondary-text block mb-1">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 1)}
                        disabled={submitting}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-secondary-text block mb-1">Unit Price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => handleUpdatePrice(index, parseFloat(e.target.value) || 0)}
                        disabled={submitting}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-secondary-text block mb-1">Total</label>
                      <div className="text-sm font-semibold text-primary-text py-sm">
                        ₹{item.total_amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary-text">Subtotal:</span>
                <span className="text-sm font-medium text-primary-text">
                  ₹{calculations.subtotal.toFixed(2)}
                </span>
              </div>
              
              {/* Tax Breakdown */}
              {calculations.totalTax > 0 && (
                <>
                  {calculations.placeOfSupply === 'intrastate' ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondary-text">CGST:</span>
                        <span className="text-sm font-medium text-primary-text">
                          ₹{calculations.cgstAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondary-text">SGST:</span>
                        <span className="text-sm font-medium text-primary-text">
                          ₹{calculations.sgstAmount.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondary-text">IGST:</span>
                      <span className="text-sm font-medium text-primary-text">
                        ₹{calculations.igstAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                    <span className="text-sm text-secondary-text">Total Tax:</span>
                    <span className="text-sm font-medium text-primary-text">
                      ₹{calculations.totalTax.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                <span className="text-lg font-semibold text-primary-text">Grand Total:</span>
                <span className="text-xl font-bold text-primary-text">
                  ₹{calculations.grandTotal.toFixed(2)}
                </span>
              </div>
              
              {/* Place of Supply Indicator */}
              {formData.vendor_state_code && org?.state_code && (
                <div className="mt-2 text-xs text-muted-text">
                  Place of Supply: <span className="font-medium">{calculations.placeOfSupply === 'intrastate' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {formData.items.length > 0 && (
        <div className="flex justify-end gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/purchase-bills')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || formData.items.length === 0}
            isLoading={submitting}
          >
            Create Purchase Bill
          </Button>
        </div>
      )}

      {/* Product Creation Modal */}
      <Modal
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false)
          setNewProductQuery('')
        }}
        title="Create New Product"
      >
        <ProductForm
          isOpen={showProductForm}
          onClose={() => {
            setShowProductForm(false)
            setNewProductQuery('')
          }}
          prefillQuery={newProductQuery}
          onSubmit={async (productData) => {
            // Import createProduct function
            const { createProduct } = await import('../lib/api/products')
            
            let createdProduct: Product
            
            // Try to create the product
            // If it already exists (e.g., created from master in ProductForm), handle gracefully
            try {
              createdProduct = await createProduct(user.orgId!, productData)
            } catch (error: any) {
              // If product already exists (duplicate SKU), fetch it instead
              if (error.message?.includes('already exists') || error.message?.includes('SKU')) {
                // Product was likely created from master - fetch it by SKU
                const { getProducts } = await import('../lib/api/products')
                const result = await getProducts(user.orgId!, { search: productData.sku })
                const existing = result.data.find(p => p.sku === productData.sku)
                
                if (existing) {
                  createdProduct = existing
                } else {
                  // If we can't find it, re-throw the error
                  throw error
                }
              } else {
                throw error
              }
            }
            
            // Automatically add the created/existing product to the bill
            const newItem: PurchaseBillItemFormData = {
              product_id: createdProduct.id,
              master_product_id: null,
              description: createdProduct.name,
              quantity: 1,
              unit: createdProduct.unit || 'pcs',
              unit_price: createdProduct.selling_price || 0,
              vendor_hsn_code: createdProduct.hsn_sac_code || null,
              vendor_gst_rate: createdProduct.tax_rate || null,
              total_amount: createdProduct.selling_price || 0,
            }

            const newIndex = formData.items.length
            setFormData(prev => ({
              ...prev,
              items: [...prev.items, newItem],
            }))

            // Highlight the newly added item
            setHighlightedItemIndex(newIndex)
            setTimeout(() => {
              setHighlightedItemIndex(null)
            }, 1000)

            toast.success(`Product "${createdProduct.name}" added to bill`)
            
            // Close modal and return focus to SmartEntryInput
            setShowProductForm(false)
            setNewProductQuery('')
            
            // Return focus to input after a brief delay
            setTimeout(() => {
              smartEntryInputRef.current?.focus()
              smartEntryInputRef.current?.clear()
            }, 100)
            
            // Return created/existing product so ProductForm can use it if needed
            return createdProduct
          }}
          orgId={user.orgId}
          userId={user.id}
        />
      </Modal>
    </div>
  )
}

