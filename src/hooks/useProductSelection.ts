import { useState, useCallback, useMemo } from 'react'
import type { ProductWithMaster } from '../types'
import { useCreateProduct } from './useProducts'
import { getProducts } from '../lib/api/products'

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
  
  // Hooks for product mutations
  const createProductMutation = useCreateProduct()
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ProductWithMaster[]>([])
  
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
  
  // Debounced search handler (caller should debounce)
  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    try {
      const result = await getProducts(orgId, { 
        status: 'active',
        search: query.trim() 
      }, { 
        page: 1, 
        pageSize: 10 
      })
      setSearchResults(result.data as ProductWithMaster[])
    } catch (error) {
      console.error('Error searching products:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [orgId])
  
  // Auto-search when searchTerm changes (caller should debounce setSearchTerm)
  const handleProductSelected = useCallback((product: ProductWithMaster) => {
    setSelectedProduct(product)
    setSearchTerm(product.name)
    setShowAddNewForm(false)
    onProductSelected?.(product)
  }, [onProductSelected])
  
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
        onProductCreated?.(productWithMaster)
        onProductSelected?.(productWithMaster)
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
        onProductCreated?.(newProduct)
        onProductSelected?.(newProduct)
      }
    } catch (error) {
      console.error('Error creating product:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create product'
      setFormErrors({
        submit: errorMessage,
      })
      onError(errorMessage)
    } finally {
      setIsSearching(false)
    }
  }, [orgId, inlineFormData, createProductMutation, onError, onProductCreated, onProductSelected])
  
  const resetSelection = useCallback(() => {
    setSearchTerm('')
    setSelectedProduct(null)
    setSearchResults([])
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
  
  // Auto-trigger search when searchTerm changes (with external debounce)
  // Note: This effect is intentionally not included - caller should manually call handleSearch
  // or implement debouncing externally
  
  return {
    // Search state
    searchTerm,
    setSearchTerm: (value: string) => {
      setSearchTerm(value)
      // Trigger search (caller should debounce this)
      handleSearch(value)
    },
    isSearching,
    searchResults,
    
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
    resetSelection,
  }
}
