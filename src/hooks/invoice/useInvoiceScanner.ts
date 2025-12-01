import { useState } from 'react'
import type { ProductWithMaster, InvoiceItemFormData } from '../../types'
import { validateScannerCodes } from '../../lib/api/scanner'

/**
 * Scanner mode lifecycle
 */
export type ScannerMode = 'closed' | 'scanning' | 'confirming'

/**
 * Hook inputs: context data + callbacks for side effects
 */
export interface UseInvoiceScannerProps {
  // Context data
  selectedCustomerId: string | null
  items: InvoiceItemFormData[]
  products: ProductWithMaster[]  // Needed for product lookup during scan
  orgId: string
  
  // Callbacks for side effects (let caller decide how to handle UI)
  onItemsChange: (nextItems: InvoiceItemFormData[]) => void
  onRequireCustomer: () => void  // Called when scan attempted without customer
  onError: (message: string) => void  // For error toasts
}

/**
 * Hook outputs: state + actions
 */
export interface UseInvoiceScannerReturn {
  // State for UI
  scannerMode: ScannerMode
  showConfirmSheet: boolean
  pendingProduct: ProductWithMaster | null
  pendingQuantity: number
  
  // Actions for UI events
  handleScanClick: () => void
  handleScanFromCamera: (code: string) => Promise<void>
  handleProductSelect: (product: ProductWithMaster) => void
  handleConfirmProduct: (quantity: number, serial?: string) => void
  handleCancelConfirm: () => void
}

/**
 * useInvoiceScanner
 * 
 * Manages scanner lifecycle, product confirmation flow, and barcode validation.
 * Keeps scanner behavior isolated from invoice form orchestration.
 */
export function useInvoiceScanner({
  selectedCustomerId,
  items,
  products,
  orgId,
  onItemsChange,
  onRequireCustomer,
  onError,
}: UseInvoiceScannerProps): UseInvoiceScannerReturn {
  
  // Scanner lifecycle state
  const [scannerMode, setScannerMode] = useState<ScannerMode>('closed')
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<ProductWithMaster | null>(null)
  const [pendingQuantity, setPendingQuantity] = useState(1)

  // Actions
  
  const handleScanClick = () => {
    if (!selectedCustomerId) {
      onRequireCustomer()
      return
    }
    setScannerMode('scanning')
  }

  const handleScanFromCamera = async (code: string) => {
    if (!selectedCustomerId) {
      onRequireCustomer()
      setScannerMode('closed')
      return
    }

    try {
      // Validate single code
      const results = await validateScannerCodes(orgId, [code])

      if (results.length === 0) {
        onError('Product not found. Ask your branch head to add this product.')
        return
      }

      const result = results[0]

      if (result.status === 'valid' && result.product_id) {
        const product = products.find((p) => p.id === result.product_id)
        if (product) {
          // Show confirmation sheet (scanner stays open)
          setPendingProduct(product)
          setPendingQuantity(1)
          setScannerMode('confirming')
          setShowConfirmSheet(true)
        } else {
          onError('Product not found in inventory.')
        }
      } else if (result.status === 'invalid') {
        onError('This product isn\'t in stock yet. Ask your branch head to add or stock it.')
      } else if (result.status === 'not_found') {
        onError('Product not found. Ask your branch head to add this product.')
      }
    } catch (error) {
      console.error('Error processing scan:', error)
      onError(error instanceof Error ? error.message : 'Failed to process scan')
    }
  }

  const handleProductSelect = (product: ProductWithMaster) => {
    if (!selectedCustomerId) {
      onRequireCustomer()
      return
    }
    setPendingProduct(product)
    setPendingQuantity(1)
    setShowConfirmSheet(true)
  }

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

    onItemsChange(updatedItems)
    setShowConfirmSheet(false)
    setPendingProduct(null)

    // If scanner was open, continue scanning
    if (scannerMode === 'confirming') {
      setScannerMode('scanning')
    }
  }

  const handleCancelConfirm = () => {
    setShowConfirmSheet(false)
    setPendingProduct(null)

    // If scanner was open, continue scanning
    if (scannerMode === 'confirming') {
      setScannerMode('scanning')
    }
  }

  return {
    // State
    scannerMode,
    showConfirmSheet,
    pendingProduct,
    pendingQuantity,
    
    // Actions
    handleScanClick,
    handleScanFromCamera,
    handleProductSelect,
    handleConfirmProduct,
    handleCancelConfirm,
  }
}
