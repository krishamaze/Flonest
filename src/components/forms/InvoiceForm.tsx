import { useState, FormEvent, useEffect, useMemo, useRef, useCallback } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { isMobileDevice } from '../../lib/deviceDetection'
import { IdentifierInput } from '../customers/IdentifierInput'
import { CustomerResultCard } from '../customers/CustomerResultCard'
import { Card, CardContent } from '../ui/Card'
import { ProductSearchCombobox } from '../invoice/ProductSearchCombobox'
import { ProductConfirmSheet } from '../invoice/ProductConfirmSheet'
import { CameraScanner } from '../invoice/CameraScanner'
import type { InvoiceFormData, InvoiceItemFormData, CustomerWithMaster, Org, ProductWithMaster, ScanResult } from '../../types'
import { lookupOrCreateCustomer, checkCustomerExists, searchCustomersByIdentifier } from '../../lib/api/customers'
import { getAllProducts } from '../../lib/api/products'
import { createInvoice, autoSaveInvoiceDraft, validateInvoiceItems, getDraftInvoiceByCustomer, loadDraftInvoiceData, revalidateDraftInvoice, getInvoiceById, clearDraftSessionId } from '../../lib/api/invoices'
import { checkSerialStatus } from '../../lib/api/serials'
import { validateScannerCodes } from '../../lib/api/scanner'
import { calculateItemGST, extractStateCodeFromGSTIN, getCustomerStateCode } from '../../lib/utils/gstCalculation'
import { isOrgGstEnabled } from '../../lib/utils/orgGst'
import { useAutoSave } from '../../hooks/useAutoSave'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, XCircleIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import type { IdentifierType } from '../../lib/utils/identifierValidation'
import { detectIdentifierType, validateMobile, validateGSTIN, normalizeIdentifier } from '../../lib/utils/identifierValidation'
import { Toast } from '../ui/Toast'
import { toast } from 'react-toastify'
import { getDraftSessionId, setDraftSessionId } from '../../lib/utils/draftSession'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface InvoiceFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (invoiceId: string) => Promise<void>
  orgId: string
  userId: string
  org: Org
  title?: string
  draftInvoiceId?: string
}

type Step = 1 | 2 | 3 | 4

