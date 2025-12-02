import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchCustomersAutocomplete } from '../../hooks/useCustomers'
import type { CustomerWithMaster, CustomerSearchResult } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { UserIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { classifySearchMode, isCompleteInput, type SearchMode } from '../../lib/utils/customerSearchMode'

interface CustomerSearchComboboxProps {
    orgId: string
    value: string
    onChange: (value: string) => void
    onCustomerSelect: (result: CustomerSearchResult | null) => void
    onModeFinalized?: (mode: SearchMode, value: string) => void  // Pass value for auto-copy
    disabled?: boolean
    autoFocus?: boolean
}

export function CustomerSearchCombobox({
    orgId,
    value,
    onChange,
    onCustomerSelect,
    onModeFinalized,
    disabled = false,
    autoFocus = false,
}: CustomerSearchComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [searchMode, setSearchMode] = useState<SearchMode>(null)
    const [isModeFinalized, setIsModeFinalized] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Track base query (first 3 chars) for server fetch
    const [baseQuery, setBaseQuery] = useState('')

    // Classify mode and set base query at 3+ chars
    useEffect(() => {
        const trimmed = value.trim()

        if (trimmed.length < 3) {
            // Reset mode when below 3 chars
            setSearchMode(null)
            setBaseQuery('')
            setIsOpen(false)
            setIsModeFinalized(false)
        } else {
            const first3 = trimmed.substring(0, 3)
            const newMode = classifySearchMode(first3)

            // If mode changes (user switched from mobile to GSTIN or vice versa), reset
            if (newMode && newMode !== searchMode) {
                setSearchMode(newMode)
                setBaseQuery(trimmed) // Use full input for better search
                setIsModeFinalized(false)
            } else if (!searchMode && newMode) {
                // Initial classification
                setSearchMode(newMode)
                setBaseQuery(trimmed) // Use full input for better search
                setIsModeFinalized(false)
            } else if (searchMode) {
                // Mode already set, update query with more chars for better results
                setBaseQuery(trimmed)
            }
        }
        // Above 3 chars with mode already set: mode stays locked, baseQuery unchanged
    }, [value, searchMode])

    // Fetch from server using base query
    const { data: serverResults = [], isLoading: isSearching } = useSearchCustomersAutocomplete(
        orgId,
        baseQuery,
        baseQuery.length >= 3
    )

    // Client-side filter and order results
    const searchResults = useMemo(() => {
        const trimmed = value.trim().toLowerCase()
        if (trimmed.length < 3 || !searchMode) return []

        // Filter results based on current input
        const filtered = serverResults.filter(result => {
            const customer = result.type === 'org'
                ? result.data as CustomerWithMaster
                : result.data as any

            const name = result.type === 'org'
                ? (customer.alias_name || customer.master_customer?.legal_name || '').toLowerCase()
                : (customer.legal_name || '').toLowerCase()
            const mobile = result.type === 'org'
                ? (customer.master_customer?.mobile || '')
                : (customer.mobile || '')
            const gstin = result.type === 'org'
                ? (customer.master_customer?.gstin || '').toLowerCase()
                : (customer.gstin || '').toLowerCase()

            return name.includes(trimmed) ||
                mobile.startsWith(trimmed) ||
                gstin.startsWith(trimmed)
        })

        // Sort: primary matches first, then secondary
        const sorted = filtered.sort((a, b) => {
            const customerA = a.type === 'org' ? a.data as any : a.data as any
            const customerB = b.type === 'org' ? b.data as any : b.data as any

            const mobileA = a.type === 'org' ? customerA.master_customer?.mobile : customerA.mobile
            const mobileB = b.type === 'org' ? customerB.master_customer?.mobile : customerB.mobile
            const gstinA = a.type === 'org' ? customerA.master_customer?.gstin : customerA.gstin
            const gstinB = b.type === 'org' ? customerB.master_customer?.gstin : customerB.gstin

            // Primary match for mobile mode
            if (searchMode === 'mobile') {
                const aPrimary = mobileA?.startsWith(trimmed) ? 1 : 0
                const bPrimary = mobileB?.startsWith(trimmed) ? 1 : 0
                if (aPrimary !== bPrimary) return bPrimary - aPrimary
            }

            // Primary match for GSTIN mode
            if (searchMode === 'gstin') {
                const aPrimary = gstinA?.toLowerCase().startsWith(trimmed) ? 1 : 0
                const bPrimary = gstinB?.toLowerCase().startsWith(trimmed) ? 1 : 0
                if (aPrimary !== bPrimary) return bPrimary - aPrimary
            }

            return 0 // Keep original order for secondary matches
        })

        // Limit to 5 results
        return sorted.slice(0, 5)
    }, [value, serverResults, searchMode])

    // Auto-open dropdown at 3+ chars
    useEffect(() => {
        if (value.trim().length >= 3 && searchMode) {
            setIsOpen(true)
            setHighlightedIndex(-1)
        } else {
            setIsOpen(false)
        }
    }, [value, searchMode])

    // Auto-select on complete input (mobile/GSTIN only, not names)
    useEffect(() => {
        if (searchMode === 'name') return // Names require manual selection
        if (!searchMode || !isCompleteInput(value, searchMode)) return
        if (isSearching) return // Wait for search to complete
        if (searchResults.length === 0) {
            setIsOpen(false)
            return
        }

        const cleaned = value.trim().replace(/\s+/g, '')

        // Find exact match
        const exactMatch = searchResults.find(result => {
            const customer = result.type === 'org' ? result.data as any : result.data as any
            const matchMobile = result.type === 'org'
                ? customer.master_customer?.mobile
                : customer.mobile
            const matchGstin = result.type === 'org'
                ? customer.master_customer?.gstin
                : customer.gstin

            return searchMode === 'mobile'
                ? matchMobile === cleaned
                : matchGstin?.toUpperCase() === cleaned.toUpperCase()
        })

        if (exactMatch) {
            handleResultSelect(exactMatch)
        } else {
            setIsOpen(false)
        }
    }, [value, searchResults, searchMode, isSearching])

    // Close on click outside
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

    const handleResultSelect = (result: CustomerSearchResult) => {
        // Finalize mode on selection
        if (searchMode && !isModeFinalized) {
            setIsModeFinalized(true)
            onModeFinalized?.(searchMode, value)
        }

        setIsOpen(false)
        onCustomerSelect(result)
    }

    const handleBlur = () => {
        // Close dropdown
        setIsOpen(false)

        // Finalize ONLY for mobile/GSTIN on complete input
        // Name mode requires explicit ✓ button click in CustomerSelectionStep
        if (searchMode && searchMode !== 'name' && !isModeFinalized && isCompleteInput(value, searchMode)) {
            setIsModeFinalized(true)
            onModeFinalized?.(searchMode, value)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || searchResults.length === 0) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev =>
                    prev < searchResults.length - 1 ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => prev > -1 ? prev - 1 : -1)
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
                    handleResultSelect(searchResults[highlightedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                break
        }
    }

    const getLabel = (): string => {
        if (value.length < 3) return 'Customer Identifier'
        if (searchMode === 'mobile') return 'Mobile Number'
        if (searchMode === 'gstin') return 'GSTIN'
        if (searchMode === 'name') return 'Customer Name'
        return 'Customer Identifier'
    }


    return (
        <div className="relative w-full">
            <div className="relative">
                <label htmlFor="customer-search" className="block text-sm font-medium text-secondary-text mb-xs">
                    {getLabel()} <span className="text-error">*</span>
                </label>
                <input
                    ref={inputRef}
                    id="customer-search"
                    type="text"
                    inputMode="text"
                    autoCapitalize={searchMode === 'gstin' ? 'characters' : 'none'}
                    value={value}
                    onChange={(e) => {
                        let newValue = e.target.value

                        // Remove spaces only for mobile/GSTIN modes
                        if (searchMode === 'mobile' || searchMode === 'gstin') {
                            newValue = newValue.replace(/\s+/g, '')
                        }

                        // Uppercase for GSTIN
                        if (searchMode === 'gstin') {
                            newValue = newValue.toUpperCase()
                        }

                        // Title case for names (capitalize first letter of each word)
                        if (searchMode === 'name') {
                            // Remove periods (from double-space shortcuts)
                            newValue = newValue.replace(/\./g, '')
                            // Normalize multiple spaces to single space
                            newValue = newValue.replace(/\s+/g, ' ')
                        }

                        onChange(newValue)
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onClick={() => {
                        if (value.trim().length >= 3 && searchMode) {
                            setIsOpen(true)
                        }
                    }}
                    onFocus={() => {
                        if (value.trim().length >= 3 && searchMode) {
                            setIsOpen(true)
                        }
                    }}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    placeholder="Search by Mobile, GSTIN, or Name"
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
                    {/* Finalize name mode button */}
                    {searchMode === 'name' && value.trim().length >= 3 && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                setIsModeFinalized(true)
                                onModeFinalized?.(searchMode, value)
                            }}
                            className="w-full text-left px-4 py-3 border-b-2 border-neutral-200 bg-success-50 hover:bg-success-100 transition-colors font-medium text-success flex items-center gap-2"
                        >
                            <span className="text-xl">✓</span>
                            <span>Use "{value.trim()}"</span>
                        </button>
                    )}

                    {searchResults.length > 0 ? (
                        searchResults.map((result, index) => {
                            const isHighlighted = highlightedIndex === index
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
                                            {mobile ? mobile : gstin ? `GSTIN: ${gstin}` : 'No contact info'}
                                        </div>
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