import { useState, FormEvent, useEffect, useMemo } from 'react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import type { Product } from '../../types'
import { getAllProducts } from '../../lib/api/products'
import { getCurrentStock } from '../../lib/api/stockCalculations'
import { adjustStockLevel } from '../../lib/api/stockLedger'

interface ManualAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  orgId: string
}

export function ManualAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
}: ManualAdjustmentModalProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    delta: 0,
    notes: '',
  })

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof typeof formData, string>>>({})
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

  // Load current stock when product is selected
  useEffect(() => {
    if (formData.product_id && orgId) {
      getCurrentStock(formData.product_id, orgId)
        .then(setCurrentStock)
        .catch((error) => {
          console.error('Error loading current stock:', error)
          setCurrentStock(null)
        })
    } else {
      setCurrentStock(null)
    }
  }, [formData.product_id, orgId])

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === formData.product_id)
  }, [products, formData.product_id])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: typeof errors = {}

    if (!formData.product_id) {
      newErrors.product_id = 'Product is required'
    }

    if (formData.delta === 0) {
      newErrors.delta = 'Adjustment cannot be zero'
    }

    if (!formData.notes || formData.notes.trim() === '') {
      newErrors.notes = 'Reason is mandatory for adjustments'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await adjustStockLevel(orgId, formData.product_id, formData.delta, formData.notes)
      onSuccess()
      onClose()
      setFormData({
        product_id: '',
        delta: 0,
        notes: '',
      })
    } catch (error) {
      console.error('Error adjusting stock:', error)
      if (error instanceof Error) {
        setErrors({ product_id: error.message }) // Show general error on product or separate field
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.sku})`,
  }))

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Product *"
        value={formData.product_id}
        onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
        options={productOptions}
        error={errors.product_id}
        required
        disabled={isSubmitting || loadingProducts}
      />

      {/* Current Stock Display */}
      {formData.product_id && currentStock !== null && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-secondary-text">Current Stock:</span>
            <span className="text-base font-semibold text-primary-text">
              {currentStock} {selectedProduct?.unit || 'pcs'}
            </span>
          </div>
        </div>
      )}

      <Input
        label="Adjustment Quantity (+/-) *"
        type="number"
        step="1"
        value={formData.delta.toString()}
        onChange={(e) =>
          setFormData({
            ...formData,
            delta: parseInt(e.target.value) || 0,
          })
        }
        error={errors.delta}
        required
        disabled={isSubmitting}
        placeholder="e.g. 5 or -2"
        helperText="Positive to add stock, negative to remove"
      />

      {/* Predicted Stock Preview */}
      {currentStock !== null && formData.delta !== 0 && (
         <div className="rounded-md border border-primary-light bg-primary-light p-md">
           <div className="flex items-center justify-between">
             <span className="text-sm font-medium text-primary-text">New Stock Level:</span>
             <span className="text-base font-semibold text-primary-text">
               {currentStock + formData.delta} {selectedProduct?.unit || 'pcs'}
             </span>
           </div>
         </div>
      )}

      <Textarea
        label="Reason (Mandatory) *"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        error={errors.notes}
        required
        disabled={isSubmitting}
        rows={3}
        placeholder="Explain the reason for this manual adjustment (e.g. Audit correction, Damage)"
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
          Apply Adjustment
        </Button>
      </div>
    </form>
  )

  const title = 'Manual Stock Adjustment'

  if (isMobileDevice()) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={title}>
        {FormContent}
      </Drawer>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {FormContent}
    </Modal>
  )
}

