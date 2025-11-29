import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { searchCustomersByPartialIdentifier } from '../../lib/api/customers'
import type { CustomerWithMaster } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface CustomerSearchComboboxProps {
    orgId: string
    value: string
    onChange: (value: string) => void
    onCustomerSelect: (customer: CustomerWithMaster | null) => void
    onAddNewPartyClick: () => void
    disabled?: boolean
    autoFocus?: boolean
}

export function CustomerSearchCombobox({
    orgId,
    value,
    onChange,
    onCustomerSelect,
    onAddNewPartyClick,
    disabled = false,
    autoFocus = false,
}: CustomerSearchComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchResults, setSearchResults] = useState<CustomerWithMaster[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Search customers with debounce
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        if (value.trim().length < 3) {
            setSearchResults([])
            setIsOpen(false)
            return
        }

        debounceTimerRef.current = setTimeout(async () => {
            setIsSearching(true)
            try {
                const results = await searchCustomersByPartialIdentifier(orgId, value.trim())
                setSearchResults(results)
                setIsOpen(true)
                setHighlightedIndex(-1)
            } catch (error) {
                console.error('Error searching customers:', error)
                setSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [value, orgId])

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
        if (!isOpen) return

        const totalItems = searchResults.length + 1

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
                if (highlightedIndex === 0) {
                    handleAddNewPartyClick()
                } else if (highlightedIndex > 0) {
                    const selectedCustomer = searchResults[highlightedIndex - 1]
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

    const handleAddNewPartyClick = () => {
        setIsOpen(false)
        onAddNewPartyClick()
    }

    const handleCustomerSelect = (customer: CustomerWithMaster) => {
        onChange(customer.alias_name || customer.master_customer.legal_name)
        setIsOpen(false)
        onCustomerSelect(customer)
    }

    const getInputMode = (): 'text' | 'tel' => {
        if (!value) return 'text'
        const firstChar = value.charAt(0)
        return /\d/.test(firstChar) ? 'tel' : 'text'
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
                    Customer Identifier <span className="text-error">*</span>
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
                    <button
                        type="button"
                        onClick={handleAddNewPartyClick}
                        onMouseEnter={() => setHighlightedIndex(0)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-2 transition-colors min-h-[44px] ${highlightedIndex === 0
                                ? 'bg-primary text-text-on-primary'
                                : 'hover:bg-neutral-50 text-primary'
                            }`}
                        role="option"
                        aria-selected={highlightedIndex === 0}
                    >
                        <PlusIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="font-medium">+ Add New Party</span>
                    </button>

                    {searchResults.length > 0 && (
                        <div className="border-t border-neutral-200" />
                    )}

                    {searchResults.map((customer, index) => {
                        const itemIndex = index + 1
                        const isHighlighted = highlightedIndex === itemIndex
                        const lastInvoiceDate = (customer as any).last_invoice_date as string | null | undefined

                        return (
                            <button
                                key={customer.id}
                                type="button"
                                onClick={() => handleCustomerSelect(customer)}
                                onMouseEnter={() => setHighlightedIndex(itemIndex)}
                                className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] ${isHighlighted ? 'bg-primary text-text-on-primary' : 'hover:bg-neutral-50'
                                    }`}
                                role="option"
                                aria-selected={isHighlighted}
                            >
                                <div className="space-y-0.5">
                                    <div className={`text-base font-semibold ${isHighlighted ? 'text-text-on-primary' : 'text-primary-text'}`}>
                                        {customer.alias_name || customer.master_customer.legal_name}
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
                    })}

                    {searchResults.length === 0 && !isSearching && (
                        <div className="px-4 py-3 text-sm text-secondary-text text-center">
                            No matching customers
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}