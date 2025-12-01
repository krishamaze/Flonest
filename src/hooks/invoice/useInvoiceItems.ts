import { useState } from 'react'
import type { InvoiceItemFormData, ProductWithMaster } from '../../types'
import { checkSerialStatus } from '../../lib/api/serials'

/**
 * Hook inputs: context data + callbacks for side effects
 */
export interface UseInvoiceItemsProps {
  // Context data
  products: ProductWithMaster[]
  orgId: string
  initialItems?: InvoiceItemFormData[]
  
  // Callbacks for side effects
  onError: (message: string) => void
  onItemsChange?: (items: InvoiceItemFormData[]) => void
}

/**
 * Hook outputs: state + actions
 */
export interface UseInvoiceItemsReturn {
  // State
  items: InvoiceItemFormData[]
  serialInputs: Record<number, string>
  setItems: (items: InvoiceItemFormData[]) => void // Exposed for external updates (e.g. draft restore, scanner)
  setSerialInputs: (inputs: Record<number, string>) => void
  
  // Handlers
  handleAddItem: () => void
  handleRemoveItem: (index: number) => void
  handleItemChange: (index: number, field: keyof InvoiceItemFormData, value: any) => void
  handleProductChange: (index: number, productId: string) => void
  handleAddSerial: (index: number, serial: string) => Promise<void>
  handleRemoveSerial: (index: number, serialIndex: number) => void
  handleSerialInputChange: (index: number, value: string) => void
}

/**
 * useInvoiceItems
 * 
 * Manages invoice line items, including product selection, calculations,
 * and serial number validation/tracking.
 */
export function useInvoiceItems({
  products,
  orgId,
  initialItems = [],
  onError,
  onItemsChange,
}: UseInvoiceItemsProps): UseInvoiceItemsReturn {
  
  // State
  const [items, setItemsState] = useState<InvoiceItemFormData[]>(initialItems)
  const [serialInputs, setSerialInputs] = useState<Record<number, string>>({})

  // Wrapper for setItems to trigger callback
  const setItems = (newItems: InvoiceItemFormData[]) => {
    setItemsState(newItems)
    onItemsChange?.(newItems)
  }

  // Handlers

  const handleAddItem = () => {
    const newItems = [
      ...items,
      {
        product_id: '',
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ]
    setItems(newItems)
  }

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    
    // Clean up serial input for this index
    // Note: This might shift indices for subsequent items, so we might need to be careful
    // For now, just removing the specific index from inputs
    const newSerialInputs = { ...serialInputs }
    delete newSerialInputs[index]
    setSerialInputs(newSerialInputs)
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
        onError('Serial not found in stock. Saved as draft for branch head review.')
      } else if (serialStatus.product_id !== item.product_id) {
        // Serial belongs to different product
        onError(`Serial belongs to a different product.`)
        return
      } else if (serialStatus.status !== 'available') {
        // Serial not available
        if (!item.invalid_serials) {
          item.invalid_serials = []
        }
        item.invalid_serials.push(serial.trim())
        onError('Serial not available in stock. Saved as draft for branch head review.')
      }

      // Add serial (even if invalid, for draft purposes)
      item.serials.push(serial.trim())
      if (item.serial_tracked) {
        item.quantity = item.serials.length
        item.line_total = item.quantity * item.unit_price
      }
      setItems(updated)
      
      // Clear input after successful add
      setSerialInputs({ ...serialInputs, [itemIndex]: '' })
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
      onError('Error validating serial. Saved as draft for branch head review.')
      
      // Clear input
      setSerialInputs({ ...serialInputs, [itemIndex]: '' })
    }
  }

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

  const handleSerialInputChange = (index: number, value: string) => {
    setSerialInputs({ ...serialInputs, [index]: value })
  }

  return {
    items,
    serialInputs,
    setItems,
    setSerialInputs,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleProductChange,
    handleAddSerial,
    handleRemoveSerial,
    handleSerialInputChange,
  }
}
