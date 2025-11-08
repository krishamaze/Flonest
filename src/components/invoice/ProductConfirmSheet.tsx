import { useState, useEffect, useRef } from 'react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { ProductWithMaster } from '../../types'
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline'

interface ProductConfirmSheetProps {
  isOpen: boolean
  product: ProductWithMaster | null
  onConfirm: (quantity: number, serial?: string) => void
  onCancel: () => void
  defaultQuantity?: number
  scannerMode?: 'closed' | 'scanning' | 'confirming'
}

/**
 * ProductConfirmSheet Component
 * Bottom sheet for confirming product details after scan/selection
 * Supports quantity input and conditional serial number input
 */
export function ProductConfirmSheet({
  isOpen,
  product,
  onConfirm,
  onCancel,
  defaultQuantity = 1,
  scannerMode = 'closed',
}: ProductConfirmSheetProps) {
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [serial, setSerial] = useState('')
  const serialInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)

  // Reset state when sheet opens/closes or product changes
  useEffect(() => {
    if (isOpen && product) {
      setQuantity(defaultQuantity)
      setSerial('')
    }
  }, [isOpen, product, defaultQuantity])

  // Auto-focus serial input if required (300ms delay for animation)
  useEffect(() => {
    if (isOpen && product?.serial_tracked) {
      const timer = setTimeout(() => {
        serialInputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    } else if (isOpen && !product?.serial_tracked) {
      // Focus quantity input if serial not required
      const timer = setTimeout(() => {
        quantityInputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, product])

  const handleQuantityChange = (newQuantity: number) => {
    const qty = Math.max(1, Math.floor(newQuantity))
    setQuantity(qty)
  }

  const handleIncrement = () => {
    handleQuantityChange(quantity + 1)
  }

  const handleDecrement = () => {
    handleQuantityChange(quantity - 1)
  }

  const handleConfirm = () => {
    if (product) {
      if (product.serial_tracked && !serial.trim()) {
        // Serial is required but not provided
        return
      }
      onConfirm(quantity, serial.trim() || undefined)
    }
  }

  if (!product) return null

  const isSerialRequired = product.serial_tracked
  const canConfirm = !isSerialRequired || (isSerialRequired && serial.trim())

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onCancel}
      title={product.name}
      className="max-h-[60vh]"
      hideBackdrop={scannerMode === 'confirming'} // Hide default backdrop when scanner is active
      customZIndex={10000} // z-index 10000 for confirmation sheet
    >
      <div className="space-y-md">
        {/* Product Details */}
        <div className="space-y-xs">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-secondary-text">SKU:</span>
            <span className="text-sm text-primary-text">{product.sku || 'N/A'}</span>
          </div>
          {product.master_product?.name && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-secondary-text">Model:</span>
              <span className="text-sm text-primary-text">{product.master_product.name}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-secondary-text">Price:</span>
            <span className="text-lg font-semibold text-primary-text">
              ${product.selling_price?.toFixed(2) || '0.00'}
            </span>
          </div>
          {quantity > 1 && (
            <div className="flex justify-between items-center pt-xs border-t border-neutral-200">
              <span className="text-sm font-medium text-secondary-text">Total:</span>
              <span className="text-lg font-semibold text-primary">
                ${((product.selling_price || 0) * quantity).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Conditional Serial Number Input or Quantity Stepper */}
        {isSerialRequired ? (
          <Input
            ref={serialInputRef}
            label="Serial Number"
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Enter serial number"
            required
            error={!serial.trim() ? 'Serial number is required' : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) {
                e.preventDefault()
                handleConfirm()
              }
            }}
          />
        ) : (
          <div className="space-y-xs">
            <label className="block text-sm font-medium text-secondary-text">
              Quantity
            </label>
            <div className="flex items-center gap-sm">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={quantity <= 1}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-neutral-300 bg-bg-card text-primary-text hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                aria-label="Decrease quantity"
              >
                <MinusIcon className="h-5 w-5" />
              </button>
              <input
                ref={quantityInputRef}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1
                  handleQuantityChange(value)
                }}
                className="w-20 text-center min-h-[44px] px-md py-sm border border-neutral-300 rounded-md bg-bg-card text-base text-primary-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2"
                aria-label="Quantity"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) {
                    e.preventDefault()
                    handleConfirm()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleIncrement}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-neutral-300 bg-bg-card text-primary-text hover:bg-neutral-100 active:bg-neutral-200 transition-colors touch-manipulation"
                aria-label="Increase quantity"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-md pt-md">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1 min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 min-h-[44px]"
          >
            Add & Continue
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