export function InvoiceForm({
  isOpen,
  onClose,
  onSubmit,
  orgId,
  userId,
  org,
  title,
  draftInvoiceId,
}: InvoiceFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [identifier, setIdentifier] = useState('')
  const [identifierValid, setIdentifierValid] = useState(false)
  const [identifierType, setIdentifierType] = useState<IdentifierType>('invalid')
  const [searching, setSearching] = useState(false)
  const [lookupPerformed, setLookupPerformed] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMaster | null>(null)
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [masterFormData, setMasterFormData] = useState<{ customer_name: string; address: string; email: string; additionalIdentifier: string }>({
    customer_name: '',
    address: '',
    email: '',
    additionalIdentifier: '',
  })
  const [products, setProducts] = useState<ProductWithMaster[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [items, setItems] = useState<InvoiceItemFormData[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [internalDraftInvoiceId, setInternalDraftInvoiceId] = useState<string | null>(null)
  const [serialInputs, setSerialInputs] = useState<Record<number, string>>({})
  
  // Scanner and confirmation state
  type ScannerMode = 'closed' | 'scanning' | 'confirming'
  const [scannerMode, setScannerMode] = useState<ScannerMode>('closed')
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<ProductWithMaster | null>(null)
  const [pendingQuantity, setPendingQuantity] = useState(1)
  const [pendingSerial, setPendingSerial] = useState<string>('')
  
  // Draft loading state
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const draftLoadRetries = useRef(0)
  const MAX_RETRIES = 1
  
  // Draft session ID ref - persists across re-renders
  const draftSessionId = useRef<string | null>(null)
  
  // Use prop if provided, otherwise use internal state
  const currentDraftInvoiceId = draftInvoiceId || internalDraftInvoiceId

  // Load products when form opens
  useEffect(() => {
    if (isOpen && orgId) {
      setLoadingProducts(true)
      getAllProducts(orgId, { status: 'active' })
        .then((products) => setProducts(products as ProductWithMaster[]))
        .catch((error) => {
          console.error('Error loading products:', error)
        })
        .finally(() => setLoadingProducts(false))
    }
  }, [isOpen, orgId])

  // Initialize draft session ID when form opens
  useEffect(() => {
    if (isOpen) {
      if (draftInvoiceId) {
        // For existing drafts, get session ID from sessionStorage or create new one
        draftSessionId.current = getDraftSessionId(draftInvoiceId)
      } else {
        // For new drafts, create new session ID
        draftSessionId.current = getDraftSessionId()
      }
    }
  }, [isOpen, draftInvoiceId])

  // Helper function to classify errors as retry-able or permanent
  const isRetryableError = (error: any): boolean => {
    if (!error) return false
    
    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toLowerCase() || ''
    
    // Retry-able errors: network issues, RLS policy errors, timeouts
    const retryablePatterns = [
      'network',
      'timeout',
      'fetch',
      'rls',
      'row level security',
      'policy',
      'connection',
      'failed to fetch',
      'networkerror',
      'pgrst',
    ]
    
    // Permanent errors: not found, deleted, invalid
    const permanentPatterns = [
      'not found',
      'does not exist',
      'deleted',
      'invalid',
      'malformed',
      'unauthorized',
      'forbidden',
      'permission denied',
    ]
    
    // Check for permanent errors first
    if (permanentPatterns.some(pattern => errorMessage.includes(pattern) || errorCode.includes(pattern))) {
      return false
    }
    
    // Check for retry-able errors
    if (retryablePatterns.some(pattern => errorMessage.includes(pattern) || errorCode.includes(pattern))) {
      return true
    }
    
    // Default: retry on unknown errors (might be transient)
    return true
  }

  // Load draft with retry logic
  const loadDraftWithRetry = useCallback(async (invoiceId: string, retryCount = 0): Promise<void> => {
    try {
      setLoadingDraft(true)
      setDraftLoadError(null)
      setIsRetrying(retryCount > 0)
      
      const draftData = await loadDraftInvoiceData(invoiceId)
      
      if (draftData) {
        // Restore draft session ID from database
        if (draftData.draft_session_id) {
          draftSessionId.current = draftData.draft_session_id
          setDraftSessionId(invoiceId, draftData.draft_session_id)
        }
        
        // Load customer
        const draftInvoice = await getInvoiceById(invoiceId)
        if (draftInvoice.customer) {
          setSelectedCustomer(draftInvoice.customer as any)
        }
        
        // Load products and restore items
        const allProducts = await getAllProducts(orgId, { status: 'active' })
        const restoredItems: InvoiceItemFormData[] = draftData.items.map((draftItem: any) => {
          const product = allProducts.find((p: any) => p.id === draftItem.product_id)
          return {
            product_id: draftItem.product_id,
            quantity: draftItem.quantity || 0,
            unit_price: draftItem.unit_price || (product?.selling_price || 0),
            line_total: draftItem.line_total || (draftItem.quantity * (draftItem.unit_price || product?.selling_price || 0)),
            serials: draftItem.serials || [],
            serial_tracked: product?.serial_tracked || false,
            invalid_serials: draftItem.invalid_serials || [],
            validation_errors: draftItem.validation_errors || [],
            stock_available: draftItem.stock_available,
          }
        })
        setItems(restoredItems)
        setInternalDraftInvoiceId(invoiceId)
        setCurrentStep(2)
        
        // Reset retry counter on success
        draftLoadRetries.current = 0
        setIsRetrying(false)
        
        // Re-validate draft
        try {
          const revalidation = await revalidateDraftInvoice(invoiceId, orgId)
          if (revalidation.updated) {
            setToast({ 
              message: 'Draft revalidated — missing items are now available.', 
              type: 'success' 
            })
            if (revalidation.valid) {
              const cleanedItems = restoredItems.map(item => ({
                ...item,
                invalid_serials: [],
                validation_errors: [],
              }))
              setItems(cleanedItems)
            }
          }
        } catch (revalError) {
          console.error('Error re-validating draft:', revalError)
        }
      } else {
        // Draft data is null - permanent error
        throw new Error('Draft data not found')
      }
    } catch (error) {
      console.error('Error loading draft:', error)
      
      // Check if error is retry-able and we haven't exceeded max retries
      if (isRetryableError(error) && retryCount < MAX_RETRIES) {
        draftLoadRetries.current = retryCount + 1
        setIsRetrying(true)
        
        // Wait 500ms before retrying
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Retry
        return loadDraftWithRetry(invoiceId, retryCount + 1)
      } else {
        // Permanent error or max retries exceeded
        const errorMessage = error instanceof Error ? error.message : 'Failed to load draft invoice'
        setDraftLoadError(errorMessage)
        setIsRetrying(false)
        setToast({ 
          message: errorMessage, 
          type: 'error' 
        })
      }
    } finally {
      setLoadingDraft(false)
    }
  }, [orgId])

  // Load draft on mount if draftInvoiceId prop is provided
  useEffect(() => {
    if (isOpen && draftInvoiceId) {
      // Reset retry counter when opening draft
      draftLoadRetries.current = 0
      setDraftLoadError(null)
      setIsRetrying(false)
      
      // Load draft with retry
      loadDraftWithRetry(draftInvoiceId)
    }
  }, [isOpen, draftInvoiceId, loadDraftWithRetry])

  // Reset form when closed (but not if we're loading a draft)
  useEffect(() => {
    if (!isOpen && !loadingDraft) {
      // Don't clear session ID here - it should persist if form is reopened
      // Only clear on finalize or explicit delete
      setCurrentStep(1)
      setIdentifier('')
      setIdentifierValid(false)
      setIdentifierType('invalid')
      setLookupPerformed(false)
      setSelectedCustomer(null)
      setShowAddNewForm(false)
      setMasterFormData({ customer_name: '', address: '', email: '', additionalIdentifier: '' })
      setItems([])
      setErrors({})
      setInternalDraftInvoiceId(null)
      setDraftLoadError(null)
      setIsRetrying(false)
    }
  }, [isOpen, loadingDraft])

  // Reset selectedCustomer when identifier changes (ensures Next button stays disabled)
  useEffect(() => {
    if (identifier.trim() === '' || !identifierValid) {
      setSelectedCustomer(null)
      setLookupPerformed(false)
    }
  }, [identifier, identifierValid])

  // Step 1: Customer Selection
  const handleLookupCustomer = async () => {
    if (!identifierValid || !identifier.trim()) {
      setErrors({ identifier: 'Please enter a valid mobile number or GSTIN' })
      return
    }

    setSearching(true)
    setErrors({})
    setShowAddNewForm(false)
    setLookupPerformed(false)

    try {
      // First, check if org customer exists (master + org link)
      const orgCustomer = await searchCustomersByIdentifier(identifier, orgId)
      
      if (orgCustomer) {
        // Customer exists with org link - show details
        setSelectedCustomer(orgCustomer)
        
        // Check for existing draft for this customer
        try {
          const existingDraft = await getDraftInvoiceByCustomer(orgId, orgCustomer.id)
          if (existingDraft) {
            // Show confirmation dialog
            const continueDraft = window.confirm(
              'A draft invoice already exists for this customer. Continue?'
            )
            
            if (continueDraft) {
              // Load draft data
              const draftData = await loadDraftInvoiceData(existingDraft.id)
              if (draftData) {
                // Restore items from draft
                setInternalDraftInvoiceId(existingDraft.id)
                
                // Load products to restore full item data
                const allProducts = await getAllProducts(orgId, { status: 'active' })
                const restoredItems: InvoiceItemFormData[] = draftData.items.map((draftItem: any) => {
                  const product = allProducts.find((p: any) => p.id === draftItem.product_id)
                  return {
                    product_id: draftItem.product_id,
                    quantity: draftItem.quantity || 0,
                    unit_price: draftItem.unit_price || (product?.selling_price || 0),
                    line_total: draftItem.line_total || (draftItem.quantity * (draftItem.unit_price || product?.selling_price || 0)),
                    serials: draftItem.serials || [],
                    serial_tracked: product?.serial_tracked || false,
                    invalid_serials: draftItem.invalid_serials || [],
                    validation_errors: draftItem.validation_errors || [],
                    stock_available: draftItem.stock_available,
                  }
                })
                setItems(restoredItems)
                
                // Re-validate draft
                try {
                  const revalidation = await revalidateDraftInvoice(existingDraft.id, orgId)
                  if (revalidation.updated) {
                    setToast({ 
                      message: 'Draft revalidated — missing items are now available.', 
                      type: 'success' 
                    })
                    // Clear invalid serials/errors if now valid
                    if (revalidation.valid) {
                      const cleanedItems = restoredItems.map(item => ({
                        ...item,
                        invalid_serials: [],
                        validation_errors: [],
                      }))
                      setItems(cleanedItems)
                    }
                  }
                } catch (revalError) {
                  console.error('Error re-validating draft:', revalError)
                }
                
                setToast({ message: 'Draft loaded', type: 'success' })
                setCurrentStep(2)
                return
              }
            }
          }
        } catch (draftError) {
          console.error('Error checking for draft:', draftError)
          // Continue with normal flow if draft check fails
        }
        
        return
      }

      // Check if master customer exists (but no org link)
      const master = await checkCustomerExists(identifier)
      
      if (master) {
        // Master exists but no org link - create org link and show
        const result = await lookupOrCreateCustomer(identifier, orgId, userId)
        setSelectedCustomer({
          ...result.customer,
          master_customer: result.master,
        })
      } else {
        // Master doesn't exist - auto-open "Add New Customer" form
        setShowAddNewForm(true)
      }
    } catch (error) {
      console.error('Error looking up customer:', error)
      setErrors({
        identifier: error instanceof Error ? error.message : 'Failed to lookup customer',
      })
    } finally {
      setSearching(false)
      setLookupPerformed(true)
    }
  }

  const handleCreateMasterCustomer = async () => {
    // Validate form - all fields optional except: at least one identifier OR legal_name
    const formErrors: Record<string, string> = {}
    
    // Check if we have at least one identifier or legal_name
    const hasIdentifier = identifierValid && identifier.trim().length > 0
    const hasLegalName = masterFormData.customer_name.trim().length >= 2
    
    if (!hasIdentifier && !hasLegalName) {
      formErrors.customer_name = 'Please provide at least a customer name or valid mobile/GSTIN'
    }
    
    // Validate email format if provided
    if (masterFormData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterFormData.email.trim())) {
      formErrors.email = 'Please enter a valid email address'
    }

    // Validate additional identifier if provided
    if (masterFormData.additionalIdentifier.trim()) {
      const additionalType = identifierType === 'mobile' ? 'gstin' : 'mobile'
      const detected = detectIdentifierType(masterFormData.additionalIdentifier.trim())
      if (detected !== additionalType) {
        formErrors.additionalIdentifier = additionalType === 'mobile' 
          ? 'Please enter a valid 10-digit mobile number'
          : 'Please enter a valid 15-character GSTIN'
      } else {
        const isValid = additionalType === 'mobile' 
          ? validateMobile(masterFormData.additionalIdentifier.trim())
          : validateGSTIN(masterFormData.additionalIdentifier.trim())
        if (!isValid) {
          formErrors.additionalIdentifier = additionalType === 'mobile'
            ? 'Mobile must be exactly 10 digits starting with 6, 7, 8, or 9'
            : 'Invalid GSTIN format'
        }
      }
    }
    
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setSearching(true)
    setErrors({})

    try {
      const additionalNormalized = masterFormData.additionalIdentifier.trim()
        ? normalizeIdentifier(masterFormData.additionalIdentifier.trim(), identifierType === 'mobile' ? 'gstin' : 'mobile')
        : undefined

      const masterData: any = {
        legal_name: masterFormData.customer_name.trim() || 'Customer',
        address: masterFormData.address.trim() || undefined,
        email: masterFormData.email.trim() || undefined,
      }

      if (identifierType === 'mobile' && additionalNormalized) {
        masterData.gstin = additionalNormalized
      } else if (identifierType === 'gstin' && additionalNormalized) {
        masterData.mobile = additionalNormalized
      }

      const result = await lookupOrCreateCustomer(
        identifier,
        orgId,
        userId,
        masterData
      )
      setSelectedCustomer({
        ...result.customer,
        master_customer: result.master,
      })
      setShowAddNewForm(false)
      setMasterFormData({ customer_name: '', address: '', email: '', additionalIdentifier: '' })
      // Auto-advance to Step 2
      setCurrentStep(2)
    } catch (error) {
      console.error('Error creating customer:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create customer',
      })
    } finally {
      setSearching(false)
    }
  }

  // Step 2: Add Products
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: '',
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItemFormData, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }

    // Recalculate line_total if quantity or unit_price changed
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = (updated[index].quantity || 0) * (updated[index].unit_price || 0)
    }

    setItems(updated)
  }

  const handleProductChange = (index: number, productId: string) => {
    const updated = [...items]
    const selectedProduct = products.find((p) => p.id === productId)
    
    updated[index] = {
      ...updated[index],
      product_id: productId,
      unit_price: selectedProduct?.selling_price || updated[index].unit_price || 0,
      serial_tracked: selectedProduct?.serial_tracked || false,
      serials: selectedProduct?.serial_tracked ? (updated[index].serials || []) : undefined,
      quantity: selectedProduct?.serial_tracked ? (updated[index].serials?.length || 0) : updated[index].quantity || 1,
    }
    
    // Recalculate line_total
    updated[index].line_total = (updated[index].quantity || 0) * updated[index].unit_price

    setItems(updated)
  }

  // Handle product selection from combobox
  const handleProductSelect = (product: ProductWithMaster) => {
    if (!selectedCustomer) {
      toast.error('Please select a customer first', {
        position: 'bottom-center',
        autoClose: 3000,
        style: { maxWidth: '90vw', fontSize: '14px' },
      })
      return
    }
    setPendingProduct(product)
    setPendingQuantity(1)
    setPendingSerial('')
    setShowConfirmSheet(true)
  }

  // Handle scan from camera (continuous mode)
  const handleScanFromCamera = async (code: string) => {
    if (!selectedCustomer) {
      toast.error('Please select a customer first', {
        position: 'bottom-center',
        autoClose: 3000,
        style: { maxWidth: '90vw', fontSize: '14px' },
      })
      setScannerMode('closed')
      return
    }

    setScanning(true)
    setScanError(null)

    try {
      // Validate single code
      const results = await validateScannerCodes(orgId, [code])
      
      if (results.length === 0) {
        toast.error('Product not found. Ask your manager to add this product.', {
          position: 'bottom-center',
          autoClose: 3000,
          style: { maxWidth: '90vw', fontSize: '14px' },
        })
        setScanning(false)
        return
      }

      const result = results[0]
      
      if (result.status === 'valid' && result.product_id) {
        const product = products.find((p) => p.id === result.product_id)
        if (product) {
          // Show confirmation sheet (scanner stays open)
          setPendingProduct(product)
          setPendingQuantity(1)
          setPendingSerial('')
          setScannerMode('confirming')
          setShowConfirmSheet(true)
        } else {
          toast.error('Product not found in inventory.', {
            position: 'bottom-center',
            autoClose: 3000,
            style: { maxWidth: '90vw', fontSize: '14px' },
          })
        }
      } else if (result.status === 'invalid') {
        toast.error('This product isn\'t in stock yet. Ask your manager to add or stock it.', {
          position: 'bottom-center',
          autoClose: 3000,
          style: { maxWidth: '90vw', fontSize: '14px' },
        })
      } else if (result.status === 'not_found') {
        toast.error('Product not found. Ask your manager to add this product.', {
          position: 'bottom-center',
          autoClose: 3000,
          style: { maxWidth: '90vw', fontSize: '14px' },
        })
      }
    } catch (error) {
      console.error('Error processing scan:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process scan', {
        position: 'bottom-center',
        autoClose: 3000,
        style: { maxWidth: '90vw', fontSize: '14px' },
      })
    } finally {
      setScanning(false)
    }
  }

  // Handle product confirmation
  const handleConfirmProduct = (quantity: number, serial?: string) => {
    if (!pendingProduct) return

    const updatedItems = [...items]
    
    // Check if item already exists for this product
    const existingIndex = updatedItems.findIndex((item) => item.product_id === pendingProduct.id)
    
    if (existingIndex >= 0) {
      // Update existing item
      const existingItem = updatedItems[existingIndex]
      if (pendingProduct.serial_tracked && serial) {
        // Add serial to existing item
        const existingSerials = existingItem.serials || []
        if (!existingSerials.includes(serial)) {
          existingItem.serials = [...existingSerials, serial]
          existingItem.quantity = existingItem.serials.length
        }
      } else {
        // Increase quantity
        existingItem.quantity = (existingItem.quantity || 0) + quantity
      }
      existingItem.line_total = existingItem.quantity * existingItem.unit_price
    } else {
      // Create new item
      const newItem: InvoiceItemFormData = {
        product_id: pendingProduct.id,
        quantity: pendingProduct.serial_tracked && serial ? 1 : quantity,
        unit_price: pendingProduct.selling_price || 0,
        line_total: 0,
        serial_tracked: pendingProduct.serial_tracked || false,
        serials: pendingProduct.serial_tracked && serial ? [serial] : undefined,
      }
      newItem.line_total = newItem.quantity * newItem.unit_price
      updatedItems.push(newItem)
    }

    setItems(updatedItems)
    setShowConfirmSheet(false)
    setPendingProduct(null)
    
    // If scanner was open, continue scanning
    if (scannerMode === 'confirming') {
      setScannerMode('scanning')
    }
  }

  // Handle cancel confirmation
  const handleCancelConfirm = () => {
    setShowConfirmSheet(false)
    setPendingProduct(null)
    
    // If scanner was open, continue scanning
    if (scannerMode === 'confirming') {
      setScannerMode('scanning')
    }
  }

  // Handle scanner open
  const handleScanClick = () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer first', {
        position: 'bottom-center',
        autoClose: 3000,
        style: { maxWidth: '90vw', fontSize: '14px' },
      })
      return
    }
    setScannerMode('scanning')
  }

  // Auto-save draft
  const draftData = useMemo(() => ({
    customer_id: selectedCustomer?.id,
    items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      serials: item.serials,
    })),
  }), [selectedCustomer, items])

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null)
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number | null>(null)

  const { saveStatus, manualSave } = useAutoSave(
    draftData,
    async (data) => {
      if (!selectedCustomer || !draftSessionId.current) return
      try {
        const result = await autoSaveInvoiceDraft(orgId, userId, draftSessionId.current, data)
        setInternalDraftInvoiceId(result.invoiceId)
        // Update session ID if it changed
        if (result.sessionId && result.sessionId !== draftSessionId.current) {
          draftSessionId.current = result.sessionId
          if (result.invoiceId) {
            setDraftSessionId(result.invoiceId, result.sessionId)
          }
        }
        const now = Date.now()
        // Only show toast if it's been more than 3 seconds since last auto-save (avoid spam)
        if (!lastAutoSaveTime || now - lastAutoSaveTime > 3000) {
          setToast({ message: 'Draft saved automatically', type: 'success' })
          setLastAutoSaveTime(now)
        }
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    },
    { 
      localDebounce: 1500,  // 1.5s debounce for localStorage
      rpcInterval: 5000,     // 5s interval for RPC calls
      enabled: selectedCustomer !== null && draftSessionId.current !== null
    }
  )

  const handleManualSaveDraft = async () => {
    if (!selectedCustomer) return
    try {
      await manualSave()
      const hasInvalidItems = items.some(item => 
        (item.invalid_serials && item.invalid_serials.length > 0) ||
        (item.validation_errors && item.validation_errors.length > 0)
      )
      if (hasInvalidItems) {
        setToast({ message: 'Draft saved (contains items needing review)', type: 'info' })
      } else {
        setToast({ message: 'Draft saved', type: 'success' })
      }
    } catch (error) {
      console.error('Manual save failed:', error)
      setToast({ message: 'Failed to save draft', type: 'error' })
    }
  }

  // Add serial to item
  const handleAddSerial = async (itemIndex: number, serial: string) => {
    const updated = [...items]
    const item = updated[itemIndex]
    
    if (!item.serials) {
      item.serials = []
    }

    // Skip if serial already exists
    if (item.serials.includes(serial)) {
      return
    }

    // Validate serial before adding
    try {
      const serialStatus = await checkSerialStatus(orgId, serial.trim())
      
      if (!serialStatus.found) {
        // Serial not found - allow adding but mark as invalid
        if (!item.invalid_serials) {
          item.invalid_serials = []
        }
        item.invalid_serials.push(serial.trim())
        setToast({ 
          message: 'Serial not found in stock. Saved as draft for manager review.', 
          type: 'error' 
        })
      } else if (serialStatus.product_id !== item.product_id) {
        // Serial belongs to different product
        setToast({ 
          message: `Serial belongs to a different product.`, 
          type: 'error' 
        })
        return
      } else if (serialStatus.status !== 'available') {
        // Serial not available
        if (!item.invalid_serials) {
          item.invalid_serials = []
        }
        item.invalid_serials.push(serial.trim())
        setToast({ 
          message: 'Serial not available in stock. Saved as draft for manager review.', 
          type: 'error' 
        })
      }

      // Add serial (even if invalid, for draft purposes)
      item.serials.push(serial.trim())
      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
    } catch (error) {
      console.error('Error validating serial:', error)
      // Still allow adding for draft, but mark as invalid
      if (!item.invalid_serials) {
        item.invalid_serials = []
      }
      item.invalid_serials.push(serial.trim())
      item.serials.push(serial.trim())
      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
      setToast({ 
        message: 'Error validating serial. Saved as draft for manager review.', 
        type: 'error' 
      })
    }
  }

  // Remove serial from item
  const handleRemoveSerial = (itemIndex: number, serialIndex: number) => {
    const updated = [...items]
    const item = updated[itemIndex]
    
    if (item.serials) {
      const removedSerial = item.serials[serialIndex]
      item.serials.splice(serialIndex, 1)
      
      // Also remove from invalid_serials if present
      if (item.invalid_serials && item.invalid_serials.includes(removedSerial)) {
        item.invalid_serials = item.invalid_serials.filter(s => s !== removedSerial)
      }
      
      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
    }
  }

  // Calculate totals with per-item GST calculation
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0)
    
    const gstEnabled = isOrgGstEnabled(org)
    if (!gstEnabled || !selectedCustomer) {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: subtotal,
      }
    }

    // Get seller state code from org GSTIN or state field
    const sellerStateCode = org.gst_number 
      ? extractStateCodeFromGSTIN(org.gst_number) 
      : (org.state ? org.state.slice(0, 2) : null)

    if (!sellerStateCode) {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: subtotal,
      }
    }

    // Get buyer state code with fallback logic
    const buyerStateCode = getCustomerStateCode(selectedCustomer, sellerStateCode)

    // Calculate GST per item
    let cgst_amount = 0
    let sgst_amount = 0
    let igst_amount = 0

    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id) as ProductWithMaster | undefined
      const productGstRate = product?.master_product?.gst_rate

      if (!productGstRate || productGstRate <= 0) {
        continue
      }

      // Calculate item GST (GST-inclusive pricing)
      const itemGst = calculateItemGST(
        item.line_total,
        productGstRate,
        sellerStateCode,
        buyerStateCode || undefined,
        true // isGstInclusive = true
      )

      cgst_amount += itemGst.cgst_amount
      sgst_amount += itemGst.sgst_amount
      igst_amount += itemGst.igst_amount
    }

    // Round aggregated amounts
    cgst_amount = Math.round(cgst_amount * 100) / 100
    sgst_amount = Math.round(sgst_amount * 100) / 100
    igst_amount = Math.round(igst_amount * 100) / 100

    const total_amount = subtotal + cgst_amount + sgst_amount + igst_amount

    return {
      subtotal,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_amount,
    }
  }, [items, org, selectedCustomer, products])

  // Step 3: Review
  // Step 4: Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedCustomer) {
      setErrors({ customer: 'Please select a customer' })
      setCurrentStep(1)
      return
    }

    if (items.length === 0) {
      setErrors({ items: 'Please add at least one item' })
      setCurrentStep(2)
      return
    }

    // Validate all items
    const invalidItems = items.some((item) => {
      if (!item.product_id || item.unit_price <= 0) return true
      
      // For serial-tracked products, check serials instead of quantity
      if (item.serial_tracked) {
        return !item.serials || item.serials.length === 0
      }
      
      // For non-serial products, check quantity
      return item.quantity <= 0
    })
    
    if (invalidItems) {
      setErrors({ items: 'Please fill all item fields correctly (serials for serial-tracked products, quantity for others)' })
      setCurrentStep(2)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // Backend validation before finalization
      const validationItems = items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        serials: item.serials || [],
        serial_tracked: item.serial_tracked || false,
      }))

      const validation = await validateInvoiceItems(orgId, validationItems)

      if (!validation.valid) {
        // Group errors by type
        const productErrors = validation.errors.filter(e => e.type === 'product_not_found')
        const serialErrors = validation.errors.filter(e => e.type === 'serial_not_found')
        const stockErrors = validation.errors.filter(e => e.type === 'insufficient_stock')

        // Update items with validation errors and available stock
        const updatedItems = items.map((item, index) => {
          const itemErrors = validation.errors.filter(e => e.item_index === index + 1)
          const stockError = itemErrors.find(e => e.type === 'insufficient_stock')
          
          return {
            ...item,
            validation_errors: itemErrors.map(e => e.message),
            stock_available: stockError?.available_stock,
          }
        })
        setItems(updatedItems)

        // Show toast with error summary
        let errorMessage = 'Invoice validation failed: '
        if (productErrors.length > 0) {
          errorMessage += `${productErrors.length} product(s) not found. `
        }
        if (serialErrors.length > 0) {
          errorMessage += `${serialErrors.length} serial(s) not found. `
        }
        if (stockErrors.length > 0) {
          errorMessage += `${stockErrors.length} item(s) have insufficient stock. `
        }
        setToast({ message: errorMessage.trim(), type: 'error' })

        // Set form errors
        setErrors({ 
          items: 'Some items have validation errors. Please fix them before finalizing.',
          submit: 'Cannot create invoice with invalid items'
        })
        setCurrentStep(2)
        setIsSubmitting(false)
        return
      }

      const invoiceData: InvoiceFormData = {
        customer_id: selectedCustomer.id,
        items: items.map((item) => ({
          ...item,
          line_total: item.quantity * item.unit_price,
        })),
      }

      const invoice = await createInvoice(
        orgId,
        userId,
        invoiceData,
        org,
        selectedCustomer
      )

      // Clear draft session ID on finalize
      if (currentDraftInvoiceId) {
        clearDraftSessionId(currentDraftInvoiceId)
      } else {
        clearDraftSessionId()
      }
      draftSessionId.current = null

      await onSubmit(invoice.id)
      onClose()
    } catch (error) {
      console.error('Error creating invoice:', error)
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create invoice',
      })
      setToast({ 
        message: error instanceof Error ? error.message : 'Failed to create invoice', 
        type: 'error' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceedToStep2 = selectedCustomer !== null
  const canProceedToStep3 = items.length > 0 && items.every((item) => item.product_id && item.quantity > 0 && item.unit_price > 0)

  // Manual retry handler
  const handleManualRetry = () => {
    if (draftInvoiceId) {
      draftLoadRetries.current = 0
      setDraftLoadError(null)
      setIsRetrying(false)
      loadDraftWithRetry(draftInvoiceId)
    }
  }

  // Show loading or error state when loading draft
  const DraftLoadingContent = (
    <div className="flex flex-col items-center justify-center py-12 space-y-4 px-4">
      {loadingDraft && !draftLoadError && (
        <>
          <LoadingSpinner size="lg" />
          <p className="text-sm text-secondary-text">
            {isRetrying ? 'Retrying...' : 'Loading draft...'}
          </p>
        </>
      )}
      {draftLoadError && !loadingDraft && (
        <div className="text-center space-y-4 max-w-md">
          <div className="text-error-dark">
            <XCircleIcon className="h-12 w-12 mx-auto mb-2" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-2">
              Failed to Load Draft
            </h3>
            <p className="text-sm text-secondary-text mb-4">
              {draftLoadError}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualRetry}
              disabled={loadingDraft}
              className="w-full"
            >
              Retry
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // Show loading/error UI only when we're loading a draft or have a draft error
  // Don't show form content for new transactions while draft is loading
  const showDraftLoadingUI = draftInvoiceId && (loadingDraft || draftLoadError)

  const FormContent = showDraftLoadingUI ? (
    DraftLoadingContent
  ) : (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Customer Selection */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-md">Step 1: Select Customer</h3>
            <IdentifierInput
              value={identifier}
              onChange={setIdentifier}
              onValidationChange={(isValid, type) => {
                setIdentifierValid(isValid)
                setIdentifierType(type)
              }}
              onSearch={handleLookupCustomer}
              onClear={() => {
                setSelectedCustomer(null)
                setLookupPerformed(false)
                setShowAddNewForm(false)
              }}
              autoFocus={isOpen && currentStep === 1}
              disabled={isSubmitting}
              searching={searching}
            />

            {/* Horizontal swipeable customer selection area - show after lookup completes */}
            {lookupPerformed && !searching && identifierValid && (
              <div className="mt-4">
                <div 
                  className="flex gap-md overflow-x-auto pb-sm -mx-md px-md"
                  style={{
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {selectedCustomer && (
                    <div className="flex-shrink-0" style={{ minWidth: '280px', scrollSnapAlign: 'start' }}>
                      <CustomerResultCard
                        customer={selectedCustomer}
                        onSelect={() => setCurrentStep(2)}
                      />
                    </div>
                  )}
                  
                  {/* Add New Customer Card */}
                  <div className="flex-shrink-0" style={{ minWidth: '280px', scrollSnapAlign: 'start' }}>
                    <Card 
                      className="border-2 border-success-light shadow-sm"
                    >
                      <CardContent className="p-md">
                        <div className="space-y-md">
                          {/* Icon and Title */}
                          <div>
                            <div className="flex items-center gap-sm mb-xs">
                              <div className="w-8 h-8 rounded-md bg-success-light flex items-center justify-center flex-shrink-0">
                                <PlusIcon className="h-4 w-4 text-success" />
                              </div>
                              <h3 className="text-base font-semibold text-primary-text">Add New Customer</h3>
                            </div>
                            <p className="text-xs text-secondary-text">
                              Create a new customer record
                            </p>
                          </div>

                          {/* Placeholder content to match height */}
                          <div className="space-y-xs text-xs text-secondary-text opacity-50">
                            <div>Enter customer details</div>
                            <div>Mobile or GSTIN required</div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-sm pt-sm">
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => {
                                setShowAddNewForm(true)
                              }}
                              className="flex-1 min-h-[44px]"
                              aria-label="Add new customer"
                            >
                              Add New Customer
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Add New Customer Form */}
            {showAddNewForm && (
              <div className="mt-md space-y-md p-md border border-neutral-200 rounded-md bg-neutral-50">
                <h4 className="text-sm font-semibold text-primary-text">Add New Customer</h4>
                <p className="text-xs text-secondary-text">
                  Please provide customer details to create a new customer record.
                </p>

                <Input
                  label="Customer Name (Optional)"
                  type="text"
                  value={masterFormData.customer_name}
                  onChange={(e) =>
                    setMasterFormData({ ...masterFormData, customer_name: e.target.value })
                  }
                  disabled={isSubmitting || searching}
                  placeholder="Enter customer name (optional)"
                  error={errors.customer_name}
                />

                {/* Dynamic Identifier Field */}
                {identifierType !== 'invalid' && (
                  <Input
                    label={identifierType === 'mobile' ? 'GSTIN (Optional)' : 'Mobile Number (Optional)'}
                    type="text"
                    value={masterFormData.additionalIdentifier}
                    onChange={(e) =>
                      setMasterFormData({ ...masterFormData, additionalIdentifier: e.target.value })
                    }
                    disabled={isSubmitting || searching}
                    placeholder={identifierType === 'mobile' ? 'Enter 15-character GSTIN' : 'Enter 10-digit mobile number'}
                    error={errors.additionalIdentifier}
                  />
                )}

                <Input
                  label="Email"
                  type="email"
                  value={masterFormData.email}
                  onChange={(e) =>
                    setMasterFormData({ ...masterFormData, email: e.target.value })
                  }
                  disabled={isSubmitting || searching}
                  placeholder="Enter email address (optional)"
                  error={errors.email}
                />

                <div>
                  <label className="block text-sm font-medium text-secondary-text mb-xs">
                    Address
                  </label>
                  <textarea
                    value={masterFormData.address}
                    onChange={(e) =>
                      setMasterFormData({ ...masterFormData, address: e.target.value })
                    }
                    disabled={isSubmitting || searching}
                    placeholder="Enter address (optional)"
                    rows={3}
                    className="w-full px-md py-sm border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-neutral-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddNewForm(false)
                      setMasterFormData({ customer_name: '', address: '', email: '', additionalIdentifier: '' })
                      setErrors({})
                    }}
                    disabled={isSubmitting || searching}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCreateMasterCustomer}
                    isLoading={searching}
                    disabled={isSubmitting || searching}
                    className="flex-1"
                  >
                    Create Customer
                  </Button>
                </div>
              </div>
            )}

            {errors.identifier && (
              <p className="mt-sm text-sm text-error">{errors.identifier}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Add Products */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-md">Step 2: Add Products</h3>

            {/* Product Search Combobox */}
            <div className="mb-md">
              <ProductSearchCombobox
                onProductSelect={handleProductSelect}
                onScanClick={handleScanClick}
                disabled={isSubmitting || !selectedCustomer}
                orgId={orgId}
                products={products}
                placeholder="Search / Select Product..."
              />
            </div>

            {/* Create New Item Button */}
            <div className="mb-md">
              <Button 
                type="button" 
                variant="primary" 
                onClick={handleAddItem}
                disabled={isSubmitting || !selectedCustomer}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create New Item
              </Button>
            </div>

            {/* Items List - Auto-visible when items exist */}
            {items.length === 0 ? (
              <div className="text-center py-lg border-2 border-dashed border-neutral-300 rounded-md">
                <p className="text-sm text-secondary-text">No items yet. Search or scan to add products.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  const hasInvalidSerials = item.invalid_serials && item.invalid_serials.length > 0
                  const hasValidationErrors = item.validation_errors && item.validation_errors.length > 0
                  const hasStockError = item.validation_errors?.some((e: string) => e.includes('Insufficient stock'))
                  const isInvalid = hasInvalidSerials || hasValidationErrors

                  return (
                    <div 
                      key={index} 
                      className={`border rounded-md p-md space-y-md ${
                        isInvalid 
                          ? 'border-error bg-error-light/10' 
                          : 'border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-sm">
                          <h4 className="text-sm font-medium text-primary-text">Item {index + 1}</h4>
                          {isInvalid && (
                            <span className="text-xs text-error font-medium" title={item.validation_errors?.join(', ') || 'Item has validation errors'}>
                              ⚠️ Needs review
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-error hover:text-error-dark"
                          disabled={isSubmitting}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <Select
                        label="Product *"
                        value={item.product_id || ''}
                        onChange={(e) => {
                          handleProductChange(index, e.target.value)
                        }}
                        options={products.length > 0 ? [
                          { value: '', label: 'Select a product' },
                          ...products.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.sku}) - $${p.selling_price?.toFixed(2) || '0.00'}`,
                          })),
                        ] : [{ value: '', label: 'No products available' }]}
                        disabled={isSubmitting || loadingProducts}
                        required
                      />

                      {/* Serial Tracking UI */}
                      {item.serial_tracked ? (
                        <div className="space-y-sm">
                          <label className="block text-sm font-medium text-secondary-text">
                            Serial Numbers ({item.serials?.length || 0})
                          </label>
                          {item.serials && item.serials.length > 0 ? (
                            <div className="space-y-xs">
                              {item.serials.map((serial, serialIndex) => {
                                const isInvalidSerial = item.invalid_serials?.includes(serial)
                                return (
                                  <div
                                    key={serialIndex}
                                    className={`flex items-center justify-between p-sm rounded-md ${
                                      isInvalidSerial 
                                        ? 'bg-error-light border border-error' 
                                        : 'bg-neutral-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-xs">
                                      <span className="text-sm text-primary-text font-mono">
                                        {serial}
                                      </span>
                                      {isInvalidSerial && (
                                        <span className="text-xs text-error" title="Serial not found in stock">
                                          ⚠️
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSerial(index, serialIndex)}
                                      className="text-error hover:text-error-dark"
                                      disabled={isSubmitting}
                                    >
                                      <XCircleIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-secondary-text">
                              Scan serial numbers for this product
                            </p>
                          )}
                          {hasInvalidSerials && (
                            <p className="text-xs text-error">
                              Some serials not found in stock. Saved as draft for manager review.
                            </p>
                          )}
                          <Input
                            label="Add Serial Number"
                            type="text"
                            value={serialInputs[index] || ''}
                            onChange={(e) => {
                              setSerialInputs({ ...serialInputs, [index]: e.target.value })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const value = serialInputs[index]?.trim()
                                if (value) {
                                  handleAddSerial(index, value)
                                  setSerialInputs({ ...serialInputs, [index]: '' })
                                }
                              }
                            }}
                            placeholder="Scan or enter serial number"
                            disabled={isSubmitting}
                          />
                        </div>
                      ) : (
                        <div className="space-y-md">
                          {hasStockError && item.stock_available !== undefined && (
                            <div className="p-sm bg-warning-light border border-warning rounded-md">
                              <p className="text-xs text-warning-dark font-medium">
                                Insufficient stock. Available: {item.stock_available}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              label="Quantity"
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity.toString()}
                              onChange={(e) =>
                                handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                              }
                              disabled={isSubmitting}
                              required
                              placeholder="1"
                            />

                            <Input
                              label="Unit Price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price.toString()}
                              onChange={(e) =>
                                handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                              }
                              disabled={isSubmitting}
                              required
                              placeholder="0.00"
                            />
                          </div>
                          {hasValidationErrors && !hasStockError && (
                            <div className="p-sm bg-error-light border border-error rounded-md">
                              <p className="text-xs text-error-dark font-medium">
                                {item.validation_errors?.join(', ')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-right">
                        <p className="text-sm text-secondary-text">
                          Line Total: <span className="font-semibold text-primary-text">${item.line_total.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {errors.items && (
              <p className="mt-sm text-sm text-error">{errors.items}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-md">Step 3: Review Invoice</h3>

            {/* Customer Info */}
            {selectedCustomer && (
              <div className="mb-lg p-md bg-neutral-50 rounded-md">
                <h4 className="text-sm font-semibold text-primary-text mb-sm">Customer</h4>
                <p className="text-sm text-primary-text">
                  {selectedCustomer.alias_name || selectedCustomer.master_customer.legal_name}
                </p>
                {selectedCustomer.master_customer.mobile && (
                  <p className="text-xs text-secondary-text">Mobile: {selectedCustomer.master_customer.mobile}</p>
                )}
                {selectedCustomer.master_customer.gstin && (
                  <p className="text-xs text-secondary-text">GSTIN: {selectedCustomer.master_customer.gstin}</p>
                )}
              </div>
            )}

            {/* Items Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary-text">Items</h4>
              {items.map((item, index) => {
                const product = products.find((p) => p.id === item.product_id) as ProductWithMaster | undefined
                const hasInvalidSerials = item.invalid_serials && item.invalid_serials.length > 0
                const hasValidationErrors = item.validation_errors && item.validation_errors.length > 0
                const isInvalid = hasInvalidSerials || hasValidationErrors
                
                return (
                  <div 
                    key={index} 
                    className={`border-b last:border-0 pb-sm mb-sm ${
                      isInvalid ? 'border-error bg-error-light/10' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex justify-between text-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-xs">
                          <span className="font-medium text-primary-text">{product?.name || 'Unknown Product'}</span>
                          {isInvalid && (
                            <span className="text-xs text-error">⚠️</span>
                          )}
                        </div>
                        <span className="text-secondary-text">x {item.quantity}</span>
                      </div>
                      <span className="font-medium text-primary-text">${item.line_total.toFixed(2)}</span>
                    </div>
                    {item.serial_tracked && item.serials && item.serials.length > 0 && (
                      <div className="mt-xs text-xs text-muted-text">
                        <span className="font-medium">Serials: </span>
                        <span className="font-mono">{item.serials.join(', ')}</span>
                      </div>
                    )}
                    {hasValidationErrors && (
                      <div className="mt-xs text-xs text-error">
                        {item.validation_errors?.join(', ')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-lg pt-md border-t border-neutral-200 space-y-sm">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-text">Subtotal</span>
                <span className="font-medium text-primary-text">${totals.subtotal.toFixed(2)}</span>
              </div>
              {isOrgGstEnabled(org) && (
                <>
                  {totals.cgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-text">CGST</span>
                      <span className="font-medium text-primary-text">${totals.cgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.sgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-text">SGST</span>
                      <span className="font-medium text-primary-text">${totals.sgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.igst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-text">IGST</span>
                      <span className="font-medium text-primary-text">${totals.igst_amount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-lg font-semibold pt-sm border-t border-neutral-200">
                <span className="text-primary-text">Total</span>
                <span className="text-primary-text">${totals.total_amount.toFixed(2)}</span>
              </div>
              {items.some(item => 
                (item.invalid_serials && item.invalid_serials.length > 0) ||
                (item.validation_errors && item.validation_errors.length > 0)
              ) && (
                <div className="mt-md p-md bg-warning-light border border-warning rounded-md">
                  <p className="text-sm font-medium text-warning-dark">
                    ⚠️ This invoice contains items that need manager review
                  </p>
                  <p className="text-xs text-warning-dark mt-xs">
                    Please fix validation errors before finalizing the invoice.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-sm pt-md border-t border-neutral-200">
        <div className="flex-1">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentStep((s) => (s - 1) as Step)}
              disabled={isSubmitting}
              className="w-full"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-sm flex-1">
          {currentStep < 3 && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (currentStep === 1 && canProceedToStep2) {
                  setCurrentStep(2)
                } else if (currentStep === 2 && canProceedToStep3) {
                  setCurrentStep(3)
                }
              }}
              disabled={
                isSubmitting ||
                (currentStep === 1 && !canProceedToStep2) ||
                (currentStep === 2 && !canProceedToStep3)
              }
              className="w-full"
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          )}

          {currentStep === 3 && (
            <>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={onClose} 
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                isLoading={isSubmitting}
                className="flex-1"
                disabled={
                  items.some(item => 
                    (item.invalid_serials && item.invalid_serials.length > 0) ||
                    (item.validation_errors && item.validation_errors.length > 0)
                  )
                }
              >
                Create Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {errors.submit && (
        <p className="text-sm text-error">{errors.submit}</p>
      )}
    </form>
  )

  const formTitle = title || 'Create Invoice'

  // Header action: Save Draft button
  const headerAction = selectedCustomer ? (
    <button
      type="button"
      onClick={handleManualSaveDraft}
      disabled={isSubmitting || saveStatus === 'saving'}
      className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-text hover:bg-neutral-100 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Save draft"
      title="Save draft"
    >
      {saveStatus === 'saving' ? (
        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <BookmarkIcon className="h-5 w-5" />
      )}
    </button>
  ) : null

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {isMobileDevice() ? (
        <Drawer isOpen={isOpen} onClose={onClose} title={formTitle} headerAction={headerAction}>
          {FormContent}
        </Drawer>
      ) : (
        <Modal isOpen={isOpen} onClose={onClose} title={formTitle} headerAction={headerAction}>
          {FormContent}
        </Modal>
      )}

      {/* Camera Scanner - Continuous Mode */}
      <CameraScanner
        isOpen={scannerMode === 'scanning' || scannerMode === 'confirming'}
        onClose={() => {
          setScannerMode('closed')
          setShowConfirmSheet(false)
          setPendingProduct(null)
        }}
        onScanSuccess={handleScanFromCamera}
        continuousMode={true}
        orgId={orgId}
      />

      {/* Backdrop - z-index 9999, dims content but NOT scanner */}
      {scannerMode === 'confirming' && (
        <div 
          className="fixed inset-0 bg-black/40"
          style={{ zIndex: 9999 }}
          onClick={handleCancelConfirm}
          aria-hidden="true"
        />
      )}

      {/* Product Confirmation Sheet - z-index 10000, solid white */}
      <ProductConfirmSheet
        isOpen={showConfirmSheet}
        product={pendingProduct}
        onConfirm={handleConfirmProduct}
        onCancel={handleCancelConfirm}
        defaultQuantity={pendingQuantity}
        scannerMode={scannerMode}
      />
    </>
  )
}

