import React from 'react'
import { CustomerWithMaster, CustomerSearchResult } from '../../types'
import { CustomerSearchCombobox } from '../customers/CustomerSearchCombobox'
import { Input } from '../ui/Input'
import { Toggle } from '../ui/Toggle'
import type { FieldPriority } from '../../hooks/invoice/useInvoiceCustomer'
import { classifySearchMode, type SearchMode } from '../../lib/utils/customerSearchMode'
import { validateMobile, validateGSTIN } from '../../lib/utils/identifierValidation'
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
    onSubmitNewCustomer: _onSubmitNewCustomer, // Deprecated - parent navigation handles submit
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
    // Store dropdown selection temporarily until ✓ is clicked
    const [pendingResult, setPendingResult] = React.useState<CustomerSearchResult | null>(null)
    // Track identifier validation error
    const [identifierError, setIdentifierError] = React.useState<string>('')

    // Refs for auto-focusing next field
    const nameInputRef = React.useRef<HTMLInputElement>(null)
    const mobileInputRef = React.useRef<HTMLInputElement>(null)
    const gstinInputRef = React.useRef<HTMLInputElement>(null)

    // Show fields only after mode is finalized OR customer is selected
    const showFields = selectedCustomer !== null || isModeFinalized

    // Sync isModeFinalized with selectedCustomer on navigation back
    React.useEffect(() => {
        // When navigating back from step 2, if customer is selected, keep field locked
        if (selectedCustomer && !isModeFinalized) {
            setIsModeFinalized(true)
        }
    }, [selectedCustomer, isModeFinalized])

    // Track previous value to detect actual edits
    const prevSearchValue = React.useRef(searchValue)
    const isProgrammaticUpdate = React.useRef(false) // Track if update is from dropdown selection

    // Reset finalization and clear fields when user MANUALLY edits identifier
    React.useEffect(() => {
        const trimmed = searchValue.trim()
        const prevTrimmed = prevSearchValue.current.trim()

        // Only check reset if value actually changed
        if (trimmed === prevTrimmed) {
            return
        }

        // IMPORTANT: Check programmatic flag FIRST before any reset logic
        if (isProgrammaticUpdate.current) {
            isProgrammaticUpdate.current = false // Reset flag
            prevSearchValue.current = searchValue
            return // Skip all reset logic
        }

        // Clear pending dropdown selection on ANY manual edit
        setPendingResult(null)

        // Clear identifier error on manual edit
        if (identifierError) {
            setIdentifierError('')
        }

        // If finalized or customer selected, reset on MANUAL change only
        if (isModeFinalized || selectedCustomer) {
            setIsModeFinalized(false)
            onCustomerSelected(null)
            onFormDataChange({ name: '', mobile: '', gstin: '' })
        }

        // Update ref
        prevSearchValue.current = searchValue
    }, [searchValue, isModeFinalized, selectedCustomer, onCustomerSelected, onFormDataChange, identifierError])

    // Auto-focus removed - focus stays in identifier field until user manually moves


    // GST toggle always OFF/hidden by default - user must manually toggle ON
    React.useEffect(() => {
        setShowGstinField(false)
    }, [fieldPriority])

    // Handle selection from combobox - IMMEDIATELY finalize and fill form
    const handleSearchResultSelect = (result: CustomerSearchResult | null) => {
        if (!result) {
            // "+ Add New Customer" clicked - validate identifier first
            const mode = classifySearchMode(searchValue)
            const trimmed = searchValue.trim()

            // Validate identifier completeness based on mode
            if (mode === 'mobile') {
                if (trimmed.length < 10) {
                    setIdentifierError('Mobile number must be at least 10 digits')
                    return
                }
                if (!validateMobile(trimmed)) {
                    setIdentifierError('Invalid mobile number. Must be 10 digits starting with 6-9')
                    return
                }
            } else if (mode === 'gstin') {
                if (trimmed.length < 15) {
                    setIdentifierError('GSTIN must be at least 15 characters')
                    return
                }
                if (!validateGSTIN(trimmed)) {
                    setIdentifierError('Invalid GSTIN format')
                    return
                }
            } else if (mode === 'name') {
                if (trimmed.length < 3) {
                    setIdentifierError('Name must be at least 3 characters')
                    return
                }
            } else {
                // Unknown mode or < 3 chars
                setIdentifierError('Please enter at least 3 characters')
                return
            }

            // Validation passed - clear error and show form
            setIdentifierError('')
            onCustomerSelected(null)
            setPendingResult(null)
            setIsModeFinalized(true) // Show fields
            onFormDataChange({ name: '', mobile: '', gstin: '' })
            setWasEdited(false)
            return
        }

        // Customer selected - immediately fill form (no ✓ button)
        const mode = classifySearchMode(searchValue)

        if (result.type === 'org') {
            const customer = result.data

            // Autocomplete identifier
            if (mode === 'mobile') {
                isProgrammaticUpdate.current = true
                onSearchChange(customer.master_customer.mobile || searchValue)
            } else if (mode === 'gstin') {
                isProgrammaticUpdate.current = true
                onSearchChange(customer.master_customer.gstin || searchValue)
            } else {
                isProgrammaticUpdate.current = true
                onSearchChange(customer.alias_name || customer.master_customer.legal_name || searchValue)
            }

            // Fill complementary fields immediately
            if (mode === 'mobile') {
                onFormDataChange({
                    name: customer.alias_name || customer.master_customer.legal_name,
                    mobile: '',
                    gstin: customer.master_customer.gstin || '',
                })
            } else if (mode === 'gstin') {
                onFormDataChange({
                    name: customer.alias_name || customer.master_customer.legal_name,
                    mobile: customer.master_customer.mobile || '',
                    gstin: '',
                })
            } else {
                onFormDataChange({
                    name: '',
                    mobile: customer.master_customer.mobile || '',
                    gstin: customer.master_customer.gstin || '',
                })
            }

            onCustomerSelected(customer)
        } else {
            const master = result.data

            // Autocomplete identifier
            if (mode === 'mobile') {
                isProgrammaticUpdate.current = true
                onSearchChange(master.mobile || searchValue)
            } else if (mode === 'gstin') {
                isProgrammaticUpdate.current = true
                onSearchChange(master.gstin || searchValue)
            } else {
                isProgrammaticUpdate.current = true
                onSearchChange(master.legal_name || searchValue)
            }

            // Fill complementary fields
            if (mode === 'mobile') {
                onFormDataChange({
                    name: master.legal_name || '',
                    mobile: '',
                    gstin: master.gstin || '',
                })
            } else if (mode === 'gstin') {
                onFormDataChange({
                    name: master.legal_name || '',
                    mobile: master.mobile || '',
                    gstin: '',
                })
            } else {
                onFormDataChange({
                    name: '',
                    mobile: master.mobile || '',
                    gstin: master.gstin || '',
                })
            }
        }

        // Finalize mode
        setIsModeFinalized(true)
        setWasEdited(false)
    }

    // Handle mode finalization with validation
    const handleModeFinalized = (mode: SearchMode) => {
        if (!mode) return

        const trimmed = searchValue.trim()

        // Validate based on mode
        if (mode === 'mobile') {
            if (!validateMobile(trimmed)) {
                alert('Invalid mobile number. Must be 10 digits starting with 6-9.')
                return
            }
        } else if (mode === 'gstin') {
            if (!validateGSTIN(trimmed)) {
                alert('Invalid GSTIN. Must be 15 characters in valid Indian GSTIN format.')
                return
            }
        } else if (mode === 'name') {
            // Validate name: No extra spaces, auto-convert to title case
            const normalized = trimmed.replace(/\s+/g, ' ') // Single spaces only
            const words = normalized.split(' ')

            if (trimmed !== normalized) {
                alert('Name has extra spaces. Please remove extra spaces.')
                return
            }

            // Auto-convert to title case (handles existing lowercase data like "krishnakumar")
            const titleCased = words.map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')

            // Update to title case if needed
            if (titleCased !== trimmed) {
                isProgrammaticUpdate.current = true
                onSearchChange(titleCased)
            }
        }

        // Validation passed - finalize
        setIsModeFinalized(true)

        // Fill complementary form fields from pendingResult (if any)
        if (pendingResult) {
            if (pendingResult.type === 'org') {
                const customer = pendingResult.data
                // Fill complementary fields based on mode
                if (mode === 'mobile') {
                    onFormDataChange({
                        name: customer.alias_name || customer.master_customer.legal_name,
                        mobile: '', // In combobox
                        gstin: customer.master_customer.gstin || '',
                    })
                } else if (mode === 'gstin') {
                    onFormDataChange({
                        name: customer.alias_name || customer.master_customer.legal_name,
                        mobile: customer.master_customer.mobile || '',
                        gstin: '', // In combobox
                    })
                } else {
                    // Name mode
                    onFormDataChange({
                        name: '', // In combobox
                        mobile: customer.master_customer.mobile || '',
                        gstin: customer.master_customer.gstin || '',
                    })
                }
                // Select the customer
                onCustomerSelected(customer)
            } else {
                // Global master customer
                const master = pendingResult.data
                if (mode === 'mobile') {
                    onFormDataChange({
                        name: master.legal_name || '',
                        mobile: '', // In combobox
                        gstin: master.gstin || '',
                    })
                } else if (mode === 'gstin') {
                    onFormDataChange({
                        name: master.legal_name || '',
                        mobile: master.mobile || '',
                        gstin: '', // In combobox
                    })
                } else {
                    // Name mode
                    onFormDataChange({
                        name: '', // In combobox
                        mobile: master.mobile || '',
                        gstin: master.gstin || '',
                    })
                }
                // New customer - don't select
            }
            setPendingResult(null) // Clear after use
        } else {
            // No dropdown selection - manual entry, clear form
            onFormDataChange({ name: '', mobile: '', gstin: '' })
        }

        // Focus the first complementary field
        if (mode === 'mobile' || mode === 'gstin') {
            setTimeout(() => nameInputRef.current?.focus(), 50)
        } else if (mode === 'name') {
            setTimeout(() => mobileInputRef.current?.focus(), 50)
        }
    }

    // Determine current search mode to exclude that field
    const currentMode = classifySearchMode(searchValue)

    // Track if fields were edited (for smart edit-to-create flow)
    const [wasEdited, setWasEdited] = React.useState(false)

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
                onChange={(e) => {
                    onFormDataChange({ ...newCustomerData, name: e.target.value })
                    // Smart edit: if customer was selected and user edits, mark as edited
                    if (selectedCustomer && e.target.value !== (selectedCustomer.alias_name || selectedCustomer.master_customer.legal_name)) {
                        setWasEdited(true)
                        onCustomerSelected(null) // Switch to create new mode
                    }
                }}
                disabled={isDisabled || isSearching}
                placeholder="Enter customer name"
                error={formErrors.name}
                required
                autoFocus={autoFocus}
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
            onChange={(e) => {
                const value = e.target.value
                onFormDataChange({ ...newCustomerData, mobile: value })

                // Real-time validation: show error immediately if length >= 10
                if (value.length >= 10) {
                    onFieldBlur('mobile', value)
                }

                // Smart edit: if customer was selected and user edits, mark as edited
                if (selectedCustomer && value !== selectedCustomer.master_customer.mobile) {
                    setWasEdited(true)
                    onCustomerSelected(null)
                }
            }}
            onBlur={(e) => onFieldBlur('mobile', e.target.value)}
            disabled={isDisabled || isSearching}
            placeholder="Enter 10-digit mobile number"
            error={formErrors.mobile}
            autoFocus={autoFocus}
        />
    )

    const renderGstinField = (autoFocus = false) => (
        <Input
            key="gstin-field"
            ref={gstinInputRef}
            label="GSTIN"
            type="text"
            value={newCustomerData.gstin}
            onChange={(e) => {
                const value = e.target.value.toUpperCase()
                onFormDataChange({ ...newCustomerData, gstin: value })

                // Real-time validation: show error immediately if length >= 15
                if (value.length >= 15) {
                    onFieldBlur('gstin', value)
                }

                // Smart edit: if customer was selected and user edits, mark as edited
                if (selectedCustomer && value !== selectedCustomer.master_customer.gstin) {
                    setWasEdited(true)
                    onCustomerSelected(null)
                }
            }}
            onBlur={(e) => onFieldBlur('gstin', e.target.value)}
            disabled={isDisabled || isSearching}
            placeholder="Enter 15-character GSTIN"
            error={formErrors.gstin}
            autoFocus={autoFocus}
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
        // Smart exclusion: Don't render the field that's already in the combobox
        if (currentMode === 'mobile') {
            // Mobile in combobox → Show only Name + GSTIN
            return [
                renderNameField(true),
                renderGstinToggle(),
                showGstinField ? renderGstinField() : null,
            ].filter(Boolean)
        } else if (currentMode === 'gstin') {
            // GSTIN in combobox → Show only Mobile + Name
            return [
                renderNameField(true),
                renderMobileField(),
            ].filter(Boolean)
        } else if (currentMode === 'name') {
            // Name in combobox → Show only Mobile + GSTIN
            return [
                renderMobileField(true),
                renderGstinToggle(),
                showGstinField ? renderGstinField() : null,
            ].filter(Boolean)
        } else {
            // No mode yet (< 3 chars) - don't show anything
            return []
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
                                onResetMode={() => {
                                    setIsModeFinalized(false)
                                    onCustomerSelected(null)
                                    onFormDataChange({ name: '', mobile: '', gstin: '' })
                                }}
                                isFinalizedExternal={isModeFinalized}
                                disabled={isDisabled}
                                autoFocus={autoFocus}
                            />
                        </div>
                        {identifierError && (
                            <p className="text-sm text-error mb-2">{identifierError}</p>
                        )}
                        {searchError && (
                            <p className="text-sm text-error mt-1">{searchError}</p>
                        )}

                        {/* Other fields - conditionally rendered */}
                        {showFields && (
                            <>
                                {wasEdited && (
                                    <div className="flex items-center gap-2 p-2 bg-warning-light border-l-4 border-warning rounded text-sm text-warning-dark">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                        </svg>
                                        <span>Edited - will save as new customer</span>
                                    </div>
                                )}

                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {renderFormFields()}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
