import { useState, FormEvent, useEffect, useCallback, useRef } from 'react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { isMobileDevice } from '../../lib/deviceDetection'
import type { ProductFormData, Product } from '../../types'
import { searchMasterProducts } from '../../lib/api/master-products'
import { createProductFromMaster } from '../../lib/api/products'
import type { MasterProduct } from '../../lib/api/master-products'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getGSTSlabOptions, isValidGSTSlab } from '../../lib/constants/gstSlabs'

interface ProductFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ProductFormData) => Promise<Product | void>
  product?: Product | null
  title?: string
  orgId?: string
  userId?: string
  prefillQuery?: string // Pre-fill SKU/EAN from unknown entry
}

export function ProductForm({ isOpen, onClose, onSubmit, product, title, orgId, userId, prefillQuery }: ProductFormProps) {
  const [sourceType, setSourceType] = useState<'master' | 'new'>('master')
  const [masterSearchQuery, setMasterSearchQuery] = useState('')
  const [masterSearchResults, setMasterSearchResults] = useState<MasterProduct[]>([])
  const [selectedMasterProduct, setSelectedMasterProduct] = useState<MasterProduct | null>(null)
  const [searchingMaster, setSearchingMaster] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEditMode = !!product
  const canUseMaster = !isEditMode && !!orgId

  const [formData, setFormData] = useState<ProductFormData>({
    name: product?.name || '',
    sku: product?.sku || (prefillQuery || ''),
    ean: product?.ean || (prefillQuery || ''),
    description: product?.description || '',
    category: product?.category || '',
    unit: product?.unit || 'pcs',
    cost_price: product?.cost_price || undefined,
    selling_price: product?.selling_price || undefined,
    min_stock_level: product?.min_stock_level || 0,
    tax_rate: product?.tax_rate ?? null,
    hsn_sac_code: product?.hsn_sac_code ?? null,
  })

  // Update form when prefillQuery changes (for unknown entry flow)
  useEffect(() => {
    if (prefillQuery && !product && isOpen) {
      // Pre-fill SKU/EAN with the unknown query
      // Try to detect if it's likely a barcode (longer) or SKU (shorter)
      const isLikelyBarcode = prefillQuery.length >= 8
      setFormData(prev => ({
        ...prev,
        sku: isLikelyBarcode ? prev.sku : prefillQuery,
        ean: isLikelyBarcode ? prefillQuery : prev.ean,
      }))
    }
  }, [prefillQuery, product, isOpen])

  // Search master products with debounce
  const searchMaster = useCallback(async (query: string) => {
    if (!query.trim()) {
      setMasterSearchResults([])
      return
    }

    setSearchingMaster(true)
    try {
      const results = await searchMasterProducts({ q: query, limit: 10 })
      setMasterSearchResults(results)
    } catch (error) {
      console.error('Error searching master products:', error)
      setMasterSearchResults([])
    } finally {
      setSearchingMaster(false)
    }
  }, [])

  // Debounced master search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (masterSearchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchMaster(masterSearchQuery)
      }, 300)
    } else {
      setMasterSearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [masterSearchQuery, searchMaster])

  // Handle master product selection
  const handleSelectMasterProduct = (masterProduct: MasterProduct) => {
    setSelectedMasterProduct(masterProduct)
    setMasterSearchQuery('')
    setMasterSearchResults([])

    // Prefill form with master product defaults
    setFormData({
      name: masterProduct.name,
      sku: masterProduct.sku,
      ean: masterProduct.barcode_ean || '',
      description: '',
      category: masterProduct.category || '',
      unit: masterProduct.base_unit || 'pcs',
      cost_price: undefined,
      selling_price: masterProduct.base_price || undefined,
      min_stock_level: 0,
      tax_rate: null, // Org-specific override (defaults to master)
      hsn_sac_code: null, // Org-specific override (defaults to master)
    })
  }

  // Update form data when product changes (for edit mode)
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        ean: product.ean || '',
        description: product.description || '',
        category: product.category || '',
        unit: product.unit || 'pcs',
        cost_price: product.cost_price || undefined,
        selling_price: product.selling_price || undefined,
        min_stock_level: product.min_stock_level || 0,
        tax_rate: product.tax_rate ?? null,
        hsn_sac_code: product.hsn_sac_code ?? null,
      })
      setSourceType('new') // Edit mode always uses 'new'
      setSelectedMasterProduct(null)
    } else {
      // Reset form for new product
      setFormData({
        name: '',
        sku: '',
        ean: '',
        description: '',
        category: '',
        unit: 'pcs',
        cost_price: undefined,
        selling_price: undefined,
        min_stock_level: 0,
        tax_rate: null,
        hsn_sac_code: null,
      })
      setSourceType('master') // Default to master search
      setSelectedMasterProduct(null)
      setMasterSearchQuery('')
      setMasterSearchResults([])
    }
  }, [product, isOpen])

  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Reset errors
    setErrors({})

    // Validation
    const newErrors: Partial<Record<keyof ProductFormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required'
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required'
    }

    if (formData.cost_price !== undefined && formData.cost_price < 0) {
      newErrors.cost_price = 'Cost price cannot be negative'
    }

    if (formData.selling_price !== undefined && formData.selling_price < 0) {
      newErrors.selling_price = 'Selling price cannot be negative'
    }

    if ((formData.min_stock_level ?? 0) < 0) {
      newErrors.min_stock_level = 'Minimum stock level cannot be negative'
    }

    // Validate tax_rate if provided (must be valid GST slab)
    if (formData.tax_rate !== null && formData.tax_rate !== undefined) {
      if (!isValidGSTSlab(formData.tax_rate)) {
        newErrors.tax_rate = 'Tax rate must be one of the standard GST slabs: 0%, 5%, 12%, 18%, or 28%'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    console.log('[ProductForm] Submitting product:', formData)
    try {
      let createdProduct: Product | undefined

      // If creating from master product, use createProductFromMaster
      if (canUseMaster && sourceType === 'master' && selectedMasterProduct && orgId) {
        console.log('[ProductForm] Creating from master product:', selectedMasterProduct.id)
        createdProduct = await createProductFromMaster(orgId, {
          master_product_id: selectedMasterProduct.id,
          alias_name: formData.name !== selectedMasterProduct.name ? formData.name : undefined,
          unit: formData.unit !== selectedMasterProduct.base_unit ? formData.unit : undefined,
          selling_price: formData.selling_price !== selectedMasterProduct.base_price ? formData.selling_price : undefined,
          cost_price: formData.cost_price,
          min_stock_level: formData.min_stock_level,
          sku: formData.sku !== selectedMasterProduct.sku ? formData.sku : undefined,
          barcode_ean: formData.ean !== selectedMasterProduct.barcode_ean ? formData.ean : undefined,
          category: formData.category !== selectedMasterProduct.category ? formData.category : undefined,
        }, userId)

        // Also call parent's onSubmit with the created product data so parent can handle it
        // This ensures the parent (PurchaseBillsPage) can add it to the bill
        if (createdProduct) {
          await onSubmit({
            name: createdProduct.name,
            sku: createdProduct.sku,
            ean: createdProduct.ean || '',
            description: createdProduct.description || '',
            category: createdProduct.category || '',
            unit: createdProduct.unit,
            cost_price: createdProduct.cost_price || undefined,
            selling_price: createdProduct.selling_price || undefined,
            min_stock_level: createdProduct.min_stock_level,
            tax_rate: createdProduct.tax_rate ?? null,
            hsn_sac_code: createdProduct.hsn_sac_code ?? null,
          })
        }
      } else {
        // Use regular create/update flow - onSubmit may return Product
        console.log('[ProductForm] Calling onSubmit with formData')
        const result = await onSubmit(formData)
        console.log('[ProductForm] onSubmit result:', result)
        if (result) {
          createdProduct = result as Product
        }
      }

      console.log('[ProductForm] Product created/updated successfully:', createdProduct)

      // Reset form before closing
      setFormData({
        name: '',
        sku: '',
        ean: '',
        description: '',
        category: '',
        unit: 'pcs',
        cost_price: undefined,
        selling_price: undefined,
        min_stock_level: 0,
        tax_rate: null,
        hsn_sac_code: null,
      })
      setSelectedMasterProduct(null)
      setSourceType('master')
      setMasterSearchQuery('')
      setMasterSearchResults([])

      onClose()

      // Return created product for parent to use (if needed)
      return createdProduct
    } catch (error) {
      console.error('[ProductForm] Error submitting product form:', error)
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : 'Failed to save product'
      alert(`Error: ${errorMessage}`)

      // Handle error (set field-specific errors)
      if (error instanceof Error) {
        if (error.message.includes('SKU')) {
          setErrors({ sku: error.message })
        } else if (error.message.includes('already linked')) {
          setErrors({ name: error.message })
        } else {
          setErrors({ name: error.message })
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Source Selection (only for new products) */}
      {canUseMaster && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-secondary-text">Choose Source</label>
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={() => {
                setSourceType('master')
                setSelectedMasterProduct(null)
                setMasterSearchQuery('')
                setMasterSearchResults([])
                setFormData({
                  name: '',
                  sku: '',
                  ean: '',
                  description: '',
                  category: '',
                  unit: 'pcs',
                  cost_price: undefined,
                  selling_price: undefined,
                  min_stock_level: 0,
                  tax_rate: null,
                  hsn_sac_code: null,
                })
              }}
              className={`flex-1 rounded-md px-md py-sm min-h-[44px] text-sm font-medium transition-colors ${sourceType === 'master'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
                }`}
            >
              Search Master Catalog
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceType('new')
                setSelectedMasterProduct(null)
                setMasterSearchQuery('')
                setMasterSearchResults([])
                setFormData({
                  name: '',
                  sku: '',
                  ean: '',
                  description: '',
                  category: '',
                  unit: 'pcs',
                  cost_price: undefined,
                  selling_price: undefined,
                  min_stock_level: 0,
                  tax_rate: null,
                  hsn_sac_code: null,
                })
              }}
              className={`flex-1 rounded-md px-md py-sm min-h-[44px] text-sm font-medium transition-colors ${sourceType === 'new'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-neutral-100 text-secondary-text hover:bg-neutral-200'
                }`}
            >
              Create New Product
            </button>
          </div>
        </div>
      )}

      {/* Master Product Search */}
      {canUseMaster && sourceType === 'master' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-secondary-text">Search Master Products</label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              placeholder="Search by SKU, EAN, or name..."
              value={masterSearchQuery}
              onChange={(e) => setMasterSearchQuery(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-bg-card py-sm pl-[2.5rem] pr-md text-sm min-h-[44px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={isSubmitting}
              aria-label="Search master products"
            />
          </div>

          {/* Master Product Results */}
          {masterSearchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-200 bg-bg-card">
              {masterSearchResults.map((mp) => (
                <button
                  key={mp.id}
                  type="button"
                  onClick={() => handleSelectMasterProduct(mp)}
                  className={`w-full px-md py-md min-h-[44px] text-left hover:bg-neutral-50 transition-colors ${selectedMasterProduct?.id === mp.id ? 'bg-primary-light border-l-4 border-primary' : ''
                    }`}
                >
                  <div className="font-medium text-sm text-primary-text">{mp.name}</div>
                  <div className="text-xs text-secondary-text mt-xs">
                    SKU: {mp.sku} {mp.barcode_ean && `• EAN: ${mp.barcode_ean}`}
                    {mp.base_price && ` • ₹${mp.base_price.toFixed(2)}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchingMaster && (
            <p className="text-sm text-muted-text">Searching...</p>
          )}

          {selectedMasterProduct && (
            <div className="rounded-md border border-primary-light bg-primary-light p-md">
              <div className="text-sm font-medium text-primary-text">Selected: {selectedMasterProduct.name}</div>
              <div className="text-xs text-primary-text mt-xs">
                Master SKU: {selectedMasterProduct.sku} • Defaults will be prefilled below
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Information Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-primary-text border-b border-neutral-200 pb-sm">Product Information</h3>

        <Input
          label="Product Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          disabled={isSubmitting}
          type="text"
        />
        {selectedMasterProduct && sourceType === 'master' && (
          <p className="text-xs text-muted-text -mt-sm">Using master name as alias (you can override)</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="SKU"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
            error={errors.sku}
            required
            disabled={isSubmitting}
            type="text"
          />
          <Input
            label="EAN (Barcode)"
            value={formData.ean || ''}
            onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
            error={errors.ean}
            disabled={isSubmitting}
            placeholder="Optional"
            type="text"
          />
        </div>
        {selectedMasterProduct && sourceType === 'master' && (
          <p className="text-xs text-muted-text -mt-sm">Using master SKU (you can override with org-specific SKU)</p>
        )}

        <Textarea
          label="Description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          error={errors.description}
          disabled={isSubmitting}
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Category"
            value={formData.category || ''}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            error={errors.category}
            disabled={isSubmitting}
            type="text"
          />

          <Input
            label="Unit"
            value={formData.unit || 'pcs'}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            error={errors.unit}
            required
            disabled={isSubmitting}
            placeholder="pcs, kg, liters"
            type="text"
          />
        </div>
      </div>

      {/* Pricing & Inventory Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-primary-text border-b border-neutral-200 pb-sm">Pricing & Inventory</h3>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Cost Price"
            type="number"
            step="0.01"
            min="0"
            value={formData.cost_price?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                cost_price: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            error={errors.cost_price}
            disabled={isSubmitting}
            placeholder="0.00"
          />

          <Input
            label="Selling Price"
            type="number"
            step="0.01"
            min="0"
            value={formData.selling_price?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                selling_price: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            error={errors.selling_price}
            disabled={isSubmitting}
            placeholder="0.00"
          />
        </div>

        <Input
          label="Minimum Stock Level"
          type="number"
          min="0"
          step="1"
          value={formData.min_stock_level?.toString() || '0'}
          onChange={(e) =>
            setFormData({
              ...formData,
              min_stock_level: parseInt(e.target.value) || 0,
            })
          }
          error={errors.min_stock_level}
          disabled={isSubmitting}
        />
      </div>

      {/* Tax & HSN/SAC Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-primary-text border-b border-neutral-200 pb-sm">Tax & Classification</h3>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tax Rate (%)"
            value={formData.tax_rate?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                tax_rate: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            error={errors.tax_rate}
            disabled={isSubmitting}
            options={[
              { value: '', label: 'Use Master Default' },
              ...getGSTSlabOptions(),
            ]}
          />

          <Input
            label="HSN/SAC Code"
            value={formData.hsn_sac_code || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                hsn_sac_code: e.target.value.trim() || null,
              })
            }
            error={errors.hsn_sac_code}
            disabled={isSubmitting}
            placeholder="Optional (uses master default if empty)"
            type="text"
          />
        </div>
        <p className="text-xs text-muted-text -mt-sm">
          Leave empty to use master product defaults. Set org-specific values to override.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {product ? 'Update Product' : sourceType === 'master' && selectedMasterProduct ? 'Create from Master' : 'Create Product'}
        </Button>
      </div>
    </form>
  )

  const formTitle = title || (product ? 'Edit Product' : 'Add Product')

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

