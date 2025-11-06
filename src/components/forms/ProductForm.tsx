import { useState, FormEvent, useEffect } from 'react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import type { ProductFormData, Product } from '../../types'

interface ProductFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ProductFormData) => Promise<void>
  product?: Product | null
  title?: string
}

export function ProductForm({ isOpen, onClose, onSubmit, product, title }: ProductFormProps) {
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
      await onSubmit(formData)
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
    } catch (error) {
      console.error('Error submitting product form:', error)
      // Handle error (could show toast notification)
      if (error instanceof Error) {
        if (error.message.includes('SKU')) {
          setErrors({ sku: error.message })
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
      <Input
        label="Product Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        error={errors.name}
        required
        disabled={isSubmitting}
      />

      <Input
        label="SKU *"
        value={formData.sku}
        onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
        error={errors.sku}
        required
        disabled={isSubmitting}
      />

      <Input
        label="EAN (Barcode)"
        value={formData.ean || ''}
        onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
        error={errors.ean}
        disabled={isSubmitting}
        placeholder="Optional barcode/EAN number"
      />

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
        />

        <Input
          label="Unit *"
          value={formData.unit || 'pcs'}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
          error={errors.unit}
          required
          disabled={isSubmitting}
          placeholder="pcs, kg, liters, boxes"
        />
      </div>

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
        />
      </div>

      <Input
        label="Minimum Stock Level"
        type="number"
        min="0"
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
          {product ? 'Update Product' : 'Create Product'}
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

