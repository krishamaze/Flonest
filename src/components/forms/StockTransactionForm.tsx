import { useState, FormEvent, useEffect, useMemo } from 'react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import type { StockLedgerFormData, Product } from '../../types'
import { getAllProducts } from '../../lib/api/products'
import { getCurrentStock, calculateStockAfterTransaction } from '../../lib/api/stockCalculations'

interface StockTransactionFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: StockLedgerFormData) => Promise<void>
  orgId: string
  title?: string
}

export function StockTransactionForm({
  isOpen,
  onClose,
  onSubmit,
  orgId,
  title,
}: StockTransactionFormProps) {
  const [formData, setFormData] = useState<StockLedgerFormData>({
    product_id: '',
    transaction_type: 'in',
    quantity: 1,
    notes: '',
  })

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof StockLedgerFormData, string>>>({})
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

  // Calculate stock after transaction
  const stockAfterTransaction = useMemo(() => {
    if (currentStock === null || !formData.quantity) return null
    return calculateStockAfterTransaction(
      currentStock,
      formData.transaction_type,
      formData.quantity
    )
  }, [currentStock, formData.transaction_type, formData.quantity])

  // Get selected product details
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === formData.product_id)
  }, [products, formData.product_id])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Reset errors
    setErrors({})

    // Validation
    const newErrors: Partial<Record<keyof StockLedgerFormData, string>> = {}

    if (!formData.product_id) {
      newErrors.product_id = 'Product is required'
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0'
    }

    // Validate stock availability for stock-out transactions
    if (formData.transaction_type === 'out' && currentStock !== null) {
      if (formData.quantity > currentStock) {
        newErrors.quantity = `Insufficient stock. Available: ${currentStock} ${selectedProduct?.unit || 'pcs'}`
      }
    }

    if (!formData.transaction_type) {
      newErrors.transaction_type = 'Transaction type is required'
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
        product_id: '',
        transaction_type: 'in',
        quantity: 1,
        notes: '',
      })
    } catch (error) {
      console.error('Error submitting stock transaction:', error)
      if (error instanceof Error) {
        setErrors({ product_id: error.message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const transactionTypeOptions = [
    { value: 'in', label: 'Stock In' },
    { value: 'out', label: 'Stock Out' },
    { value: 'adjustment', label: 'Adjustment' },
  ]

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
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Current Stock:</span>
            <span className="text-base font-semibold text-gray-900">
              {currentStock} {selectedProduct?.unit || 'pcs'}
            </span>
          </div>
          {selectedProduct?.min_stock_level && currentStock < selectedProduct.min_stock_level && (
            <p className="mt-1 text-xs text-yellow-600">
              ⚠ Low stock (minimum: {selectedProduct.min_stock_level} {selectedProduct.unit || 'pcs'})
            </p>
          )}
        </div>
      )}

      <Select
        label="Transaction Type *"
        value={formData.transaction_type}
        onChange={(e) =>
          setFormData({
            ...formData,
            transaction_type: e.target.value as 'in' | 'out' | 'adjustment',
          })
        }
        options={transactionTypeOptions}
        error={errors.transaction_type}
        required
        disabled={isSubmitting}
      />

      <Input
        label="Quantity"
        type="number"
        min="1"
        step="1"
        value={formData.quantity.toString()}
        onChange={(e) =>
          setFormData({
            ...formData,
            quantity: parseInt(e.target.value) || 1,
          })
        }
        error={errors.quantity}
        required
        disabled={isSubmitting}
        placeholder="Enter quantity"
      />

      {/* Stock After Transaction Preview */}
      {stockAfterTransaction !== null && formData.product_id && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary-700">Stock After Transaction:</span>
            <span className={`text-base font-semibold ${
              stockAfterTransaction < 0 
                ? 'text-red-600' 
                : stockAfterTransaction < (selectedProduct?.min_stock_level || 0)
                ? 'text-yellow-600'
                : 'text-primary-900'
            }`}>
              {stockAfterTransaction < 0 ? '0' : stockAfterTransaction} {selectedProduct?.unit || 'pcs'}
            </span>
          </div>
          {stockAfterTransaction < 0 && (
            <p className="mt-1 text-xs text-red-600">
              ⚠ This transaction would result in negative stock
            </p>
          )}
        </div>
      )}

      <Textarea
        label="Notes"
        value={formData.notes || ''}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        error={errors.notes}
        disabled={isSubmitting}
        rows={3}
        placeholder="Optional notes about this transaction"
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
          Create Transaction
        </Button>
      </div>
    </form>
  )

  const formTitle = title || 'Stock Transaction'

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

