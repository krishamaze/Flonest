import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { useSearchCustomersAutocomplete } from '../../hooks/useCustomers'
import type { CustomerWithMaster } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'


interface CustomerSearchComboboxProps {
    orgId: string
    value: string
    onChange: (value: string) => void
    onCustomerSelect: (customer: CustomerWithMaster | null) => void
    disabled?: boolean
    autoFocus?: boolean
}

export function CustomerSearchCombobox({
    orgId,
    value,
    onChange,
    onCustomerSelect,
    disabled = false,
    autoFocus = false,
}: CustomerSearchComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Use React Query hook for autocomplete search (automatically debounced via enabled condition)
    const { data: searchResults = [], isLoading: isSearching } = useSearchCustomersAutocomplete(
        orgId,
        value,
        value.trim().length >= 3 // Only enable when 3+ chars
    )

    // Auto-open dropdown when results are available
    useEffect(() => {
        if (value.trim().length >= 3 && searchResults.length >= 0) {
            setIsOpen(true)
            setHighlightedIndex(-1)
        } else {
            setIsOpen(false)
        }
    }, [searchResults, value])


    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || searchResults.length === 0) return

        const totalItems = searchResults.length

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev))
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex((prev) => (prev > -1 ? prev - 1 : -1))
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
                    const selectedCustomer = searchResults[highlightedIndex]
                    handleCustomerSelect(selectedCustomer)
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                setHighlightedIndex(-1)
                break
        }
    }

    const handleCustomerSelect = (customer: CustomerWithMaster) => {
        onChange(customer.alias_name || customer.master_customer.legal_name)
        setIsOpen(false)
        onCustomerSelect(customer)
    }

    const getInputMode = (): 'text' | 'tel' => {
        if (!value || value.length < 3) {
            // Default to text for short inputs
            const firstChar = value.charAt(0)
            return /[6-9]/.test(firstChar) ? 'tel' : 'text'
        }

        // Use enhanced detection for 3+ characters
        const cleaned = value.trim().replace(/\s+/g, '')
        const isAllDigits = /^\d+$/.test(cleaned)

        // If starts with 6-9 and all digits, likely mobile number
        if (isAllDigits && /^[6-9]/.test(cleaned)) {
            return 'tel'
        }

        // Otherwise use text keyboard (for GSTIN, names)
        return 'text'
    }

    // Dynamic label based on detected input type
    const getInputLabel = (): string => {
        if (!value || value.length < 3) {
            return 'Customer Identifier'
        }

        const cleaned = value.trim().replace(/\s+/g, '')
        const isAllDigits = /^\d+$/.test(cleaned)

        // Detect mobile (3-10 digits starting with 6-9)
        if (isAllDigits && /^[6-9]/.test(cleaned)) {
            return 'Mobile Number'
        }

        // Detect GSTIN (starts with 2 digits + letter)
        if (cleaned.length >= 3 && /^[0-9]{2}[A-Z]/i.test(cleaned)) {
            return 'GSTIN'
        }

        // Default to customer name for text
        return 'Customer Name'
    }

    const formatLastInvoiceDate = (dateString: string | null | undefined) => {
        if (!dateString) return null
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    return (
        <div className="relative w-full">
            <div className="relative">
                <label htmlFor="customer-search" className="block text-sm font-medium text-secondary-text mb-xs">
                    {getInputLabel()} <span className="text-error">*</span>
                </label>
                <input
                    ref={inputRef}
                    id="customer-search"
                    type="text"
                    inputMode={getInputMode()}
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (value.trim().length >= 3) {
                            setIsOpen(true)
                        }
                    }}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    placeholder="Enter Mobile No (10 digits) or GSTIN"
                    className="w-full h-12 px-md py-sm border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-neutral-100 disabled:cursor-not-allowed text-base"
                    aria-autocomplete="list"
                    aria-controls="customer-search-results"
                    aria-expanded={isOpen}
                />
                {isSearching && (
                    <div className="absolute right-3 top-[calc(1.5rem+0.25rem+24px)] transform -translate-y-1/2">
                        <LoadingSpinner size="sm" />
                    </div>
                )}
            </div>

            {isOpen && value.trim().length >= 3 && (
                <div
                    ref={dropdownRef}
                    id="customer-search-results"
                    className="absolute z-50 w-full mt-1 bg-white border border-neutral-300 rounded-md shadow-lg max-h-80 overflow-y-auto"
                    role="listbox"
                >
                    {searchResults.length > 0 ? (
                        searchResults.map((customer, index) => {
                            const isHighlighted = highlightedIndex === index
                            const lastInvoiceDate = (customer as any).last_invoice_date as string | null | undefined

                            return (
                                <button
                                    key={customer.id}
                                    type="button"
                                    onClick={() => handleCustomerSelect(customer)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] ${isHighlighted ? 'bg-primary text-text-on-primary' : 'hover:bg-neutral-50'
                                        }`}
                                    role="option"
                                    aria-selected={isHighlighted}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`text-base font-semibold ${isHighlighted ? 'text-text-on-primary' : 'text-primary-text'}`}>
                                                {customer.alias_name || customer.master_customer.legal_name}
                                            </div>
                                        </div>
                                        <div className={`text-sm ${isHighlighted ? 'text-text-on-primary opacity-90' : 'text-secondary-text'}`}>
                                            {customer.master_customer.mobile
                                                ? `${customer.master_customer.mobile}`
                                                : customer.master_customer.gstin
                                                    ? `GSTIN: ${customer.master_customer.gstin}`
                                                    : 'No contact info'}
                                        </div>
                                        {lastInvoiceDate && (
                                            <div className={`text-xs ${isHighlighted ? 'text-text-on-primary opacity-75' : 'text-muted-text'}`}>
                                                Last invoice: {formatLastInvoiceDate(lastInvoiceDate)}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            )
                        })
                    ) : !isSearching ? (
                        <div className="px-4 py-3 text-sm text-secondary-text text-center">
                            No matching customers found
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}