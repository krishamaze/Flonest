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
  
  // Computed validation data (merges identifier + form fields)
  completeCustomerData: { name: string; mobile: string; gstin: string }
  isCustomerDataComplete: boolean
  
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
  
  // Compute complete customer data by merging identifier with form fields
  // This is the ACTUAL data that will be used for customer creation
  const completeCustomerData = useMemo(() => {
    const data = { ...inlineFormData }
    const trimmedIdentifier = identifier.trim()
    
    // Override with identifier value based on detected type
    if (detectedType === 'mobile') {
      data.mobile = trimmedIdentifier
    } else if (detectedType === 'gstin' || detectedType === 'partial_gstin') {
      data.gstin = trimmedIdentifier.toUpperCase()
    } else if (detectedType === 'name' || detectedType === 'unknown') {
      // For name mode, identifier becomes the name (unless form has name already)
      if (!data.name || trimmedIdentifier.length >= data.name.length) {
        data.name = trimmedIdentifier
      }
    }
    
    return data
  }, [identifier, inlineFormData, detectedType])

  // Validation state: is the complete customer data valid and ready for creation?
  const isCustomerDataComplete = useMemo(() => {
    // Name is mandatory (min 3 chars)
    if (completeCustomerData.name.trim().length < 3) return false
    
    // At least one contact method required
    if (!completeCustomerData.mobile.trim() && !completeCustomerData.gstin.trim()) return false
    
    // If mobile provided, must be valid
    if (completeCustomerData.mobile && !validateMobile(completeCustomerData.mobile)) return false
    
    // If GSTIN provided, must be valid
    if (completeCustomerData.gstin && !validateGSTIN(completeCustomerData.gstin)) return false
    
    return true
  }, [completeCustomerData])

  // NOTE: identifier is NOT auto-synced to inlineFormData
  // The combobox (identifier) is the source of truth for ONE field (mobile/GSTIN/name)
  // The form fields (inlineFormData) hold the OTHER complementary fields

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

  // Customer reset is now handled by the search combobox onChange
  // No automatic reset needed here to avoid double-click issues

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
        // Don't update identifier - search box shows what user typed, name field shows actual customer name
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

    // Build complete customer data by merging identifier with form fields
    const completeData = {
      name: inlineFormData.name,
      mobile: inlineFormData.mobile,
      gstin: inlineFormData.gstin,
    }

    // Override with identifier value based on detected type
    const trimmedIdentifier = identifier.trim()
    if (detectedType === 'mobile') {
      completeData.mobile = trimmedIdentifier
    } else if (detectedType === 'gstin' || detectedType === 'partial_gstin') {
      completeData.gstin = trimmedIdentifier.toUpperCase()
    } else {
      // name or unknown
      completeData.name = trimmedIdentifier
    }

    // Name is ALWAYS mandatory (min 3 chars for quality)
    if (!completeData.name || completeData.name.trim().length < 3) {
      formErrors.name = 'Customer name is required (min 3 chars)'
    }

    // Require at least one contact method for business records (mobile or GSTIN)
    if (!completeData.mobile && !completeData.gstin) {
      formErrors.submit = 'Please provide at least Mobile Number or GSTIN for the customer'
    }

    // Mobile is optional - only validate if entered
    if (completeData.mobile && !validateMobile(completeData.mobile)) {
      formErrors.mobile = 'Mobile must be 10 digits starting with 6-9'
    }

    // GSTIN is optional - only validate if entered
    if (completeData.gstin && !validateGSTIN(completeData.gstin)) {
      formErrors.gstin = 'Invalid GSTIN format (15 characters)'
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    // DUPLICATE CHECK: Silently reuse existing customer on match (ONLY FOR NEW CUSTOMERS)
    if (!selectedCustomer && (completeData.mobile || completeData.gstin)) {
      try {
        const searchQuery = completeData.mobile || completeData.gstin || ''
        const existingCustomers = await import('../../lib/api/customers')
          .then(m => m.searchCustomersByPartialIdentifier(orgId, searchQuery))
        
        // Check if exact match exists
        const exactMatch = existingCustomers.find(c => {
          if (completeData.mobile && c.master_customer.mobile === completeData.mobile) return true
          if (completeData.gstin && c.master_customer.gstin === completeData.gstin) return true
          return false
        })

        if (exactMatch) {
          // Silently reuse existing customer instead of showing error
          setSelectedCustomer(exactMatch)
          setIdentifier(exactMatch.alias_name || exactMatch.master_customer.legal_name)
          setInlineFormData({
            name: exactMatch.alias_name || exactMatch.master_customer.legal_name,
            mobile: exactMatch.master_customer.mobile || '',
            gstin: exactMatch.master_customer.gstin || ''
          })
          onCustomerCreated?.(exactMatch)
          setSearching(false)
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
                  alias_name: completeData.name,
              }
          })
          onCustomerCreated?.(selectedCustomer)
      } else {
          // Create new customer with merged data
          const customerId = await addCustomerMutation.mutateAsync({
            name: completeData.name,
            mobile: completeData.mobile || null,
            gstin: completeData.gstin || null,
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
    completeCustomerData,
    isCustomerDataComplete,
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
