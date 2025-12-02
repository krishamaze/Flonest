import React from 'react'
import { CustomerWithMaster, InvoiceItemFormData, ProductWithMaster } from '../../types'
import type { SupplyType } from '../../lib/utils/taxCalculationService'

interface InvoiceReviewStepProps {
    customer: CustomerWithMaster | null
    items: InvoiceItemFormData[]
    products: ProductWithMaster[]
    totals: {
        subtotal: number
        cgst_amount: number
        sgst_amount: number
        igst_amount: number
        total_amount: number
        tax_label?: string
        supply_type: SupplyType
    }
}

export const InvoiceReviewStep: React.FC<InvoiceReviewStepProps> = ({
    customer,
    items,
    products,
    totals,
}) => {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-primary-text mb-md">Step 3: Review Invoice</h3>

                {/* Customer Info */}
                {customer && (
                    <div className="mb-lg p-md bg-neutral-50 rounded-md">
                        <h4 className="text-sm font-semibold text-primary-text mb-sm">Customer</h4>
                        <p className="text-sm text-primary-text">
                            {customer.alias_name || customer.name || customer.master_customer.legal_name}
                        </p>
                        {customer?.master_customer?.mobile && (
                            <p className="text-xs text-secondary-text">Mobile: {customer.master_customer.mobile}</p>
                        )}
                        {customer?.master_customer?.gstin && (
                            <p className="text-xs text-secondary-text">GSTIN: {customer.master_customer.gstin}</p>
                        )}
                    </div>
                )}

                {/* Items Summary */}
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary-text">Items</h4>
                    {items.map((item, index) => {
                        const product = products.find((p) => p.id === item.product_id) as ProductWithMaster | undefined
                        const hasInvalidSerials = item.invalid_serials && item.invalid_serials.length > 0
                        const hasValidationErrors = item.validation_errors && item.validation_errors.length > 0
                        const isInvalid = hasInvalidSerials || hasValidationErrors

                        return (
                            <div
                                key={index}
                                className={`border-b last:border-0 pb-sm mb-sm ${isInvalid ? 'border-error bg-error-light/10' : 'border-neutral-200'
                                    }`}
                            >
                                <div className="flex justify-between text-sm">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-xs">
                                            <span className="font-medium text-primary-text">{product?.name || 'Unknown Product'}</span>
                                            {isInvalid && (
                                                <span className="text-xs text-error">⚠️</span>
                                            )}
                                        </div>
                                        <span className="text-secondary-text">x {item.quantity}</span>
                                    </div>
                                    <span className="font-medium text-primary-text">₹{item.line_total.toFixed(2)}</span>
                                </div>
                                {item.serial_tracked && item.serials && item.serials.length > 0 && (
                                    <div className="mt-xs text-xs text-muted-text">
                                        <span className="font-medium">Serials: </span>
                                        <span className="font-mono">{item.serials.join(', ')}</span>
                                    </div>
                                )}
                                {hasValidationErrors && (
                                    <div className="mt-xs text-xs text-error">
                                        {item.validation_errors?.join(', ')}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Totals */}
                <div className="mt-lg pt-md border-t border-neutral-200 space-y-sm">
                    <div className="flex justify-between text-sm">
                        <span className="text-secondary-text">Subtotal</span>
                        <span className="font-medium text-primary-text">₹{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {/* Tax Label - Display supply type information */}
                    {totals.tax_label && (
                        <div className="text-xs text-secondary-text italic py-xs">
                            {totals.tax_label}
                        </div>
                    )}
                    {/* Tax Breakdown */}
                    {(totals.cgst_amount > 0 || totals.sgst_amount > 0 || totals.igst_amount > 0) && (
                        <>
                            {totals.cgst_amount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-secondary-text">CGST</span>
                                    <span className="font-medium text-primary-text">₹{totals.cgst_amount.toFixed(2)}</span>
                                </div>
                            )}
                            {totals.sgst_amount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-secondary-text">SGST</span>
                                    <span className="font-medium text-primary-text">₹{totals.sgst_amount.toFixed(2)}</span>
                                </div>
                            )}
                            {totals.igst_amount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-secondary-text">IGST</span>
                                    <span className="font-medium text-primary-text">₹{totals.igst_amount.toFixed(2)}</span>
                                </div>
                            )}
                        </>
                    )}
                    {/* Zero-rated or Exempt indicator */}
                    {(totals.supply_type === 'zero_rated' || totals.supply_type === 'exempt') && totals.cgst_amount === 0 && totals.sgst_amount === 0 && totals.igst_amount === 0 && (
                        <div className="text-xs text-secondary-text py-xs">
                            {totals.supply_type === 'zero_rated'
                                ? 'Zero-Rated Supply - No Tax Applicable'
                                : 'Exempt Supply - No Tax Applicable'}
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-semibold pt-sm border-t border-neutral-200">
                        <span className="text-primary-text">Total</span>
                        <span className="text-primary-text">₹{totals.total_amount.toFixed(2)}</span>
                    </div>
                    {items.some(item =>
                        (item.invalid_serials && item.invalid_serials.length > 0) ||
                        (item.validation_errors && item.validation_errors.length > 0)
                    ) && (
                            <div className="mt-md p-md bg-warning-light border border-warning rounded-md">
                                <p className="text-sm font-medium text-warning-dark">
                                    ⚠️ This invoice contains items that need branch head review
                                </p>
                                <p className="text-xs text-warning-dark mt-xs">
                                    Please fix validation errors before finalizing the invoice.
                                </p>
                            </div>
                        )}
                </div>
            </div>
        </div>
    )
}
