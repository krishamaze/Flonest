import { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent } from 'react'
import { CameraIcon } from '@heroicons/react/24/outline'
import { getProducts } from '../../lib/api/products'
import type { ProductWithMaster } from '../../types'
import { debounce } from '../../lib/utils/debounce'

interface ProductSearchComboboxProps {
  onProductSelect: (product: ProductWithMaster) => void
  onScanClick: () => void
  disabled?: boolean
  orgId: string
  products: ProductWithMaster[]
  placeholder?: string
}

/**
 * ProductSearchCombobox Component
 * Combobox for searching and selecting products with camera scanner icon
 * Supports keyboard navigation, ARIA compliance, and async product search
 */
export function ProductSearchCombobox({
  onProductSelect,
  onScanClick,
  disabled = false,
  orgId,
  products,
  placeholder = 'Search / Select Product...',
}: ProductSearchComboboxProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [searchResults, setSearchResults] = useState<ProductWithMaster[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize filtered products from props (local search)
  const localSearchResults = useMemo(() => {
    if (!search.trim()) return []
    
    const searchTerm = search.toLowerCase()
    return products.filter(p => 
      p.name?.toLowerCase().includes(searchTerm) ||
      p.sku?.toLowerCase().includes(searchTerm) ||
      p.ean?.toLowerCase().includes(searchTerm) ||
      p.master_product?.name?.toLowerCase().includes(searchTerm) ||
      p.master_product?.sku?.toLowerCase().includes(searchTerm)
    ).slice(0, 10) // Limit to 10 results for performance
  }, [search, products])

  // Debounced API search
  const performApiSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        const result = await getProducts(orgId, { 
          status: 'active',
          search: term 
        }, { page: 1, pageSize: 20 })
        setSearchResults(result.data as ProductWithMaster[])
      } catch (error) {
        console.error('Error searching products:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    [orgId]
  )

  // Update search results when search term changes
  useEffect(() => {
    if (search.trim()) {
      performApiSearch(search)
    } else {
      setSearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search, performApiSearch])

  // Combine local and API results
  const allResults = useMemo(() => {
    // Merge local and API results, removing duplicates
    const combined = [...localSearchResults]
    const existingIds = new Set(combined.map(p => p.id))
    
    searchResults.forEach(product => {
      if (!existingIds.has(product.id)) {
        combined.push(product)
      }
    })

    return combined.slice(0, 20) // Limit total results
  }, [localSearchResults, searchResults])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    setFocusedIndex(-1)
    setIsOpen(value.length > 0)
  }

  // Handle input focus
  const handleInputFocus = () => {
    if (search.trim() && allResults.length > 0) {
      setIsOpen(true)
    }
  }

  // Handle input blur (close dropdown after a delay to allow clicks)
  const handleInputBlur = () => {
    setTimeout(() => setIsOpen(false), 200)
  }

  // Handle product selection
  const handleProductSelect = (product: ProductWithMaster) => {
    setSearch('')
    setFocusedIndex(-1)
    setIsOpen(false)
    onProductSelect(product)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || allResults.length === 0) {
      if (e.key === 'Enter' && search.trim()) {
        // Try to select first result if available
        if (allResults.length > 0) {
          handleProductSelect(allResults[0])
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => 
          prev < allResults.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < allResults.length) {
          handleProductSelect(allResults[focusedIndex])
        } else if (allResults.length > 0) {
          handleProductSelect(allResults[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setFocusedIndex(-1)
        setSearch('')
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(allResults.length - 1)
        break
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listboxRef.current) {
      const focusedItem = listboxRef.current.children[focusedIndex] as HTMLElement
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex])

  // Highlight matched text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 font-semibold">{part}</mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    )
  }

  const canUseCamera = () => {
    return (
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices &&
      !disabled
    )
  }

  const focusedOptionId = focusedIndex >= 0 ? `product-option-${focusedIndex}` : undefined

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="product-listbox"
          aria-autocomplete="list"
          aria-activedescendant={focusedOptionId}
          aria-label="Search or select product"
          placeholder={placeholder}
          value={search}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full min-h-[44px] px-md py-sm pr-12 border rounded-md bg-bg-card text-base text-primary-text placeholder:text-muted-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 disabled:bg-neutral-100 disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-200 border-neutral-300"
        />
        {/* Scanner icon button - inside input field */}
        {canUseCamera() && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation shadow-sm"
            onClick={onScanClick}
            disabled={disabled}
            aria-label="Open camera scanner"
            tabIndex={-1}
            title="Scan with camera"
          >
            <CameraIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Dropdown listbox */}
      {isOpen && (allResults.length > 0 || isSearching) && (
        <ul
          id="product-listbox"
          ref={listboxRef}
          role="listbox"
          aria-label="Product search results"
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-bg-card border border-neutral-300 rounded-md shadow-lg"
          style={{ top: '100%' }}
        >
          {isSearching && allResults.length === 0 && (
            <li className="px-md py-sm text-sm text-secondary-text">
              Searching...
            </li>
          )}
          {allResults.map((product, index) => (
            <li
              key={product.id}
              id={`product-option-${index}`}
              role="option"
              aria-selected={index === focusedIndex}
              onClick={() => handleProductSelect(product)}
              className={`px-md py-sm cursor-pointer min-h-[44px] flex flex-col justify-center transition-colors ${
                index === focusedIndex
                  ? 'bg-primary text-text-on-primary'
                  : 'hover:bg-neutral-100 text-primary-text'
              }`}
            >
              <div className="font-medium">
                {highlightMatch(product.name || 'Unnamed Product', search)}
              </div>
              <div className={`text-xs ${index === focusedIndex ? 'text-text-on-primary/80' : 'text-secondary-text'}`}>
                {product.sku && `SKU: ${product.sku}`}
                {product.selling_price && ` • $${product.selling_price.toFixed(2)}`}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Empty state */}
      {isOpen && !isSearching && allResults.length === 0 && search.trim() && (
        <ul
          id="product-listbox"
          role="listbox"
          aria-label="Product search results"
          className="absolute z-50 w-full mt-1 bg-bg-card border border-neutral-300 rounded-md shadow-lg"
          style={{ top: '100%' }}
        >
          <li className="px-md py-sm text-sm text-secondary-text">
            No products found
          </li>
        </ul>
      )}
    </div>
  )
}

