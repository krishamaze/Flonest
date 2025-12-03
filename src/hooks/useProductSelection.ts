import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ProductWithMaster, MasterProduct } from '../types'
import { useCreateProduct } from './useProducts'
import { getProducts } from '../lib/api/products'
import { searchMasterProducts } from '../lib/api/master-products'

/**
 * Hook inputs
 */
export interface UseProductSelectionProps {
  orgId: string
  onError: (message: string) => void
  onProductCreated?: (product: ProductWithMaster) => void
  onProductSelected?: (product: ProductWithMaster) => void
}

/**
 * Hook outputs
 */
export interface UseProductSelectionReturn {
  // Search state
  searchTerm: string
  setSearchTerm: (value: string) => void
  isSearching: boolean
  searchResults: ProductWithMaster[]
  masterResults: MasterProduct[] // NEW: master catalog results
  
  // Selection state
  selectedProduct: ProductWithMaster | null
  setSelectedProduct: (product: ProductWithMaster | null) => void
  
  // Inline "Add New" form
  showAddNewForm: boolean
  inlineFormData: {
    name: string
    sku: string
    selling_price: number | undefined
    hsn_sac_code: string
    unit: string
  }
  formErrors: Record<string, string>
  
  // Computed
  isFormDataValid: boolean
  
  // Actions
  handleProductSelected: (product: ProductWithMaster) => void
  handleOpenAddNewForm: () => void
  handleCloseAddNewForm: () => void
  handleFormDataChange: (data: Partial<UseProductSelectionReturn['inlineFormData']>) => void
  handleCreateProduct: () => Promise<void>
  handleLinkMasterProduct: (masterProduct: MasterProduct) => Promise<void> // NEW: link master product
  resetSelection: () => void
}

/**
 * useProductSelection
 * 
 * Manages product selection, search, and inline creation for stock adjustments and invoices.
 * Based on useInvoiceCustomer pattern.
 */
