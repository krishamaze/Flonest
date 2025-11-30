import React from 'react'
import { InvoiceItemFormData, ProductWithMaster } from '../../types'
import { ProductSearchCombobox } from './ProductSearchCombobox'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { PlusIcon, TrashIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface InvoiceItemsStepProps {
    // Items Data Group
    items: InvoiceItemFormData[]
    products: ProductWithMaster[]
    loadingProducts: boolean
    itemsError?: string

    // Item Actions Group
    onAddItem: () => void
    onRemoveItem: (index: number) => void
    onProductSelect: (product: ProductWithMaster) => void
    onProductChange: (index: number, productId: string) => void
    onItemFieldChange: (index: number, field: keyof InvoiceItemFormData, value: any) => void

    // Serial Tracking Group
    serialInputs: Record<number, string>
    onSerialInputChange: (index: number, value: string) => void
    onAddSerial: (index: number, serial: string) => void
    onRemoveSerial: (itemIndex: number, serialIndex: number) => void

    // Scanner Integration Group
    onScanClick: () => void

    // Context/UI Group
    orgId: string
    isDisabled: boolean
}

export const InvoiceItemsStep: React.FC<InvoiceItemsStepProps> = ({
    items,
    products,
    loadingProducts,
    itemsError,
    onAddItem,
    onRemoveItem,
    onProductSelect,
    onProductChange,
    onItemFieldChange,
    serialInputs,
    onSerialInputChange,
    onAddSerial,
    onRemoveSerial,
    onScanClick,
    orgId,
    isDisabled,
}) => {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-primary-text mb-md">Step 2: Add Products</h3>

                {/* Product Search Combobox */}
                <div className="mb-md">
                    <ProductSearchCombobox
                        onProductSelect={onProductSelect}
                        onScanClick={onScanClick}
                        disabled={isDisabled}
                        orgId={orgId}
                        products={products}
                        placeholder="Search / Select Product..."
                    />
                </div>

                {/* Create New Item Button */}
                <div className="mb-md">
                    <Button
                        type="button"
                        variant="primary"
                        onClick={onAddItem}
                        disabled={isDisabled}
                    >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create New Item
                    </Button>
                </div>

                {/* Items List - Auto-visible when items exist */}
                {items.length === 0 ? (
                    <div className="text-center py-lg border-2 border-dashed border-neutral-300 rounded-md">
                        <p className="text-sm text-secondary-text">No items yet. Search or scan to add products.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {items.map((item, index) => {
                            const hasInvalidSerials = item.invalid_serials && item.invalid_serials.length > 0
                            const hasValidationErrors = item.validation_errors && item.validation_errors.length > 0
                            const hasStockError = item.validation_errors?.some((e: string) => e.includes('Insufficient stock'))
                            const isInvalid = hasInvalidSerials || hasValidationErrors

                            return (
                                <div
                                    key={index}
                                    className={`border rounded-md p-md space-y-md ${isInvalid
                                        ? 'border-error bg-error-light/10'
                                        : 'border-neutral-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-sm">
                                            <h4 className="text-sm font-medium text-primary-text">Item {index + 1}</h4>
                                            {isInvalid && (
                                                <span className="text-xs text-error font-medium" title={item.validation_errors?.join(', ') || 'Item has validation errors'}>
                                                    ⚠️ Needs review
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveItem(index)}
                                            className="text-error hover:text-error-dark"
                                            disabled={isDisabled}
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <Select
                                        label="Product *"
                                        value={item.product_id || ''}
                                        onChange={(e) => {
                                            onProductChange(index, e.target.value)
                                        }}
                                        options={products.length > 0 ? [
                                            { value: '', label: 'Select a product' },
                                            ...products.map((p) => ({
                                                value: p.id,
                                                label: `${p.name} (${p.sku}) - $${p.selling_price?.toFixed(2) || '0.00'}`,
                                            })),
                                        ] : [{ value: '', label: 'No products available' }]}
                                        disabled={isDisabled || loadingProducts}
                                        required
                                    />

                                    {/* Serial Tracking UI */}
                                    {item.serial_tracked ? (
                                        <div className="space-y-sm">
                                            <label className="block text-sm font-medium text-secondary-text">
                                                Serial Numbers ({item.serials?.length || 0})
                                            </label>
                                            {item.serials && item.serials.length > 0 ? (
                                                <div className="space-y-xs">
                                                    {item.serials.map((serial, serialIndex) => {
                                                        const isInvalidSerial = item.invalid_serials?.includes(serial)
                                                        return (
                                                            <div
                                                                key={serialIndex}
                                                                className={`flex items-center justify-between p-sm rounded-md ${isInvalidSerial
                                                                    ? 'bg-error-light border border-error'
                                                                    : 'bg-neutral-50'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-xs">
                                                                    <span className="text-sm text-primary-text font-mono">
                                                                        {serial}
                                                                    </span>
                                                                    {isInvalidSerial && (
                                                                        <span className="text-xs text-error" title="Serial not found in stock">
                                                                            ⚠️
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onRemoveSerial(index, serialIndex)}
                                                                    className="text-error hover:text-error-dark"
                                                                    disabled={isDisabled}
                                                                >
                                                                    <XCircleIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-secondary-text">
                                                    Scan serial numbers for this product
                                                </p>
                                            )}
                                            {hasInvalidSerials && (
                                                <p className="text-xs text-error">
                                                    Some serials not found in stock. Saved as draft for branch head review.
                                                </p>
                                            )}
                                            <Input
                                                label="Add Serial Number"
                                                type="text"
                                                value={serialInputs[index] || ''}
                                                onChange={(e) => {
                                                    onSerialInputChange(index, e.target.value)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        const value = serialInputs[index]?.trim()
                                                        if (value) {
                                                            onAddSerial(index, value)
                                                            onSerialInputChange(index, '')
                                                        }
                                                    }
                                                }}
                                                placeholder="Scan or enter serial number"
                                                disabled={isDisabled}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-md">
                                            {hasStockError && item.stock_available !== undefined && (
                                                <div className="p-sm bg-warning-light border border-warning rounded-md">
                                                    <p className="text-xs text-warning-dark font-medium">
                                                        Insufficient stock. Available: {item.stock_available}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input
                                                    label="Quantity"
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={item.quantity.toString()}
                                                    onChange={(e) =>
                                                        onItemFieldChange(index, 'quantity', parseInt(e.target.value) || 1)
                                                    }
                                                    disabled={isDisabled}
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
                                                        onItemFieldChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                                                    }
                                                    disabled={isDisabled}
                                                    required
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            {hasValidationErrors && !hasStockError && (
                                                <div className="p-sm bg-error-light border border-error rounded-md">
                                                    <p className="text-xs text-error-dark font-medium">
                                                        {item.validation_errors?.join(', ')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="text-right">
                                        <p className="text-sm text-secondary-text">
                                            Line Total: <span className="font-semibold text-primary-text">${item.line_total.toFixed(2)}</span>
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {itemsError && (
                    <p className="mt-sm text-sm text-error">{itemsError}</p>
                )}
            </div>
        </div>
    )
}
