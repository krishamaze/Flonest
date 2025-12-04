import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchCustomersAutocomplete } from '../../hooks/useCustomers'
import type { CustomerWithMaster, CustomerSearchResult } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { UserIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { classifySearchMode, type SearchMode } from '../../lib/utils/customerSearchMode'

interface CustomerSearchComboboxProps {
    orgId: string
    value: string
    onChange: (value: string) => void
    onCustomerSelect: (result: CustomerSearchResult | null) => void
    onModeFinalized?: (mode: SearchMode) => void
    onResetMode?: () => void  // Callback to unlock/reset the field
    isFinalizedExternal?: boolean  // External finalization state from parent
    disabled?: boolean
    autoFocus?: boolean
}

export function CustomerSearchCombobox({
    orgId,
    value,
    onChange,
    onCustomerSelect,
    onModeFinalized: _onModeFinalized, // Called by parent via ✓ button, not internally
    onResetMode,
    isFinalizedExternal = false,
    disabled = false,
    autoFocus = false,
}: CustomerSearchComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [searchMode, setSearchMode] = useState<SearchMode>(null)
    const [hasSelected, setHasSelected] = useState(false) // Track if user selected from dropdown
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Track base query (first 3 chars) for server fetch
    const [baseQuery, setBaseQuery] = useState('')

    // Classify mode and set base query at 3+ chars (debounced)
    useEffect(() => {
        const trimmed = value.trim()

        if (trimmed.length < 3) {
            // Reset mode when below 3 chars (immediate, no debounce)
            setSearchMode(null)
            setBaseQuery('')
            setIsOpen(false)
            return
        }

        // Debounce baseQuery updates by 300ms to reduce flickering
        const debounceTimer = setTimeout(() => {
            const first3 = trimmed.substring(0, 3)
            const newMode = classifySearchMode(first3)

            // If mode changes (user switched from mobile to GSTIN or vice versa), reset
            if (newMode && newMode !== searchMode) {
                setSearchMode(newMode)
                setBaseQuery(trimmed) // Use full input for better search
            } else if (!searchMode && newMode) {
                // Initial classification
                setSearchMode(newMode)
                setBaseQuery(trimmed) // Use full input for better search
            } else if (searchMode) {
                // Mode already set, update query with more chars for better results
                setBaseQuery(trimmed)
            }
        }, 300)

        // Cleanup timeout on value change
        return () => clearTimeout(debounceTimer)
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

    // Auto-open dropdown at 3+ chars (but NOT when finalized/locked or after selection)
    useEffect(() => {
        if (isFinalizedExternal) {
            // Don't auto-open when locked
            setIsOpen(false)
            return
        }

        if (hasSelected) {
            // Don't auto-open after user selected from dropdown
            // Will reset when user edits the value
            return
        }

        if (value.trim().length >= 3 && searchMode) {
            setIsOpen(true)
            setHighlightedIndex(-1)
        } else {
            setIsOpen(false)
        }
    }, [value, searchMode, isFinalizedExternal, hasSelected])


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
        // Autocomplete the identifier but DON'T lock yet
        // User must click ✓ button to finalize/lock
        onCustomerSelect(result)
        setIsOpen(false)
        setHasSelected(true) // Mark that user selected from dropdown
    }

    const handleBlur = () => {
        // Just close dropdown - no auto-finalize
        // User must click ✓ button to finalize/lock
        setIsOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) return

        const maxIndex = searchResults.length // Add New is at this index

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev =>
                    prev < maxIndex ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex === maxIndex) {
                    // Add New
                    onCustomerSelect(null)
                    setIsOpen(false)
                } else if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
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
                        setHasSelected(false) // Reset on manual edit - allow dropdown to reopen
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onClick={() => {
                        if (value.trim().length >= 3 && searchMode && !isFinalizedExternal) {
                            setIsOpen(true)
                        }
                    }}
                    onFocus={() => {
                        if (value.trim().length >= 3 && searchMode && !isFinalizedExternal) {
                            setIsOpen(true)
                        }
                    }}
                    disabled={disabled}
                    readOnly={isFinalizedExternal}
                    autoFocus={autoFocus}
                    placeholder="Search by Mobile, GSTIN, or Name"
                    className={`w-full h-12 px-md py-sm border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-neutral-100 disabled:cursor-not-allowed text-base ${isFinalizedExternal ? 'bg-neutral-50 cursor-default' : ''
                        }`}
                    aria-autocomplete="list"
                    aria-controls="customer-search-results"
                    aria-expanded={isOpen}
                />
                {isSearching && !isFinalizedExternal && (
                    <div className="absolute right-3 top-[calc(1.5rem+0.25rem+24px)] transform -translate-y-1/2">
                        <LoadingSpinner size="sm" />
                    </div>
                )}
                {isFinalizedExternal && onResetMode && (
                    <button
                        type="button"
                        onClick={onResetMode}
                        className="absolute right-3 top-[calc(1.5rem+0.25rem+24px)] transform -translate-y-1/2 p-1 text-primary hover:text-primary-dark transition-colors"
                        title="Edit identifier"
                        aria-label="Edit identifier"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                    </button>
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
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevent blur on click
                                        e.stopPropagation() // Prevent click-outside handler
                                    }}
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
                        <div className="px-4 py-3 text-sm text-secondary-text text-center border-b border-neutral-100">
                            No matching customers found
                        </div>
                    ) : null}

                    {/* Add New Customer option - always available at bottom */}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onClick={() => {
                            onCustomerSelect(null) // Clear selection, trigger add new mode
                            setIsOpen(false)
                        }}
                        onMouseEnter={() => setHighlightedIndex(searchResults.length)}
                        className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] bg-primary-light hover:bg-primary text-primary hover:text-text-on-primary font-medium`}
                        role="option"
                        aria-selected={highlightedIndex === searchResults.length}
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span>Create New Customer</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    )
}