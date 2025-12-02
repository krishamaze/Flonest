import { useState, useEffect, useMemo } from 'react'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { isMobileDevice } from '../../lib/deviceDetection'
import { ProductSelectionCombobox } from '../products/ProductSelectionCombobox'
import { useProductSelection, type UseProductSelectionReturn } from '../../hooks/useProductSelection'
import { getCurrentStock } from '../../lib/api/stockCalculations'

interface StockAdjustmentModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: { product_id: string; quantity: number; notes?: string }) => Promise<void>
    orgId: string
    title?: string
}

export function StockAdjustmentModal({
    isOpen,
    onClose,
    onSubmit,
    orgId,
    title = 'Stock Adjustment',
}: StockAdjustmentModalProps) {
    // Use product selection hook
    const productSelection: UseProductSelectionReturn = useProductSelection({
        orgId,
        onError: (message) => {
            console.error('Product selection error:', message)
        },
        onProductCreated: (product) => {
            console.log('Product created:', product)
        },
        onProductSelected: (product) => {
            console.log('Product selected:', product)
        },
    })

    // Local state for adjustment
    const [adjustmentQty, setAdjustmentQty] = useState<number>(0)
    const [reason, setReason] = useState('')
    const [currentStock, setCurrentStock] = useState<number | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Load current stock when product is selected
    useEffect(() => {
        if (productSelection.selectedProduct && orgId) {
            getCurrentStock(productSelection.selectedProduct.id, orgId)
                .then(setCurrentStock)
                .catch((error) => {
                    console.error('Error loading current stock:', error)
                    setCurrentStock(null)
                })
        } else {
            setCurrentStock(null)
        }
    }, [productSelection.selectedProduct, orgId])

    // Calculate stock after adjustment
    const stockAfterAdjustment = useMemo(() => {
        if (currentStock === null) return null
        return currentStock + adjustmentQty
    }, [currentStock, adjustmentQty])

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            productSelection.resetSelection()
            setAdjustmentQty(0)
            setReason('')
            setCurrentStock(null)
            setErrors({})
        }
    }, [isOpen, productSelection])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const newErrors: Record<string, string> = {}

        if (!productSelection.selectedProduct) {
            newErrors.product = 'Product is required'
        }

        if (adjustmentQty === 0) {
            newErrors.qty = 'Adjustment quantity cannot be zero'
        }

        if (currentStock !== null && stockAfterAdjustment !== null && stockAfterAdjustment < 0) {
            newErrors.qty = 'Adjustment would result in negative stock'
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        setIsSubmitting(true)
        try {
            await onSubmit({
                product_id: productSelection.selectedProduct!.id,
                quantity: adjustmentQty, // Pass signed delta (not Math.abs)
                notes: reason || undefined,
            })
            onClose()
        } catch (error) {
            console.error('Error submitting adjustment:', error)
            setErrors({ submit: error instanceof Error ? error.message : 'Failed to submit adjustment' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const FormContent = (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Selection */}
            <ProductSelectionCombobox
                searchTerm={productSelection.searchTerm}
                setSearchTerm={productSelection.setSearchTerm}
                isSearching={productSelection.isSearching}
                searchResults={productSelection.searchResults}
                masterResults={productSelection.masterResults}
                selectedProduct={productSelection.selectedProduct}
                onProductSelect={(product) => {
                    if (product) {
                        productSelection.handleProductSelected(product)
                    }
                }}
                onOpenAddNewForm={productSelection.handleOpenAddNewForm}
                onLinkMasterProduct={productSelection.handleLinkMasterProduct}
                autoFocus={true}
            />
            {errors.product && (
                <p className="text-sm text-error mt-xs">{errors.product}</p>
            )}

            {/* Inline Add New Product Form */}
            {productSelection.showAddNewForm && (
                <div className="rounded-md border border-primary-light bg-primary-light bg-opacity-10 p-md space-y-3">
                    <h4 className="text-sm font-semibold text-primary-text">Add New Product</h4>

                    <Input
                        label="Product Name *"
                        value={productSelection.inlineFormData.name}
                        onChange={(e) =>
                            productSelection.handleFormDataChange({ name: e.target.value })
                        }
                        error={productSelection.formErrors.name}
                        placeholder="Enter product name"
                    />

                    <Input
                        label="SKU *"
                        value={productSelection.inlineFormData.sku}
                        onChange={(e) =>
                            productSelection.handleFormDataChange({ sku: e.target.value })
                        }
                        error={productSelection.formErrors.sku}
                        placeholder="Enter SKU"
                    />

                    <Input
                        label="Selling Price"
                        type="number"
                        step="0.01"
                        value={productSelection.inlineFormData.selling_price?.toString() || ''}
                        onChange={(e) =>
                            productSelection.handleFormDataChange({
                                selling_price: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                        }
                        error={productSelection.formErrors.selling_price}
                        placeholder="Enter selling price (optional)"
                    />

                    <Input
                        label="HSN/SAC Code"
                        value={productSelection.inlineFormData.hsn_sac_code}
                        onChange={(e) =>
                            productSelection.handleFormDataChange({ hsn_sac_code: e.target.value })
                        }
                        placeholder="Enter HSN/SAC code (optional)"
                    />

                    {productSelection.formErrors.submit && (
                        <p className="text-sm text-error">{productSelection.formErrors.submit}</p>
                    )}

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={productSelection.handleCreateProduct}
                            isLoading={productSelection.isSearching}
                            disabled={!productSelection.isFormDataValid}
                        >
                            Create Product
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={productSelection.handleCloseAddNewForm}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Current Stock Display */}
            {productSelection.selectedProduct && currentStock !== null && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-md">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-secondary-text">Current Stock:</span>
                        <span className="text-base font-semibold text-primary-text">
                            {currentStock} {productSelection.selectedProduct.unit || 'pcs'}
                        </span>
                    </div>
                </div>
            )}

            {/* Adjustment Quantity (+/-) */}
            <div>
                <label className="block text-sm font-medium text-secondary-text mb-xs">
                    Adjustment Quantity <span className="text-error">*</span>
                </label>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setAdjustmentQty((prev) => prev - 1)}
                        disabled={!productSelection.selectedProduct}
                    >
                        -
                    </Button>
                    <Input
                        type="number"
                        value={adjustmentQty.toString()}
                        onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                        error={errors.qty}
                        disabled={!productSelection.selectedProduct}
                        placeholder="0"
                        className="flex-1 text-center"
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setAdjustmentQty((prev) => prev + 1)}
                        disabled={!productSelection.selectedProduct}
                    >
                        +
                    </Button>
                </div>
                <p className="text-xs text-secondary-text mt-xs">
                    Use + to increase stock, - to decrease stock
                </p>
            </div>

            {/* Stock After Adjustment Preview */}
            {stockAfterAdjustment !== null && productSelection.selectedProduct && (
                <div className="rounded-md border border-primary-light bg-primary-light p-md">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary-text">Stock After Adjustment:</span>
                        <span
                            className={`text-base font-semibold ${stockAfterAdjustment < 0
                                    ? 'text-error'
                                    : stockAfterAdjustment < (productSelection.selectedProduct.min_stock_level || 0)
                                        ? 'text-warning'
                                        : 'text-primary-text'
                                }`}
                        >
                            {stockAfterAdjustment < 0 ? '0' : stockAfterAdjustment}{' '}
                            {productSelection.selectedProduct.unit || 'pcs'}
                        </span>
                    </div>
                    {stockAfterAdjustment < 0 && (
                        <p className="mt-xs text-xs text-error">
                            ⚠ This adjustment would result in negative stock
                        </p>
                    )}
                </div>
            )}

            {/* Reason */}
            <Textarea
                label="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for stock adjustment"
            />

            {errors.submit && (
                <p className="text-sm text-error">{errors.submit}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                    Submit Adjustment
                </Button>
            </div>
        </form>
    )

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
