import { useState, useEffect, useMemo } from 'react'
import type { CustomerWithMaster } from '../../types'
import { useAddOrgCustomer, useCustomerById, useUpdateOrgCustomer } from '../../hooks/useCustomers'
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
  const updateCustomerMutation = useUpdateOrgCustomer(orgId)
  const [newlyCreatedCustomerId, setNewlyCreatedCustomerId] = useState<string | null>(null)
  const { data: fetchedCustomer } = useCustomerById(newlyCreatedCustomerId)
  
  // State
  const [identifier, setIdentifier] = useState('')
  const [identifierValid, setIdentifierValid] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMaster | null>(null)
  
  // Inline form data - always active now
  const [inlineFormData, setInlineFormData] = useState<{ name: string; mobile: string; gstin: string }>({
    name: '',
    mobile: '',
    gstin: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Detect identifier type from LIVE identifier
  const detectedType = useMemo<EnhancedIdentifierType>(() => {
    return detectIdentifierTypeEnhanced(identifier)
  }, [identifier])

  // Determine field rendering priority based on detected type
  const fieldPriority = useMemo<FieldPriority>(() => {
    if (detectedType === 'gstin' || detectedType === 'partial_gstin') return 'gstin'
    if (detectedType === 'mobile') return 'mobile'
    return 'name'
  }, [detectedType])

  // Sync inlineFormData with identifier (when no customer selected)
  // This ensures the search box value is reflected in the appropriate field
  useEffect(() => {
    if (!selectedCustomer) {
      if (detectedType === 'mobile') {
        setInlineFormData(prev => ({ ...prev, mobile: identifier, name: '', gstin: '' }))
      } else if (detectedType === 'gstin' || detectedType === 'partial_gstin') {
        setInlineFormData(prev => ({ ...prev, gstin: identifier.toUpperCase(), mobile: '', name: '' }))
      } else {
        setInlineFormData(prev => ({ ...prev, name: identifier, mobile: '', gstin: '' }))
      }
    }
  }, [identifier, detectedType, selectedCustomer])

  // When customer is fetched after creation, update state
  useEffect(() => {
    if (fetchedCustomer) {
      setSelectedCustomer(fetchedCustomer)
      setIdentifier(fetchedCustomer.alias_name || fetchedCustomer.name || fetchedCustomer.master_customer.legal_name)
      
      setInlineFormData({
        name: fetchedCustomer.alias_name || fetchedCustomer.master_customer.legal_name,
        mobile: fetchedCustomer.master_customer.mobile || '',
        gstin: fetchedCustomer.master_customer.gstin || ''
      })
      
      onCustomerCreated?.(fetchedCustomer)
      setNewlyCreatedCustomerId(null) // Reset after successful load
    }
  }, [fetchedCustomer, onCustomerCreated])

  // Reset selectedCustomer when identifier changes (user types new search)
  // Note: We need to be careful not to reset when we programmatically set identifier
  // But since we use the search box as the input, typing SHOULD reset selection.
  useEffect(() => {
    // If we have a selected customer, but the identifier doesn't match their name/alias,
    // it means user is typing something new.
    if (selectedCustomer) {
        const currentName = selectedCustomer.alias_name || selectedCustomer.master_customer.legal_name
        if (identifier !== currentName) {
            setSelectedCustomer(null)
        }
    }
  }, [identifier, selectedCustomer])

  // Handlers

  // Handlers

  const handleCustomerSelected = (customer: CustomerWithMaster | null) => {
    setSelectedCustomer(customer)
    if (customer) {
        setInlineFormData({
            name: customer.alias_name || customer.master_customer.legal_name,
            mobile: customer.master_customer.mobile || '',
            gstin: customer.master_customer.gstin || ''
        })
        // Update identifier to show selected customer name
        setIdentifier(customer.alias_name || customer.master_customer.legal_name)
    }
  }

  // Deprecated - No-ops
  const handleOpenAddNewForm = () => {}
  const handleCloseAddNewForm = () => {}

  const handleFormDataChange = (data: { name: string; mobile: string; gstin: string }) => {
    setInlineFormData(data)
    
    // Clear errors when user starts typing
    const newErrors = { ...errors }
    if (data.mobile !== inlineFormData.mobile && errors.mobile) delete newErrors.mobile
    if (data.gstin !== inlineFormData.gstin && errors.gstin) delete newErrors.gstin
    if (data.name !== inlineFormData.name && errors.name) delete newErrors.name
    setErrors(newErrors)
  }

  // Field validation handler (onBlur validation)
  const handleValidateField = (field: 'mobile' | 'gstin', value: string) => {
    const newErrors = { ...errors }
    if (field === 'mobile') {
      if (value && !validateMobile(value)) newErrors.mobile = 'Mobile must be 10 digits starting with 6-9'
      else delete newErrors.mobile
    }
    if (field === 'gstin') {
      if (value && !validateGSTIN(value)) newErrors.gstin = 'Invalid GSTIN format (15 characters)'
      else delete newErrors.gstin
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

    // DUPLICATE CHECK: Prevent creating same customer multiple times (ONLY FOR NEW CUSTOMERS)
    if (!selectedCustomer && (inlineFormData.mobile || inlineFormData.gstin)) {
      try {
        const searchQuery = inlineFormData.mobile || inlineFormData.gstin || ''
        const existingCustomers = await import('../../lib/api/customers')
          .then(m => m.searchCustomersByPartialIdentifier(orgId, searchQuery))
        
        // Check if exact match exists
        const exactMatch = existingCustomers.find(c => {
          if (inlineFormData.mobile && c.master_customer.mobile === inlineFormData.mobile) return true
          if (inlineFormData.gstin && c.master_customer.gstin === inlineFormData.gstin) return true
          return false
        })

        if (exactMatch) {
          const duplicateField = inlineFormData.mobile ? 'Mobile' : 'GSTIN'
          const duplicateValue = inlineFormData.mobile || inlineFormData.gstin
          formErrors.submit = `Customer with ${duplicateField} "${duplicateValue}" already exists. Please search and select from dropdown.`
          setErrors(formErrors)
          return
        }
      } catch (error) {
        console.warn('Duplicate check failed, proceeding with creation:', error)
      }
    }

    setSearching(true)
    setErrors({})

    try {
      if (selectedCustomer) {
          // Update existing customer
          await updateCustomerMutation.mutateAsync({
              customerId: selectedCustomer.id,
              data: {
                  alias_name: inlineFormData.name,
              }
          })
          onCustomerCreated?.(selectedCustomer)
      } else {
          // Create new customer
          const customerId = await addCustomerMutation.mutateAsync({
            name: inlineFormData.name,
            mobile: inlineFormData.mobile || null,
            gstin: inlineFormData.gstin || null,
          })
          setNewlyCreatedCustomerId(customerId)
      }
    } catch (error) {
      console.error('Error saving customer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save customer'
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
    setInlineFormData({ name: '', mobile: '', gstin: '' })
    setErrors({})
  }

  return {
    identifier,
    identifierValid,
    searching,
    selectedCustomer,
    showAddNewForm: false, // Deprecated
    inlineFormData,
    errors,
    detectedType,
    fieldPriority,
    gstinRequired: false, // Deprecated
    mobileRequired: false, // Deprecated
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