export function useProductSelection({
  orgId,
  onError,
  onProductCreated,
  onProductSelected,
}: UseProductSelectionProps): UseProductSelectionReturn {

  // Store callbacks in refs to avoid useCallback dependency issues
  // This prevents infinite loops when callers pass inline arrow functions
  const onErrorRef = useRef(onError)
  const onProductCreatedRef = useRef(onProductCreated)
  const onProductSelectedRef = useRef(onProductSelected)
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { onProductCreatedRef.current = onProductCreated }, [onProductCreated])
  useEffect(() => { onProductSelectedRef.current = onProductSelected }, [onProductSelected])

  // Hooks for product mutations
  const createProductMutation = useCreateProduct()

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ProductWithMaster[]>([])
  const [masterResults, setMasterResults] = useState<MasterProduct[]>([])

  // Selection state
  const [selectedProduct, setSelectedProduct] = useState<ProductWithMaster | null>(null)
  
  // Inline "Add New" form
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [inlineFormData, setInlineFormData] = useState<{
    name: string
    sku: string
    selling_price: number | undefined
    hsn_sac_code: string
    unit: string
  }>({
    name: '',
    sku: '',
    selling_price: undefined,
    hsn_sac_code: '',
    unit: 'pcs',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  
  // Computed: is the form data valid for product creation?
  const isFormDataValid = useMemo(() => {
    // Name is mandatory (min 2 chars)
    if (!inlineFormData.name || inlineFormData.name.trim().length < 2) return false
    
    // SKU is mandatory
    if (!inlineFormData.sku || !inlineFormData.sku.trim()) return false
    
    // Selling price should be positive if provided
    if (inlineFormData.selling_price !== undefined && inlineFormData.selling_price <= 0) return false
    
    return true
  }, [inlineFormData])
  
  // Enhanced search handler (searches both org products AND master catalog)
  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([])
      setMasterResults([])
      return
    }
    
    setIsSearching(true)
    try {
      // Search org products and master catalog in parallel
      const [orgProductsResult, masterProductsResult] = await Promise.all([
        getProducts(orgId, { 
          status: 'active',
          search: query.trim() 
        }, { 
          page: 1, 
          pageSize: 10 
        }),
        searchMasterProducts({
          q: query.trim(),
          limit: 5, // Limit master results to avoid overwhelming the dropdown
        }),
      ])
      
      setSearchResults(orgProductsResult.data as ProductWithMaster[])
      setMasterResults(masterProductsResult)
    } catch (error) {
      console.error('Error searching products:', error)
      setSearchResults([])
      setMasterResults([])
    } finally {
      setIsSearching(false)
    }
  }, [orgId])
  
  // Auto-search when searchTerm changes (caller should debounce setSearchTerm)
  const handleProductSelected = useCallback((product: ProductWithMaster) => {
    setSelectedProduct(product)
    setSearchTerm(product.name)
    setShowAddNewForm(false)
    onProductSelectedRef.current?.(product)
  }, [])
  
  const handleOpenAddNewForm = useCallback(() => {
    setShowAddNewForm(true)
    // Pre-fill name from searchTerm if available
    if (searchTerm.trim()) {
      setInlineFormData(prev => ({
        ...prev,
        name: searchTerm.trim(),
      }))
    }
  }, [searchTerm])
  
  const handleCloseAddNewForm = useCallback(() => {
    setShowAddNewForm(false)
    setInlineFormData({
      name: '',
      sku: '',
      selling_price: undefined,
      hsn_sac_code: '',
      unit: 'pcs',
    })
    setFormErrors({})
  }, [])
  
  const handleFormDataChange = useCallback((data: Partial<UseProductSelectionReturn['inlineFormData']>) => {
    setInlineFormData(prev => ({ ...prev, ...data }))
    
    // Clear errors when user starts typing
    const newErrors = { ...formErrors }
    if (data.name !== undefined && formErrors.name) delete newErrors.name
    if (data.sku !== undefined && formErrors.sku) delete newErrors.sku
    if (data.selling_price !== undefined && formErrors.selling_price) delete newErrors.selling_price
    setFormErrors(newErrors)
  }, [formErrors])
  
  const handleCreateProduct = useCallback(async () => {
    const errors: Record<string, string> = {}
    
    // Validation
    if (!inlineFormData.name || inlineFormData.name.trim().length < 2) {
      errors.name = 'Product name is required (min 2 chars)'
    }
    
    if (!inlineFormData.sku || !inlineFormData.sku.trim()) {
      errors.sku = 'SKU is required'
    }
    
    if (inlineFormData.selling_price !== undefined && inlineFormData.selling_price <= 0) {
      errors.selling_price = 'Selling price must be greater than 0'
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    setIsSearching(true)
    setFormErrors({})
    
    try {
      // Check for duplicate SKU before creating
      const existingProducts = await getProducts(orgId, {
        status: 'active',
        search: inlineFormData.sku
      }, { page: 1, pageSize: 10 })
      
      const exactMatch = existingProducts.data.find(p => 
        p.sku.toLowerCase() === inlineFormData.sku.toLowerCase()
      )
      
      if (exactMatch) {
        // Silently reuse existing product
        const productWithMaster = exactMatch as ProductWithMaster
        setSelectedProduct(productWithMaster)
        setSearchTerm(productWithMaster.name)
        setShowAddNewForm(false)
        onProductCreatedRef.current?.(productWithMaster)
        onProductSelectedRef.current?.(productWithMaster)
        setIsSearching(false)
        return
      }

      // Create new product
      await createProductMutation.mutateAsync({
        orgId,
        data: {
          name: inlineFormData.name.trim(),
          sku: inlineFormData.sku.trim(),
          selling_price: inlineFormData.selling_price,
          hsn_sac_code: inlineFormData.hsn_sac_code || null,
          unit: inlineFormData.unit || 'pcs',
        },
      })

      // Fetch the newly created product to get complete data
      const newProducts = await getProducts(orgId, {
        status: 'active',
        search: inlineFormData.sku
      }, { page: 1, pageSize: 1 })

      if (newProducts.data.length > 0) {
        const newProduct = newProducts.data[0] as ProductWithMaster
        setSelectedProduct(newProduct)
        setSearchTerm(newProduct.name)
        setShowAddNewForm(false)
        onProductCreatedRef.current?.(newProduct)
        onProductSelectedRef.current?.(newProduct)
      }
    } catch (error) {
      console.error('Error creating product:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create product'
      setFormErrors({
        submit: errorMessage,
      })
      onErrorRef.current(errorMessage)
    } finally {
      setIsSearching(false)
    }
  }, [orgId, inlineFormData, createProductMutation])
  
  // NEW: Link a master product (creates org product linked to master)
  const handleLinkMasterProduct = useCallback(async (masterProduct: MasterProduct) => {
    setIsSearching(true)
    try {
      // Create org product linked to this master product
      await createProductMutation.mutateAsync({
        orgId,
        data: {
          name: masterProduct.name || '',
          sku: masterProduct.sku || '',
          selling_price: masterProduct.base_price || undefined,
          hsn_sac_code: masterProduct.hsn_code || undefined,
          unit: masterProduct.base_unit || undefined,
          tax_rate: masterProduct.gst_rate || undefined,
          // Note: The backend should set master_product_id automatically based on SKU matching
        },
      })

      // Fetch the newly created product
      const newProducts = await getProducts(orgId, {
        status: 'active',
        search: masterProduct.sku || ''
      }, { page: 1, pageSize: 1 })

      if (newProducts.data.length > 0) {
        const newProduct = newProducts.data[0] as ProductWithMaster
        setSelectedProduct(newProduct)
        setSearchTerm(newProduct.name)
        setShowAddNewForm(false)
        onProductCreatedRef.current?.(newProduct)
        onProductSelectedRef.current?.(newProduct)
      }
    } catch (error) {
      console.error('Error linking master product:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to link master product'
      onErrorRef.current(errorMessage)
    } finally {
      setIsSearching(false)
    }
  }, [orgId, createProductMutation])
  
  const resetSelection = useCallback(() => {
    setSearchTerm('')
    setSelectedProduct(null)
    setSearchResults([])
    setMasterResults([])
    setShowAddNewForm(false)
    setInlineFormData({
      name: '',
      sku: '',
      selling_price: undefined,
      hsn_sac_code: '',
      unit: 'pcs',
    })
    setFormErrors({})
  }, [])
  
  // Stable setSearchTerm callback that triggers search
  const handleSetSearchTerm = useCallback((value: string) => {
    setSearchTerm(value)
    // Trigger search (caller should debounce this)
    handleSearch(value)
  }, [handleSearch])
  
  // Auto-trigger search when searchTerm changes (with external debounce)
  // Note: This effect is intentionally not included - caller should manually call handleSearch
  // or implement debouncing externally
  
  return {
    // Search state
    searchTerm,
    setSearchTerm: handleSetSearchTerm,
    isSearching,
    searchResults,
    masterResults, // NEW: expose master results
    
    // Selection state
    selectedProduct,
    setSelectedProduct,
    
    // Inline "Add New" form
    showAddNewForm,
    inlineFormData,
    formErrors,
    
    // Computed
    isFormDataValid,
    
    // Actions
    handleProductSelected,
    handleOpenAddNewForm,
    handleCloseAddNewForm,
    handleFormDataChange,
    handleCreateProduct,
    handleLinkMasterProduct, // NEW: expose link function
    resetSelection,
  }
}
