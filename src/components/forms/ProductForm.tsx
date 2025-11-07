import { useState, FormEvent, useEffect, useCallback, useRef } from 'react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import type { ProductFormData, Product } from '../../types'
import { searchMasterProducts } from '../../lib/api/master-products'
import { createProductFromMaster } from '../../lib/api/products'
import type { MasterProduct } from '../../lib/api/master-products'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface ProductFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ProductFormData) => Promise<void>
  product?: Product | null
  title?: string
  orgId?: string
  userId?: string
}

export function ProductForm({ isOpen, onClose, onSubmit, product, title, orgId, userId }: ProductFormProps) {
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
    sku: product?.sku || '',
    ean: product?.ean || '',
    description: product?.description || '',
    category: product?.category || '',
    unit: product?.unit || 'pcs',
    cost_price: product?.cost_price || undefined,
    selling_price: product?.selling_price || undefined,
    min_stock_level: product?.min_stock_level || 0,
  })

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

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    try {
      // If creating from master product, use createProductFromMaster
      if (canUseMaster && sourceType === 'master' && selectedMasterProduct && orgId) {
        await createProductFromMaster(orgId, {
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
      } else {
        // Use regular create/update flow
        await onSubmit(formData)
      }
      
      onClose()
      // Reset form
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
      })
      setSelectedMasterProduct(null)
      setSourceType('master')
      setMasterSearchQuery('')
      setMasterSearchResults([])
    } catch (error) {
      console.error('Error submitting product form:', error)
      // Handle error (could show toast notification)
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
          <label className="block text-sm font-medium text-gray-700">Choose Source</label>
          <div className="flex gap-2">
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
                })
              }}
              className={`flex-1 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                sourceType === 'master'
                  ? 'bg-primary-600 text-black font-semibold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                })
              }}
              className={`flex-1 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                sourceType === 'new'
                  ? 'bg-primary-600 text-black font-semibold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          <label className="block text-sm font-medium text-gray-700">Search Master Products</label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU, EAN, or name..."
              value={masterSearchQuery}
              onChange={(e) => setMasterSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm min-h-[44px] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              disabled={isSubmitting}
              aria-label="Search master products"
            />
          </div>
          
          {/* Master Product Results */}
          {masterSearchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
              {masterSearchResults.map((mp) => (
                <button
                  key={mp.id}
                  type="button"
                  onClick={() => handleSelectMasterProduct(mp)}
                  className={`w-full px-4 py-3 min-h-[44px] text-left hover:bg-gray-50 transition-colors ${
                    selectedMasterProduct?.id === mp.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">{mp.name}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    SKU: {mp.sku} {mp.barcode_ean && `• EAN: ${mp.barcode_ean}`}
                    {mp.base_price && ` • ₹${mp.base_price.toFixed(2)}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchingMaster && (
            <p className="text-sm text-gray-500">Searching...</p>
          )}

          {selectedMasterProduct && (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
              <div className="text-sm font-medium text-primary-900">Selected: {selectedMasterProduct.name}</div>
              <div className="text-xs text-primary-700 mt-1">
                Master SKU: {selectedMasterProduct.sku} • Defaults will be prefilled below
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Information Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">Product Information</h3>
        
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
          <p className="text-xs text-gray-500 -mt-2">Using master name as alias (you can override)</p>
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
          <p className="text-xs text-gray-500 -mt-2">Using master SKU (you can override with org-specific SKU)</p>
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
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">Pricing & Inventory</h3>
        
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

