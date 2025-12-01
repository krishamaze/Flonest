import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { useSearchCustomersAutocomplete } from '../../hooks/useCustomers'
import type { CustomerWithMaster, CustomerSearchResult } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { UserIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

interface CustomerSearchComboboxProps {
    orgId: string
    value: string
    onChange: (value: string) => void
    onCustomerSelect: (result: CustomerSearchResult | null) => void
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

    // Auto-fill when complete identifier is typed and matches search result
    useEffect(() => {
        if (!value || isSearching || searchResults.length === 0) return

        const cleaned = value.trim().replace(/\s+/g, '')

        // Check if it's a complete mobile (10 digits) or GSTIN (15 chars)
        const isCompleteMobile = /^[6-9][0-9]{9}$/.test(cleaned)
        const isCompleteGSTIN = cleaned.length === 15 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned.toUpperCase())

        if (isCompleteMobile || isCompleteGSTIN) {
            // Find exact match in search results
            const exactMatch = searchResults.find(result => {
                if (result.type === 'org') {
                    const customer = result.data as any
                    if (isCompleteMobile) {
                        return customer.master_customer?.mobile === cleaned
                    } else {
                        return customer.master_customer?.gstin?.toUpperCase() === cleaned.toUpperCase()
                    }
                } else {
                    const master = result.data as any
                    if (isCompleteMobile) {
                        return master.mobile === cleaned
                    } else {
                        return master.gstin?.toUpperCase() === cleaned.toUpperCase()
                    }
                }
            })

            // Auto-select if exact match found
            if (exactMatch) {
                handleResultSelect(exactMatch)
            }
        }
    }, [value, searchResults, isSearching])


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
                    const selectedResult = searchResults[highlightedIndex]
                    handleResultSelect(selectedResult)
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                setHighlightedIndex(-1)
                break
        }
    }

    const handleResultSelect = (result: CustomerSearchResult) => {
        const displayName = result.type === 'org'
            ? (result.data.alias_name || result.data.master_customer.legal_name)
            : result.data.legal_name

        onChange(displayName)
        setIsOpen(false)
        onCustomerSelect(result)
    }

    const getInputMode = (): 'text' | 'tel' => {
        // Always return text to allow mixed input (names, alphanumeric GSTIN, etc.)
        // The user can switch to numeric keypad manually if they want, 
        // but forcing 'tel' prevents typing names like "9th Avenue" easily.
        return 'text'
    }

    // Dynamic maxLength based on detected input type
    const getMaxLength = (): number | undefined => {
        if (!value || value.length < 3) {
            return undefined // No limit until we detect type
        }

        const cleaned = value.trim().replace(/\s+/g, '')
        const isAllDigits = /^\d+$/.test(cleaned)

        // Detect mobile (3-10 digits starting with 6-9)
        if (isAllDigits && /^[6-9]/.test(cleaned)) {
            return 10
        }

        // Detect GSTIN (starts with 2 digits + letter)
        if (cleaned.length >= 3 && /^[0-9]{2}[A-Z]/i.test(cleaned)) {
            return 15
        }

        // Name: no strict limit
        return undefined
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
                    maxLength={getMaxLength()}
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
                    placeholder="Search by Name, Mobile, or GSTIN"
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
                        searchResults.map((result, index) => {
                            const isHighlighted = highlightedIndex === index

                            // Extract display data based on type
                            const isOrg = result.type === 'org'
                            const data = result.data

                            const name = isOrg
                                ? ((data as CustomerWithMaster).alias_name || (data as CustomerWithMaster).master_customer.legal_name)
                                : (data as any).legal_name

                            const mobile = isOrg
                                ? (data as CustomerWithMaster).master_customer.mobile
                                : (data as any).mobile

                            const gstin = isOrg
                                ? (data as CustomerWithMaster).master_customer.gstin
                                : (data as any).gstin

                            const lastInvoiceDate = isOrg
                                ? ((data as any).last_invoice_date as string | null | undefined)
                                : null

                            return (
                                <button
                                    key={isOrg ? (data as any).id : `global-${(data as any).id}`}
                                    type="button"
                                    onClick={() => handleResultSelect(result)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] border-b border-neutral-100 last:border-0 ${isHighlighted ? 'bg-primary text-text-on-primary' : 'hover:bg-neutral-50'
                                        }`}
                                    role="option"
                                    aria-selected={isHighlighted}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {isOrg ? (
                                                    <UserIcon className={`h-4 w-4 ${isHighlighted ? 'text-text-on-primary' : 'text-primary'}`} />
                                                ) : (
                                                    <GlobeAltIcon className={`h-4 w-4 ${isHighlighted ? 'text-text-on-primary' : 'text-secondary-text'}`} />
                                                )}
                                                <div className={`text-base font-semibold ${isHighlighted ? 'text-text-on-primary' : 'text-primary-text'}`}>
                                                    {name}
                                                </div>
                                            </div>
                                            {!isOrg && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${isHighlighted ? 'bg-white/20 text-text-on-primary' : 'bg-neutral-100 text-secondary-text'
                                                    }`}>
                                                    Global
                                                </span>
                                            )}
                                        </div>

                                        <div className={`text-sm pl-6 ${isHighlighted ? 'text-text-on-primary opacity-90' : 'text-secondary-text'}`}>
                                            {mobile
                                                ? `${mobile}`
                                                : gstin
                                                    ? `GSTIN: ${gstin}`
                                                    : 'No contact info'}
                                        </div>

                                        {lastInvoiceDate && (
                                            <div className={`text-xs pl-6 ${isHighlighted ? 'text-text-on-primary opacity-75' : 'text-muted-text'}`}>
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