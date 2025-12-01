import React from 'react'
import { CustomerWithMaster } from '../../types'
import { CustomerSearchCombobox } from '../customers/CustomerSearchCombobox'
import { Card, CardContent } from '../ui/Card'
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
    onCustomerSelected: (customer: CustomerWithMaster) => void

    // Inline Form Group
    isAddNewFormOpen: boolean
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
    onOpenAddNewForm: () => void
    onCloseAddNewForm: () => void
    onFormDataChange: (data: { name: string; mobile: string; gstin: string }) => void
    onSubmitNewCustomer: () => void
    onFieldBlur: (field: 'mobile' | 'gstin', value: string) => void

    // Smart Form Metadata
    fieldPriority: FieldPriority
    gstinRequired: boolean
    mobileRequired: boolean

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
    isAddNewFormOpen,
    newCustomerData,
    formErrors,
    onOpenAddNewForm,
    onCloseAddNewForm,
    onFormDataChange,
    onSubmitNewCustomer,
    onFieldBlur,
    fieldPriority,
    gstinRequired,
    mobileRequired,
    onContinue,
    orgId,
    isDisabled,
    autoFocus,
}) => {
    // Helper to render individual fields
    const renderNameField = (autoFocus = false) => (
        <Input
            key="name-field"
            label="Customer Name *"
            type="text"
            value={newCustomerData.name}
            onChange={(e) =>
                onFormDataChange({ ...newCustomerData, name: e.target.value })
            }
            disabled={isDisabled || isSearching}
            placeholder="Enter customer name"
            error={formErrors.name}
            required
            autoFocus={autoFocus}
        />
    )

    const renderMobileField = (autoFocus = false) => (
        <Input
            key="mobile-field"
            label={mobileRequired ? "Mobile Number *" : "Mobile Number (optional)"}
            type="tel"
            value={newCustomerData.mobile}
            onChange={(e) =>
                onFormDataChange({ ...newCustomerData, mobile: e.target.value })
            }
            onBlur={(e) => onFieldBlur('mobile', e.target.value)}
            disabled={isDisabled || isSearching}
            placeholder="Enter 10-digit mobile number"
            error={formErrors.mobile}
            required={mobileRequired}
            autoFocus={autoFocus}
        />
    )

    const renderGstinField = (autoFocus = false) => (
        <Input
            key="gstin-field"
            label={gstinRequired ? "GSTIN *" : "GSTIN (optional)"}
            type="text"
            value={newCustomerData.gstin}
            onChange={(e) =>
                onFormDataChange({ ...newCustomerData, gstin: e.target.value.toUpperCase() })
            }
            onBlur={(e) => onFieldBlur('gstin', e.target.value)}
            disabled={isDisabled || isSearching}
            placeholder="Enter 15-character GSTIN"
            error={formErrors.gstin}
            required={gstinRequired}
            autoFocus={autoFocus}
        />
    )

    // Render fields in priority order
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
                renderGstinField(),
                renderNameField(),
            ]
        } else {
            // Default: name first
            return [
                renderNameField(true),
                renderMobileField(),
                renderGstinField(),
            ]
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-primary-text mb-md">Step 1: Select Customer</h3>

                {/* Show "Add New Customer" form inline when activated */}
                {isAddNewFormOpen ? (
                    <div className="mt-md space-y-md p-md border border-neutral-200 rounded-md bg-neutral-50">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-sm font-semibold text-primary-text">Add New Party Details</h4>
                                <p className="text-xs text-secondary-text">
                                    Customer Identifier: <span className="font-semibold">{searchValue}</span>
                                </p>
                            </div>
                        </div>

                        {/* Dynamic field rendering based on search type */}
                        {renderFormFields()}

                        <div className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onCloseAddNewForm}
                                disabled={isDisabled || isSearching}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={onSubmitNewCustomer}
                                isLoading={isSearching}
                                disabled={isDisabled || isSearching}
                                className="flex-1"
                            >
                                Add Customer
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Customer Search Combobox */}
                        <CustomerSearchCombobox
                            orgId={orgId}
                            value={searchValue}
                            onChange={onSearchChange}
                            onCustomerSelect={(customer) => {
                                if (customer) {
                                    onCustomerSelected(customer)
                                }
                            }}
                            onAddNewPartyClick={onOpenAddNewForm}
                            autoFocus={autoFocus}
                            disabled={isDisabled}
                        />

                        {/* Selected Customer Display */}
                        {selectedCustomer && !isAddNewFormOpen && (
                            <div className="mt-4">
                                <h4 className="text-sm font-semibold text-primary-text mb-sm">Selected Customer</h4>
                                <Card>
                                    <CardContent className="p-4">
                                        <p className="text-md font-semibold text-primary-text">
                                            {selectedCustomer.alias_name || selectedCustomer.name || selectedCustomer.master_customer.legal_name}
                                        </p>
                                        {selectedCustomer.mobile && (
                                            <p className="text-sm text-secondary-text">Mobile: {selectedCustomer.mobile}</p>
                                        )}
                                        {selectedCustomer.master_customer.gstin && (
                                            <p className="text-sm text-secondary-text">GSTIN: {selectedCustomer.master_customer.gstin}</p>
                                        )}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={onContinue}
                                            className="mt-2"
                                        >
                                            Continue
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </>
                )}

                {searchError && (
                    <p className="mt-sm text-sm text-error">{searchError}</p>
                )}
            </div>
        </div>
    )
}
