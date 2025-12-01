import { useState, useEffect, useMemo } from 'react'
import type { CustomerWithMaster } from '../../types'
import { useAddOrgCustomer, useCustomerById } from '../../hooks/useCustomers'
import { detectIdentifierTypeEnhanced, type EnhancedIdentifierType } from '../../lib/utils/identifierValidation'
import { validateMobile, validateGSTIN } from '../../lib/utils/identifierValidation'

/**
 * Hook inputs
 */
export interface UseInvoiceCustomerProps {
  orgId: string
  onError: (message: string) => void
  onCustomerCreated?: (customer: CustomerWithMaster) => void
}

/**
 * Field priority for dynamic form rendering
 */
export type FieldPriority = 'gstin' | 'mobile' | 'name'

/**
 * Hook outputs
 */
export interface UseInvoiceCustomerReturn {
  // State
  identifier: string
  identifierValid: boolean
  searching: boolean
  selectedCustomer: CustomerWithMaster | null
  showAddNewForm: boolean
  inlineFormData: { name: string; mobile: string; gstin: string }
  errors: {
    identifier?: string
    name?: string
    mobile?: string
    gstin?: string
    submit?: string
  }
  
  // Metadata for smart form rendering
  detectedType: EnhancedIdentifierType
  fieldPriority: FieldPriority
  gstinRequired: boolean
  mobileRequired: boolean
  
  // Setters
  setIdentifier: (value: string) => void
  setIdentifierValid: (valid: boolean) => void
  setSearching: (searching: boolean) => void
  setSelectedCustomer: (customer: CustomerWithMaster | null) => void // Exposed for draft restore
  
  // Actions
  handleCustomerSelected: (customer: CustomerWithMaster | null) => void
  handleOpenAddNewForm: () => void
  handleCloseAddNewForm: () => void
  handleFormDataChange: (data: { name: string; mobile: string; gstin: string }) => void
  handleCreateOrgCustomer: () => Promise<void>
  handleValidateField: (field: 'mobile' | 'gstin', value: string) => void
  resetCustomer: () => void
}

/**
 * useInvoiceCustomer
 * 
 * Manages customer selection, search, and inline creation for invoices.
 */
