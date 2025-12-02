import React from 'react'
import { CustomerWithMaster, CustomerSearchResult } from '../../types'
import { CustomerSearchCombobox } from '../customers/CustomerSearchCombobox'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import type { FieldPriority } from '../../hooks/invoice/useInvoiceCustomer'
import type { SearchMode } from '../../lib/utils/customerSearchMode'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

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
    // Track if identifier mode is finalized (user selected or blurred)
    const [isModeFinalized, setIsModeFinalized] = React.useState(false)

    // Refs for auto-focusing next field
    const nameInputRef = React.useRef<HTMLInputElement>(null)
    const mobileInputRef = React.useRef<HTMLInputElement>(null)
    const gstinInputRef = React.useRef<HTMLInputElement>(null)

    // Show fields only after mode is finalized OR customer is selected
    const showFields = selectedCustomer !== null || isModeFinalized

    // Track previous value to detect actual edits
    const prevSearchValue = React.useRef(searchValue)

    // Reset finalization and clear fields when user edits identifier
    React.useEffect(() => {
        const trimmed = searchValue.trim()
        const prevTrimmed = prevSearchValue.current.trim()

        // Only check reset if value actually changed
        if (trimmed === prevTrimmed) {
            return
        }

        // If finalized or customer selected, ALWAYS reset on any change
        if (isModeFinalized || selectedCustomer) {
            setIsModeFinalized(false)
            onCustomerSelected(null)
            onFormDataChange({ name: '', mobile: '', gstin: '' })
        }

        // Update ref
        prevSearchValue.current = searchValue
    }, [searchValue, isModeFinalized, selectedCustomer, onCustomerSelected, onFormDataChange])

    // Auto-focus removed - focus stays in identifier field until user manually moves


    // GST toggle always OFF/hidden by default - user must manually toggle ON
    React.useEffect(() => {
        setShowGstinField(false)
    }, [fieldPriority])

    // Handle selection from combobox
    const handleSearchResultSelect = (result: CustomerSearchResult | null) => {
        if (!result) {
            onCustomerSelected(null)
            return
        }

        if (result.type === 'org') {
            // Existing Org Customer -> Select it directly
            onCustomerSelected(result.data)
        } else {
            // Global Master Customer -> Pre-fill form as "New Customer"
            // This allows user to confirm/edit details before linking
            const master = result.data
            onFormDataChange({
                name: master.legal_name || '',
                mobile: master.mobile || '',
                gstin: master.gstin || '',
            })
            // Ensure we clear any previously selected customer
            onCustomerSelected(null)
        }
    }

    // Handle mode finalization with auto-copy to form fields
    const handleModeFinalized = (mode: SearchMode, value: string) => {
        if (!mode) return // Skip if null
        setIsModeFinalized(true)

        const trimmed = value.trim()

        if (mode === 'mobile') {
            // Copy mobile to form, keep name/GSTIN empty
            onFormDataChange({ name: '', mobile: trimmed, gstin: '' })
            // Focus name field
            setTimeout(() => nameInputRef.current?.focus(), 50)
        } else if (mode === 'gstin') {
            // Copy GSTIN to form, keep name/mobile empty
            onFormDataChange({ name: '', mobile: '', gstin: trimmed.toUpperCase() })
            // Focus name field
            setTimeout(() => nameInputRef.current?.focus(), 50)
        } else if (mode === 'name') {
            // Copy name to form, keep mobile/GSTIN empty
            onFormDataChange({ name: trimmed, mobile: '', gstin: '' })
            // No need to focus - fields just appeared
        }
    }

    // Determine field locking (read-only) state
    const isMobileReadOnly = (selectedCustomer && !!selectedCustomer.master_customer.mobile) || (!selectedCustomer && fieldPriority === 'mobile')
    const isGstinReadOnly = (selectedCustomer && !!selectedCustomer.master_customer.gstin) || (!selectedCustomer && fieldPriority === 'gstin')
    const isNameReadOnly = !selectedCustomer && fieldPriority === 'name'

    // Name completion check (3+ chars)
    const isNameComplete = newCustomerData.name.trim().length >= 3

    const renderNameField = (autoFocus = false) => (
        <div className="relative">
            <Input
                key="name-field"
                ref={nameInputRef}
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
            {(isModeFinalized || selectedCustomer) && isNameComplete && !formErrors.name && (
                <CheckCircleIcon className="absolute right-3 top-[calc(1.5rem+0.25rem+12px)] h-5 w-5 text-success" />
            )}
        </div>
    )

    const renderMobileField = (autoFocus = false) => (
        <Input
            key="mobile-field"
            ref={mobileInputRef}
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
            ref={gstinInputRef}
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
        <Toggle
            checked={showGstinField}
            onChange={setShowGstinField}
            label="GST Bill"
            size="sm"
        />
    )

    const renderFormFields = () => {
        // Always hide the field that matches the search input to avoid duplication
        const hideMatchingField = true

        if (fieldPriority === 'gstin') {
            return [
                // Hide GSTIN field if search is GSTIN
                (!hideMatchingField || fieldPriority !== 'gstin') && renderGstinField(true),
                renderMobileField(),
                renderNameField(),
            ].filter(Boolean)
        } else if (fieldPriority === 'mobile') {
            return [
                // Hide Mobile field if search is Mobile
                (!hideMatchingField || fieldPriority !== 'mobile') && renderMobileField(true),
                renderNameField(),
                showGstinField ? renderGstinField() : renderGstinToggle(),
            ].filter(Boolean)
        } else {
            // Default: Name priority
            return [
                // Hide Name field if search is Name
                (!hideMatchingField || fieldPriority !== 'name') && renderNameField(true),
                renderMobileField(),
                showGstinField ? renderGstinField() : renderGstinToggle(),
            ].filter(Boolean)
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-primary-text mb-md">Step 1: Select Customer</h3>

                {/* Bordered form box containing all fields */}
                <div className="p-4 border border-neutral-200 rounded-md bg-neutral-50/50">
                    <div className="space-y-4">
                        {/* Customer identifier input with optional ✓ button for name mode */}
                        <div className="relative">
                            <CustomerSearchCombobox
                                orgId={orgId}
                                value={searchValue}
                                onChange={onSearchChange}
                                onCustomerSelect={handleSearchResultSelect}
                                onModeFinalized={handleModeFinalized}
                                disabled={isDisabled}
                                autoFocus={autoFocus}
                            />

                            {/* ✓ button for name mode - show when user typed 3+ chars but hasn't finalized */}
                            {searchValue.trim().length >= 3 && !selectedCustomer && !isModeFinalized && (
                                <button
                                    type="button"
                                    onClick={() => handleModeFinalized('name', searchValue)}
                                    className="absolute right-3 top-[calc(1.5rem+0.25rem+12px)] h-8 w-8 flex items-center justify-center rounded-full bg-success hover:bg-success-dark text-white transition-colors shadow-sm"
                                    title="Add as new customer"
                                    aria-label="Add as new customer"
                                >
                                    <CheckCircleIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        {searchError && (
                            <p className="text-sm text-error mt-1">{searchError}</p>
                        )}

                        {/* Other fields - conditionally rendered */}
                        {showFields && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                {renderFormFields()}
                            </div>
                        )}
                    </div>

                    {/* Next button - only shown when other fields are visible */}
                    {showFields && (
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
                    )}
                </div>
            </div>
        </div>
    )
}
