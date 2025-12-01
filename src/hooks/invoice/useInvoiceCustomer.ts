import { useState, useEffect } from 'react'
import type { CustomerWithMaster } from '../../types'
import { useAddOrgCustomer, useCustomerById } from '../../hooks/useCustomers'
import { detectIdentifierType } from '../../lib/utils/identifierValidation'
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
  const [inlineFormData, setInlineFormData] = useState<{ name: string; mobile: string; gstin: string }>({
    name: '',
    mobile: '',
    gstin: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // When customer is fetched after creation, update state
  useEffect(() => {
    if (fetchedCustomer) {
      setSelectedCustomer(fetchedCustomer)
      setIdentifier(fetchedCustomer.alias_name || fetchedCustomer.name || fetchedCustomer.master_customer.legal_name)
      setShowAddNewForm(false)
      setInlineFormData({ name: '', mobile: '', gstin: '' })
      onCustomerCreated?.(fetchedCustomer)
      setNewlyCreatedCustomerId(null) // Reset after successful load
    }
  }, [fetchedCustomer, onCustomerCreated])


  // Prefill inline form when opening
  useEffect(() => {
    if (showAddNewForm) {
      const type = detectIdentifierType(identifier)
      if (type === 'mobile') {
        setInlineFormData({ name: '', mobile: identifier, gstin: '' })
      } else if (type === 'gstin') {
        setInlineFormData({ name: '', mobile: '', gstin: identifier })
      } else {
        setInlineFormData({ name: identifier, mobile: '', gstin: '' })
      }
    }
  }, [showAddNewForm]) // Intentionally omit identifier to avoid overwriting user edits

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
      setShowAddNewForm(true)
    }
  }

  const handleCloseAddNewForm = () => {
    setShowAddNewForm(false)
    setInlineFormData({ name: '', mobile: '', gstin: '' })
    setErrors({})
  }

  const handleFormDataChange = (data: { name: string; mobile: string; gstin: string }) => {
    setInlineFormData(data)
  }

  const handleCreateOrgCustomer = async () => {
    const formErrors: Record<string, string> = {}

    if (!inlineFormData.name || inlineFormData.name.trim().length < 2) {
      formErrors.name = 'Customer name is required (min 2 chars)'
    }

    if (inlineFormData.mobile && !validateMobile(inlineFormData.mobile)) {
      formErrors.mobile = 'Mobile must be 10 digits'
    }

    if (inlineFormData.gstin && !validateGSTIN(inlineFormData.gstin)) {
      formErrors.gstin = 'Invalid GSTIN format'
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
    setIdentifier,
    setIdentifierValid,
    setSearching,
    setSelectedCustomer,
    handleCustomerSelected,
    handleOpenAddNewForm,
    handleCloseAddNewForm,
    handleFormDataChange,
    handleCreateOrgCustomer,
    resetCustomer,
  }
}