export function useInvoiceCustomer({
  orgId,
  onError,
  onCustomerCreated,
}: UseInvoiceCustomerProps): UseInvoiceCustomerReturn {
  
  // Hooks for customer mutations/queries
  const addCustomerMutation = useAddOrgCustomer(orgId)
  const [newlyCreatedCustomerId, setNewlyCreatedCustomerId] = useState<string | null>(null)
  const { data: fetchedCustomer } = useCustomerById(newlyCreatedCustomerId)
  
  // State
  const [identifier, setIdentifier] = useState('')
  const [identifierValid, setIdentifierValid] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMaster | null>(null)
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [searchedIdentifier, setSearchedIdentifier] = useState('') // Snapshot of identifier when "Add New" clicked
  const [inlineFormData, setInlineFormData] = useState<{ name: string; mobile: string; gstin: string }>({
    name: '',
    mobile: '',
    gstin: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Detect identifier type from search input (snapshot when form opens)
  const detectedType = useMemo<EnhancedIdentifierType>(() => {
    if (!showAddNewForm || !searchedIdentifier) return 'text'
    return detectIdentifierTypeEnhanced(searchedIdentifier)
  }, [showAddNewForm, searchedIdentifier])

  // Determine field rendering priority based on detected type
  const fieldPriority = useMemo<FieldPriority>(() => {
    if (detectedType === 'gstin' || detectedType === 'partial_gstin') return 'gstin'
    if (detectedType === 'mobile') return 'mobile'
    return 'name'
  }, [detectedType])

  // GSTIN and Mobile are always optional now
  // Name is the only mandatory field
  const gstinRequired = false
  const mobileRequired = false

  // When customer is fetched after creation, update state
  useEffect(() => {
    if (fetchedCustomer) {
      setSelectedCustomer(fetchedCustomer)
      setIdentifier(fetchedCustomer.alias_name || fetchedCustomer.name || fetchedCustomer.master_customer.legal_name)
      setShowAddNewForm(false)
      setInlineFormData({ name: '', mobile: '', gstin: '' })
      setSearchedIdentifier('') // Reset snapshot
      onCustomerCreated?.(fetchedCustomer)
      setNewlyCreatedCustomerId(null) // Reset after successful load
    }
  }, [fetchedCustomer, onCustomerCreated])


  // Prefill inline form when opening (use enhanced detection)
  useEffect(() => {
    if (showAddNewForm) {
      const type = detectIdentifierTypeEnhanced(identifier)
      if (type === 'mobile') {
        setInlineFormData({ name: '', mobile: identifier, gstin: '' })
      } else if (type === 'gstin' || type === 'partial_gstin') {
        setInlineFormData({ name: '', mobile: '', gstin: identifier.toUpperCase() })
      } else {
        setInlineFormData({ name: identifier, mobile: '', gstin: '' })
      }
    }
  }, [showAddNewForm, identifier])

  // Reset selectedCustomer when identifier changes
  useEffect(() => {
    if (identifier.trim() === '' || !identifierValid) {
      setSelectedCustomer(null)
    }
  }, [identifier, identifierValid])

  // Handlers

  const handleCustomerSelected = (customer: CustomerWithMaster | null) => {
    setSelectedCustomer(customer)
  }

  const handleOpenAddNewForm = () => {
    if (identifier.trim().length >= 3) {
      setSearchedIdentifier(identifier) // Snapshot identifier at time of "Add New" click
      setShowAddNewForm(true)
    }
  }

  const handleCloseAddNewForm = () => {
    setShowAddNewForm(false)
    setInlineFormData({ name: '', mobile: '', gstin: '' })
    setSearchedIdentifier('')
    setErrors({})
  }

  const handleFormDataChange = (data: { name: string; mobile: string; gstin: string }) => {
    setInlineFormData(data)
    
    // Clear errors when user starts typing
    const newErrors = { ...errors }
    
    // Clear mobile error if user is typing in mobile field
    if (data.mobile !== inlineFormData.mobile && errors.mobile) {
      delete newErrors.mobile
    }
    
    // Clear gstin error if user is typing in gstin field
    if (data.gstin !== inlineFormData.gstin && errors.gstin) {
      delete newErrors.gstin
    }
    
    // Clear name error if user is typing in name field
    if (data.name !== inlineFormData.name && errors.name) {
      delete newErrors.name
    }
    
    setErrors(newErrors)
  }

  // Field validation handler (onBlur validation)
  const handleValidateField = (field: 'mobile' | 'gstin', value: string) => {
    const newErrors = { ...errors }
    
    if (field === 'mobile') {
      if (value && !validateMobile(value)) {
        newErrors.mobile = 'Mobile must be 10 digits starting with 6-9'
      } else {
        delete newErrors.mobile
      }
    }
    
    if (field === 'gstin') {
      if (value && !validateGSTIN(value)) {
        newErrors.gstin = 'Invalid GSTIN format (15 characters)'
      } else {
        delete newErrors.gstin
      }
    }
    
    setErrors(newErrors)
  }

  const handleCreateOrgCustomer = async () => {
    const formErrors: Record<string, string> = {}

    // Name is ALWAYS mandatory
    if (!inlineFormData.name || inlineFormData.name.trim().length < 2) {
      formErrors.name = 'Customer name is required (min 2 chars)'
    }

    // Mobile is optional - only validate if entered
    if (inlineFormData.mobile && !validateMobile(inlineFormData.mobile)) {
      formErrors.mobile = 'Mobile must be 10 digits starting with 6-9'
    }

    // GSTIN is optional - only validate if entered
    if (inlineFormData.gstin && !validateGSTIN(inlineFormData.gstin)) {
      formErrors.gstin = 'Invalid GSTIN format (15 characters)'
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setSearching(true)
    setErrors({})

    try {
      const customerId = await addCustomerMutation.mutateAsync({
        name: inlineFormData.name,
        mobile: inlineFormData.mobile || null,
        gstin: inlineFormData.gstin || null,
      })

      // Trigger customer fetch by setting ID
      setNewlyCreatedCustomerId(customerId)
      // Note: useEffect will handle setting selectedCustomer when fetchedCustomer updates
    } catch (error) {
      console.error('Error adding customer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to add customer'
      setErrors({
        submit: errorMessage,
      })
      onError(errorMessage)
    } finally {
      setSearching(false)
    }
  }

  const resetCustomer = () => {
    setIdentifier('')
    setIdentifierValid(false)
    setSelectedCustomer(null)
    setShowAddNewForm(false)
    setInlineFormData({ name: '', mobile: '', gstin: '' })
    setSearchedIdentifier('')
    setErrors({})
  }

  return {
    identifier,
    identifierValid,
    searching,
    selectedCustomer,
    showAddNewForm,
    inlineFormData,
    errors,
    detectedType,
    fieldPriority,
    gstinRequired,
    mobileRequired,
    setIdentifier,
    setIdentifierValid,
    setSearching,
    setSelectedCustomer,
    handleCustomerSelected,
    handleOpenAddNewForm,
    handleCloseAddNewForm,
    handleFormDataChange,
    handleCreateOrgCustomer,
    handleValidateField,
    resetCustomer,
  }
}
