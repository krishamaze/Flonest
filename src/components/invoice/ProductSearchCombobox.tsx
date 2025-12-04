import { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent } from 'react'
import { CameraIcon, PlusIcon, CheckIcon, DevicePhoneMobileIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { getProducts } from '../../lib/api/products'
import { searchMasterProducts, type MasterProduct } from '../../lib/api/master-products'
import { resolveEntry } from '../../lib/api/reactive-entry'
import type { ProductWithMaster } from '../../types'
import { debounce } from '../../lib/utils/debounce'
import { CURRENCY_SYMBOL } from '../../lib/utils/currency'
import { classifyProductSearchMode, type ProductSearchMode, getSearchModeLabel } from '../../lib/utils/productSearchMode'

/** Result from serial number lookup */
interface SerialLookupResult {
  type: 'serial'
  product_id: string
  product_name: string
  product_sku: string
  selling_price: number | null
  hsn_code: string | null
  gst_rate: number | null
  serial_number: string
}

interface ProductSearchComboboxProps {
  onProductSelect: (product: ProductWithMaster) => void
  onScanClick: () => void
  disabled?: boolean
  orgId: string
  products: ProductWithMaster[]
  placeholder?: string
  /** Enable serial number/IMEI search (for transaction flows only) */
  allowSerialSearch?: boolean
  /** Callback when user wants to add new product */
  onAddNewProduct?: (prefillData: {
    name: string
    searchMode: ProductSearchMode
    detectedCategory?: { name: string; hsn_code: string; gst_rate: number }
    serialNumber?: string
  }) => void
  /** Callback when serial number found and selected */
  onSerialSelect?: (result: SerialLookupResult) => void
}

/**
 * ProductSearchCombobox Component
 * Smart combobox for searching products with:
 * - IMEI/Serial number detection (transaction flows only)
 * - EAN/Barcode detection
 * - SKU detection
 * - Name search
 * - Master catalog search
 * - "Add New" option with category-aware prefill
 */
export function ProductSearchCombobox({
  onProductSelect,
  onScanClick,
  disabled = false,
  orgId,
  products,
  placeholder = 'Search by Name, SKU, Barcode...',
  allowSerialSearch = false,
  onAddNewProduct,
  onSerialSelect,
}: ProductSearchComboboxProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [searchResults, setSearchResults] = useState<ProductWithMaster[]>([])
  const [masterResults, setMasterResults] = useState<MasterProduct[]>([])
  const [serialResult, setSerialResult] = useState<SerialLookupResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchMode, setSearchMode] = useState<ProductSearchMode>('name')
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Classify search mode when input changes
  const classification = useMemo(() => {
    return classifyProductSearchMode(search)
  }, [search])

  // Update search mode
  useEffect(() => {
    setSearchMode(classification.mode)
  }, [classification.mode])

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

  // Smart search: serial lookup + org products + master catalog
  const performSmartSearch = useCallback(
    debounce(async (term: string, mode: ProductSearchMode) => {
      if (term.length < 2) {
        setSearchResults([])
        setMasterResults([])
        setSerialResult(null)
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      setSerialResult(null)

      try {
        // For IMEI mode with allowSerialSearch, try serial lookup first
        if (allowSerialSearch && (mode === 'imei' || term.length >= 10)) {
          const resolution = await resolveEntry(term, orgId)

          if (resolution.type === 'SERIAL_FOUND') {
            setSerialResult({
              type: 'serial',
              product_id: resolution.data.product_id,
              product_name: resolution.data.product_name,
              product_sku: resolution.data.product_sku,
              selling_price: resolution.data.selling_price,
              hsn_code: resolution.data.hsn_code,
              gst_rate: resolution.data.gst_rate,
              serial_number: term,
            })
            setSearchResults([])
            setMasterResults([])
            setIsSearching(false)
            return
          }
        }

        // Parallel search: org products + master catalog
        const [orgResult, masterResult] = await Promise.all([
          getProducts(orgId, {
            status: 'active',
            search: term
          }, { page: 1, pageSize: 10 }),
          searchMasterProducts({
            q: term,
            limit: 5,
          }),
        ])

        setSearchResults(orgResult.data as ProductWithMaster[])
        setMasterResults(masterResult)
      } catch (error) {
        console.error('Error searching products:', error)
        setSearchResults([])
        setMasterResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    [orgId, allowSerialSearch]
  )

  // Update search results when search term changes
  useEffect(() => {
    if (search.trim()) {
      performSmartSearch(search, classification.mode)
    } else {
      setSearchResults([])
      setMasterResults([])
      setSerialResult(null)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search, classification.mode, performSmartSearch])

  // Combine local and API results (org products only)
  const allOrgResults = useMemo(() => {
    const combined = [...localSearchResults]
    const existingIds = new Set(combined.map(p => p.id))

    searchResults.forEach(product => {
      if (!existingIds.has(product.id)) {
        combined.push(product)
      }
    })

    return combined.slice(0, 10)
  }, [localSearchResults, searchResults])

  // Total dropdown items count for keyboard navigation
  const totalItemsCount = useMemo(() => {
    let count = 0
    if (serialResult) count += 1
    count += allOrgResults.length
    count += masterResults.length
    count += 1 // "Add New" option
    return count
  }, [serialResult, allOrgResults.length, masterResults.length])

  // Check if dropdown should be open
  const hasResults = serialResult || allOrgResults.length > 0 || masterResults.length > 0

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    setFocusedIndex(-1)
    setIsOpen(value.length > 0)
  }

  // Handle input focus
  const handleInputFocus = () => {
    if (search.trim() && (hasResults || search.length >= 2)) {
      setIsOpen(true)
    }
  }

  // Handle input blur (close dropdown after a delay to allow clicks)
  const handleInputBlur = () => {
    setTimeout(() => setIsOpen(false), 200)
  }

  // Handle product selection (org product)
  const handleProductSelect = (product: ProductWithMaster) => {
    setSearch('')
    setFocusedIndex(-1)
    setIsOpen(false)
    onProductSelect(product)
  }

  // Handle serial number selection
  const handleSerialSelect = (result: SerialLookupResult) => {
    setSearch('')
    setFocusedIndex(-1)
    setIsOpen(false)
    onSerialSelect?.(result)
  }

  // Handle master product selection (needs to link/create org product)
  const handleMasterSelect = (master: MasterProduct) => {
    // For now, create an org product from master
    // This should be handled by parent component
    const productFromMaster: ProductWithMaster = {
      id: '', // Will be created
      org_id: orgId,
      name: master.name || '',
      sku: master.sku || '',
      ean: master.barcode_ean || null,
      selling_price: master.base_price || null,
      hsn_sac_code: master.hsn_code || null,
      tax_rate: master.gst_rate || null,
      unit: master.base_unit || 'pcs',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      master_product_id: master.id,
      // Required Product fields
      branch_id: null,
      category: null,
      category_id: null,
      cost_price: null,
      description: null,
      min_stock_level: 0,
      serial_tracked: false,
      // Master product relation
      master_product: {
        id: master.id,
        gst_rate: master.gst_rate || null,
        hsn_code: master.hsn_code || null,
        base_price: master.base_price || null,
        name: master.name || '',
        sku: master.sku || '',
        approval_status: (master.approval_status || 'pending') as 'pending' | 'auto_pass' | 'approved' | 'rejected',
      },
    }
    setSearch('')
    setFocusedIndex(-1)
    setIsOpen(false)
    onProductSelect(productFromMaster)
  }

  // Handle "Add New" click
  const handleAddNew = () => {
    setIsOpen(false)
    onAddNewProduct?.({
      name: search.trim(),
      searchMode: classification.mode,
      detectedCategory: classification.detectedCategory,
      serialNumber: classification.mode === 'imei' ? classification.normalized : undefined,
    })
  }

  // Get item at focused index (handles serial, org, master, addNew)
  const getItemAtIndex = useCallback((index: number): { type: 'serial' | 'org' | 'master' | 'addNew', data?: any } | null => {
    if (index < 0) return null

    let currentIndex = 0

    // Serial result
    if (serialResult) {
      if (index === currentIndex) return { type: 'serial', data: serialResult }
      currentIndex++
    }

    // Org products
    if (index < currentIndex + allOrgResults.length) {
      return { type: 'org', data: allOrgResults[index - currentIndex] }
    }
    currentIndex += allOrgResults.length

    // Master products
    if (index < currentIndex + masterResults.length) {
      return { type: 'master', data: masterResults[index - currentIndex] }
    }
    currentIndex += masterResults.length

    // Add New option
    if (index === currentIndex) return { type: 'addNew' }

    return null
  }, [serialResult, allOrgResults, masterResults])

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'Enter' && search.trim() && onAddNewProduct) {
        e.preventDefault()
        handleAddNew()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => prev < totalItemsCount - 1 ? prev + 1 : prev)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        const item = getItemAtIndex(focusedIndex)
        if (item) {
          switch (item.type) {
            case 'serial':
              handleSerialSelect(item.data)
              break
            case 'org':
              handleProductSelect(item.data)
              break
            case 'master':
              handleMasterSelect(item.data)
              break
            case 'addNew':
              handleAddNew()
              break
          }
        } else if (serialResult) {
          handleSerialSelect(serialResult)
        } else if (allOrgResults.length > 0) {
          handleProductSelect(allOrgResults[0])
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
        setFocusedIndex(totalItemsCount - 1)
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

      {/* Search mode indicator */}
      {search.length >= 2 && searchMode !== 'name' && (
        <div className="absolute left-0 -top-5 text-xs text-secondary-text">
          {getSearchModeLabel(searchMode)}
          {searchMode === 'imei' && classification.isValid && (
            <CheckIcon className="inline h-3 w-3 ml-1 text-green-600" />
          )}
        </div>
      )}

      {/* Smart Dropdown */}
      {isOpen && search.trim().length >= 2 && (
        <ul
          id="product-listbox"
          ref={listboxRef}
          role="listbox"
          aria-label="Product search results"
          className="absolute z-50 w-full mt-1 max-h-80 overflow-auto bg-bg-card border border-neutral-300 rounded-md shadow-lg"
          style={{ top: '100%' }}
        >
          {/* Loading state */}
          {isSearching && !serialResult && allOrgResults.length === 0 && masterResults.length === 0 && (
            <li className="px-md py-sm text-sm text-secondary-text">
              Searching...
            </li>
          )}

          {/* Serial Number Found (transaction context only) */}
          {serialResult && (
            <>
              <li className="px-md py-xs text-xs font-semibold text-secondary-text bg-green-50 border-b border-neutral-200 uppercase tracking-wide">
                Serial Number Found
              </li>
              <li
                id="product-option-0"
                role="option"
                aria-selected={focusedIndex === 0}
                onClick={() => handleSerialSelect(serialResult)}
                className={`px-md py-sm cursor-pointer min-h-[44px] flex items-center gap-3 transition-colors border-b border-neutral-100 ${focusedIndex === 0 ? 'bg-green-600 text-white' : 'hover:bg-green-50 text-primary-text'
                  }`}
              >
                <DevicePhoneMobileIcon className={`h-5 w-5 ${focusedIndex === 0 ? 'text-white' : 'text-green-600'}`} />
                <div className="flex-1">
                  <div className="font-medium">{serialResult.product_name}</div>
                  <div className={`text-xs ${focusedIndex === 0 ? 'text-white/80' : 'text-secondary-text'}`}>
                    SKU: {serialResult.product_sku}
                    {serialResult.selling_price && ` • ${CURRENCY_SYMBOL}${serialResult.selling_price.toFixed(2)}`}
                  </div>
                </div>
                <CheckIcon className={`h-5 w-5 ${focusedIndex === 0 ? 'text-white' : 'text-green-600'}`} />
              </li>
            </>
          )}

          {/* Your Products (Org) */}
          {allOrgResults.length > 0 && (
            <>
              <li className="px-md py-xs text-xs font-semibold text-secondary-text bg-neutral-50 border-b border-neutral-200 uppercase tracking-wide">
                Your Products
              </li>
              {allOrgResults.map((product, idx) => {
                const itemIndex = (serialResult ? 1 : 0) + idx
                const isFocused = focusedIndex === itemIndex
                return (
                  <li
                    key={product.id}
                    id={`product-option-${itemIndex}`}
                    role="option"
                    aria-selected={isFocused}
                    onClick={() => handleProductSelect(product)}
                    className={`px-md py-sm cursor-pointer min-h-[44px] flex flex-col justify-center transition-colors border-b border-neutral-100 last:border-0 ${isFocused ? 'bg-primary text-text-on-primary' : 'hover:bg-neutral-100 text-primary-text'
                      }`}
                  >
                    <div className="font-medium">
                      {highlightMatch(product.name || 'Unnamed Product', search)}
                    </div>
                    <div className={`text-xs ${isFocused ? 'text-text-on-primary/80' : 'text-secondary-text'}`}>
                      {product.sku && `SKU: ${product.sku}`}
                      {product.selling_price && ` • ${CURRENCY_SYMBOL}${product.selling_price.toFixed(2)}`}
                    </div>
                  </li>
                )
              })}
            </>
          )}

          {/* From Catalog (Master) */}
          {masterResults.length > 0 && (
            <>
              <li className="px-md py-xs text-xs font-semibold text-secondary-text bg-blue-50 border-b border-neutral-200 uppercase tracking-wide flex items-center gap-1">
                <GlobeAltIcon className="h-3 w-3" />
                From Catalog
              </li>
              {masterResults.map((master, idx) => {
                const itemIndex = (serialResult ? 1 : 0) + allOrgResults.length + idx
                const isFocused = focusedIndex === itemIndex
                return (
                  <li
                    key={master.id}
                    id={`product-option-${itemIndex}`}
                    role="option"
                    aria-selected={isFocused}
                    onClick={() => handleMasterSelect(master)}
                    className={`px-md py-sm cursor-pointer min-h-[44px] flex flex-col justify-center transition-colors border-b border-neutral-100 last:border-0 ${isFocused ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-primary-text'
                      }`}
                  >
                    <div className="font-medium">
                      {highlightMatch(master.name || 'Unnamed Product', search)}
                    </div>
                    <div className={`text-xs ${isFocused ? 'text-white/80' : 'text-secondary-text'}`}>
                      {master.sku && `SKU: ${master.sku}`}
                      {master.base_price && ` • ${CURRENCY_SYMBOL}${master.base_price.toFixed(2)} (suggested)`}
                    </div>
                  </li>
                )
              })}
            </>
          )}

          {/* Add New Product option */}
          {onAddNewProduct && (
            <li
              id={`product-option-${totalItemsCount - 1}`}
              role="option"
              aria-selected={focusedIndex === totalItemsCount - 1}
              onClick={handleAddNew}
              className={`px-md py-sm cursor-pointer min-h-[44px] flex items-center gap-2 transition-colors font-medium ${focusedIndex === totalItemsCount - 1
                ? 'bg-primary text-text-on-primary'
                : 'bg-primary-light text-primary hover:bg-primary hover:text-text-on-primary'
                }`}
            >
              <PlusIcon className="h-5 w-5" />
              <span>
                Create "{search.trim()}" as new product
                {classification.mode === 'imei' && classification.isValid && (
                  <span className="text-xs ml-1 opacity-75">(Mobile)</span>
                )}
              </span>
            </li>
          )}

          {/* Empty state - no results and no add option */}
          {!isSearching && !serialResult && allOrgResults.length === 0 && masterResults.length === 0 && !onAddNewProduct && (
            <li className="px-md py-sm text-sm text-secondary-text text-center">
              No products found
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

