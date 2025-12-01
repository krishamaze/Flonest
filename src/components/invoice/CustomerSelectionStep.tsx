import React from 'react'
import { CustomerWithMaster } from '../../types'
import { CustomerSearchCombobox } from '../customers/CustomerSearchCombobox'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { FieldPriority } from '../../hooks/invoice/useInvoiceCustomer'

interface CustomerSelectionStepProps {
    // Search Group
    searchValue: string
    onSearchChange: (value: string) => void
    isSearching: boolean
    searchError?: string

    // Customer Selection Group
    selectedCustomer: CustomerWithMaster | null
    onCustomerSelected: (customer: CustomerWithMaster | null) => void

    // Inline Form Group
    isAddNewFormOpen?: boolean // Deprecated
    newCustomerData: {
        name: string
        mobile: string
        gstin: string
    }
    formErrors: {
        name?: string
        mobile?: string
        gstin?: string
    }
    onOpenAddNewForm?: () => void // Deprecated
    onCloseAddNewForm?: () => void // Deprecated
    onFormDataChange: (data: { name: string; mobile: string; gstin: string }) => void
    onSubmitNewCustomer: () => void
    onFieldBlur: (field: 'mobile' | 'gstin', value: string) => void

    // Smart Form Metadata
    fieldPriority: FieldPriority

    // Navigation Group
    onContinue: () => void

    // Context Group
    orgId: string
    isDisabled: boolean
    autoFocus: boolean
}

export const CustomerSelectionStep: React.FC<CustomerSelectionStepProps> = ({
    searchValue,
    onSearchChange,
    isSearching,
    searchError,
    selectedCustomer,
    onCustomerSelected,
    newCustomerData,
    formErrors,
    onFormDataChange,
    onSubmitNewCustomer,
    onFieldBlur,
    fieldPriority,
    orgId,
    isDisabled,
    autoFocus,
}) => {
    // Track GSTIN field visibility
    const [showGstinField, setShowGstinField] = React.useState(false)

    // Determine if fields should be shown
    const showFields = selectedCustomer !== null || (searchValue.trim().length >= 3 && !isSearching)

    // Auto-show GSTIN if search was by GSTIN or if selected customer has GSTIN
    React.useEffect(() => {
        if (fieldPriority === 'gstin' || (selectedCustomer && selectedCustomer.master_customer.gstin)) {
            setShowGstinField(true)
        }
    }, [fieldPriority, selectedCustomer])

    // Determine field locking (read-only) state
    const isMobileReadOnly = (selectedCustomer && !!selectedCustomer.master_customer.mobile) || (!selectedCustomer && fieldPriority === 'mobile')
    const isGstinReadOnly = (selectedCustomer && !!selectedCustomer.master_customer.gstin) || (!selectedCustomer && fieldPriority === 'gstin')
    const isNameReadOnly = !selectedCustomer && fieldPriority === 'name'

    const renderNameField = (autoFocus = false) => (
        <Input
            key="name-field"
            label="Customer Name *"
            type="text"
            value={newCustomerData.name}
            onChange={(e) =>
                onFormDataChange({ ...newCustomerData, name: e.target.value })
            }
            disabled={isDisabled || isSearching || isNameReadOnly}
            readOnly={isNameReadOnly}
            className={isNameReadOnly ? 'bg-neutral-50 text-secondary-text' : ''}
            placeholder="Enter customer name"
            error={formErrors.name}
            required
            autoFocus={autoFocus && !isNameReadOnly}
        />
    )

    const renderMobileField = (autoFocus = false) => (
        <Input
            key="mobile-field"
            label="Mobile Number"
            type="tel"
            value={newCustomerData.mobile}
            onChange={(e) =>
                onFormDataChange({ ...newCustomerData, mobile: e.target.value })
            }
            onBlur={(e) => onFieldBlur('mobile', e.target.value)}
            disabled={isDisabled || isSearching || isMobileReadOnly}
            readOnly={isMobileReadOnly}
            className={isMobileReadOnly ? 'bg-neutral-50 text-secondary-text' : ''}
            placeholder="Enter 10-digit mobile number"
            error={formErrors.mobile}
            autoFocus={autoFocus && !isMobileReadOnly}
        />
    )

    const renderGstinField = (autoFocus = false) => (
        <Input
            key="gstin-field"
            label="GSTIN"
            type="text"
            value={newCustomerData.gstin}
            onChange={(e) =>
                onFormDataChange({ ...newCustomerData, gstin: e.target.value.toUpperCase() })
            }
            onBlur={(e) => onFieldBlur('gstin', e.target.value)}
            disabled={isDisabled || isSearching || isGstinReadOnly}
            readOnly={isGstinReadOnly}
            className={isGstinReadOnly ? 'bg-neutral-50 text-secondary-text' : ''}
            placeholder="Enter 15-character GSTIN"
            error={formErrors.gstin}
            autoFocus={autoFocus && !isGstinReadOnly}
        />
    )

    const renderGstinToggle = () => (
        <button
            type="button"
            onClick={() => setShowGstinField(true)}
            className="text-xs text-primary hover:text-primary-dark underline"
        >
            + Add GSTIN
        </button>
    )

    const renderFormFields = () => {
        if (fieldPriority === 'gstin') {
            return [
                renderGstinField(true),
                renderMobileField(),
                renderNameField(),
            ]
        } else if (fieldPriority === 'mobile') {
            return [
                renderMobileField(true),
                showGstinField ? renderGstinField() : renderGstinToggle(),
                renderNameField(),
            ]
        } else {
            return [
                renderNameField(true),
                renderMobileField(),
                showGstinField ? renderGstinField() : renderGstinToggle(),
            ]
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-primary-text mb-md">Step 1: Select Customer</h3>

                <div className="space-y-4">
                    <CustomerSearchCombobox
                        orgId={orgId}
                        value={searchValue}
                        onChange={onSearchChange}
                        onCustomerSelect={onCustomerSelected}
                        disabled={isDisabled}
                        autoFocus={autoFocus}
                    />
                    {searchError && (
                        <p className="text-sm text-error mt-1">{searchError}</p>
                    )}
                </div>

                {showFields && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border border-neutral-200 rounded-md bg-neutral-50/50">
                            <div className="space-y-4">
                                {renderFormFields()}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <Button
                                    type="button"
                                    variant="primary"
                                    onClick={onSubmitNewCustomer}
                                    disabled={isDisabled || isSearching}
                                    className="w-full sm:w-auto"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
