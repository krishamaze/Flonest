import React from 'react'
import { CustomerWithMaster, CustomerSearchResult } from '../../types'
import { CustomerSearchCombobox } from '../customers/CustomerSearchCombobox'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { FieldPriority } from '../../hooks/invoice/useInvoiceCustomer'
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

    // Refs for auto-focusing next field
    const nameInputRef = React.useRef<HTMLInputElement>(null)
    const mobileInputRef = React.useRef<HTMLInputElement>(null)
    const gstinInputRef = React.useRef<HTMLInputElement>(null)

    // Determine if fields should be shown
    // Show fields only after:
    // 1. Customer is selected from dropdown, OR
    // 2. Valid complete identifier is typed:
    //    - Mobile: exactly 10 digits starting with 6-9
    //    - GSTIN: exactly 15 characters matching GSTIN pattern
    //    - Name: at least 3 characters (default)
    const isValidCompleteIdentifier = () => {
        const cleaned = searchValue.trim().replace(/\s+/g, '')

        // Complete mobile number (10 digits starting with 6-9)
        if (/^[6-9][0-9]{9}$/.test(cleaned)) {
            return true
        }

        // Complete GSTIN (15 characters with GSTIN pattern)
        if (cleaned.length === 15 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned.toUpperCase())) {
            return true
        }

        // Name: at least 3 characters (and not a partial mobile/GSTIN)
        const isPartialMobile = /^[6-9]\d{1,8}$/.test(cleaned) // 2-9 digits starting with 6-9
        const isPartialGSTIN = cleaned.length >= 3 && cleaned.length < 15 && /^[0-9]{2}[A-Z]/i.test(cleaned)

        if (!isPartialMobile && !isPartialGSTIN && cleaned.length >= 3) {
            return true
        }

        return false
    }

    const showFields = selectedCustomer !== null || (!isSearching && isValidCompleteIdentifier())

    // Auto-focus to first available field when fields become visible
    React.useEffect(() => {
        if (showFields && !selectedCustomer) {
            // Focus on first non-readonly field based on priority
            setTimeout(() => {
                if (fieldPriority === 'mobile' && !isMobileReadOnly && mobileInputRef.current) {
                    mobileInputRef.current.focus()
                } else if (fieldPriority === 'gstin' && !isGstinReadOnly && gstinInputRef.current) {
                    gstinInputRef.current.focus()
                } else if (fieldPriority === 'name' && !isNameReadOnly && nameInputRef.current) {
                    nameInputRef.current.focus()
                } else if (mobileInputRef.current && !isMobileReadOnly) {
                    mobileInputRef.current.focus()
                } else if (nameInputRef.current && !isNameReadOnly) {
                    nameInputRef.current.focus()
                } else if (gstinInputRef.current && !isGstinReadOnly) {
                    gstinInputRef.current.focus()
                }
            }, 100)
        }
    }, [showFields, selectedCustomer, fieldPriority])


    // Auto-show GSTIN if search was by GSTIN or if selected customer has GSTIN
    React.useEffect(() => {
        if (fieldPriority === 'gstin' || (selectedCustomer && selectedCustomer.master_customer.gstin)) {
            setShowGstinField(true)
        }
    }, [fieldPriority, selectedCustomer])

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
            {isNameComplete && !formErrors.name && (
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
        <button
            type="button"
            onClick={() => setShowGstinField(true)}
            className="text-xs text-primary hover:text-primary-dark underline"
        >
            + Add GSTIN
        </button>
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
                showGstinField ? renderGstinField() : renderGstinToggle(),
                renderNameField(),
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
                        {/* Customer identifier input - always visible */}
                        <CustomerSearchCombobox
                            orgId={orgId}
                            value={searchValue}
                            onChange={onSearchChange}
                            onCustomerSelect={handleSearchResultSelect}
                            disabled={isDisabled}
                            autoFocus={autoFocus}
                        />
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
