import { useState, useEffect, useRef } from 'react'
import type { ProductWithMaster } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { CubeIcon, PlusIcon, CameraIcon } from '@heroicons/react/24/outline'

interface ProductSelectionComboboxProps {
    searchTerm: string
    setSearchTerm: (value: string) => void
    isSearching: boolean
    searchResults: ProductWithMaster[]
    selectedProduct: ProductWithMaster | null
    onProductSelect: (product: ProductWithMaster | null) => void
    onOpenAddNewForm: () => void
    onCameraScan?: () => void
    disabled?: boolean
    autoFocus?: boolean
    placeholder?: string
}

export function ProductSelectionCombobox({
    searchTerm,
    setSearchTerm,
    isSearching,
    searchResults,
    selectedProduct,
    onProductSelect,
    onOpenAddNewForm,
    onCameraScan,
    disabled = false,
    autoFocus = false,
    placeholder = 'Search by Name, SKU, or Barcode',
}: ProductSelectionComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [hasSelected, setHasSelected] = useState(false) // Track if user selected from dropdown
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Auto-open dropdown at 2+ chars (but NOT after selection)
    useEffect(() => {
        if (hasSelected) {
            // Don't auto-open after user selected from dropdown
            // Will reset when user edits the value
            return
        }

        if (searchTerm.trim().length >= 2) {
            setIsOpen(true)
            setHighlightedIndex(-1)
        } else {
            setIsOpen(false)
        }
    }, [searchTerm, hasSelected])

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

    const handleResultSelect = (product: ProductWithMaster) => {
        onProductSelect(product)
        setSearchTerm(product.name)
        setIsOpen(false)
        setHasSelected(true) // Mark that user selected from dropdown
    }

    const handleAddNewClick = () => {
        onOpenAddNewForm()
        setIsOpen(false)
    }

    const handleBlur = () => {
        // Just close dropdown
        setIsOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) return

        // Total items: Add New + Camera (if available) + search results
        const totalItems = searchResults.length + 1 + (onCameraScan ? 1 : 0)

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev =>
                    prev < totalItems - 1 ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => prev > -1 ? prev - 1 : -1)
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex === -1) {
                    // Add New
                    handleAddNewClick()
                } else if (onCameraScan && highlightedIndex === 0) {
                    // Camera scan
                    onCameraScan()
                    setIsOpen(false)
                } else {
                    // Product selection
                    const resultIndex = onCameraScan ? highlightedIndex - 1 : highlightedIndex
                    if (resultIndex >= 0 && resultIndex < searchResults.length) {
                        handleResultSelect(searchResults[resultIndex])
                    }
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                break
        }
    }

    return (
        <div className="relative w-full">
            <div className="relative">
                <label htmlFor="product-search" className="block text-sm font-medium text-secondary-text mb-xs">
                    Product <span className="text-error">*</span>
                </label>
                <input
                    ref={inputRef}
                    id="product-search"
                    type="text"
                    autoCapitalize="none"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setHasSelected(false) // Reset on manual edit - allow dropdown to reopen
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onClick={() => {
                        if (searchTerm.trim().length >= 2) {
                            setIsOpen(true)
                        }
                    }}
                    onFocus={() => {
                        if (searchTerm.trim().length >= 2) {
                            setIsOpen(true)
                        }
                    }}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    className={`w-full h-12 px-md py-sm border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-neutral-100 disabled:cursor-not-allowed text-base`}
                    aria-autocomplete="list"
                    aria-controls="product-search-results"
                    aria-expanded={isOpen}
                />
                {isSearching && (
                    <div className="absolute right-3 top-[calc(1.5rem+0.25rem+24px)] transform -translate-y-1/2">
                        <LoadingSpinner size="sm" />
                    </div>
                )}
            </div>

            {isOpen && searchTerm.trim().length >= 2 && (
                <div
                    ref={dropdownRef}
                    id="product-search-results"
                    className="absolute z-50 w-full mt-1 bg-white border border-neutral-300 rounded-md shadow-lg max-h-80 overflow-y-auto"
                    role="listbox"
                >
                    {/* Add New Product option - always first */}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onClick={handleAddNewClick}
                        onMouseEnter={() => setHighlightedIndex(-1)}
                        className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] border-b border-neutral-200 bg-primary-light hover:bg-primary text-primary hover:text-text-on-primary font-medium`}
                        role="option"
                        aria-selected={highlightedIndex === -1}
                    >
                        <div className="flex items-center gap-2">
                            <PlusIcon className="w-5 h-5" />
                            <span>Add New Product</span>
                        </div>
                    </button>

                    {/* Camera Scan option - second if available */}
                    {onCameraScan && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                            }}
                            onClick={() => {
                                onCameraScan()
                                setIsOpen(false)
                            }}
                            onMouseEnter={() => setHighlightedIndex(0)}
                            className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] border-b border-neutral-200 ${highlightedIndex === 0
                                    ? 'bg-primary text-text-on-primary'
                                    : 'hover:bg-neutral-50'
                                }`}
                            role="option"
                            aria-selected={highlightedIndex === 0}
                        >
                            <div className="flex items-center gap-2">
                                <CameraIcon className="w-5 h-5" />
                                <span>Scan Barcode with Camera</span>
                            </div>
                        </button>
                    )}

                    {searchResults.length > 0 ? (
                        searchResults.map((product, index) => {
                            const adjustedIndex = onCameraScan ? index + 1 : index
                            const isHighlighted = highlightedIndex === adjustedIndex

                            return (
                                <button
                                    key={product.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevent blur on click
                                        e.stopPropagation() // Prevent click-outside handler
                                    }}
                                    onClick={() => handleResultSelect(product)}
                                    onMouseEnter={() => setHighlightedIndex(adjustedIndex)}
                                    className={`w-full text-left px-4 py-3 transition-colors min-h-[44px] border-b border-neutral-100 last:border-0 ${isHighlighted ? 'bg-primary text-text-on-primary' : 'hover:bg-neutral-50'
                                        }`}
                                    role="option"
                                    aria-selected={isHighlighted}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <CubeIcon className={`h-4 w-4 ${isHighlighted ? 'text-text-on-primary' : 'text-primary'}`} />
                                                <div className={`text-base font-semibold ${isHighlighted ? 'text-text-on-primary' : 'text-primary-text'}`}>
                                                    {product.name}
                                                </div>
                                            </div>
                                            {product.selling_price && (
                                                <span className={`text-sm font-medium ${isHighlighted ? 'text-text-on-primary' : 'text-primary'}`}>
                                                    ₹{product.selling_price.toFixed(2)}
                                                </span>
                                            )}
                                        </div>

                                        <div className={`text-sm pl-6 ${isHighlighted ? 'text-text-on-primary opacity-90' : 'text-secondary-text'}`}>
                                            SKU: {product.sku}
                                            {product.ean && ` • EAN: ${product.ean}`}
                                            {product.hsn_sac_code && ` • HSN: ${product.hsn_sac_code}`}
                                        </div>
                                    </div>
                                </button>
                            )
                        })
                    ) : !isSearching ? (
                        <div className="px-4 py-3 text-sm text-secondary-text text-center">
                            No matching products found
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
