import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import { supabase } from '../../lib/supabase'
import { getDCStock, type DCStockSummary } from '../../lib/api/dcStock'
import { createDCSale } from '../../lib/api/dcSales'
import { useLookupOrCreateCustomer } from '../../hooks/useCustomers'
import { recordCashReceived, validateSection269ST, getCashSettings, type OrgCashSettings } from '../../lib/api/agentCash'
import type { CustomerWithMaster } from '../../types'

export interface SaleItem {
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  line_total: number
  max_quantity: number
}

export type PaymentMethod = 'upi' | 'payment_link' | 'cash' | 'unpaid'

export function useCreateDCSale() {
  const { user, currentAgentContext } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dcStock, setDcStock] = useState<DCStockSummary[]>([])
  const [customer, setCustomer] = useState<CustomerWithMaster | null>(null)
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [items, setItems] = useState<SaleItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('unpaid')
  const [cashSettings, setCashSettings] = useState<OrgCashSettings | null>(null)

  // Hook for customer lookup/creation
  const lookupOrCreateCustomerMutation = useLookupOrCreateCustomer(
    currentAgentContext?.senderOrgId || null,
    user?.id || null
  )

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)

  useEffect(() => {
    if (!user || !currentAgentContext) return
    loadDCStock()
    loadCashSettings()
  }, [user?.id, currentAgentContext?.relationshipId])

  const loadCashSettings = async () => {
    if (!currentAgentContext) return
    try {
      const settings = await getCashSettings(currentAgentContext.senderOrgId)
      setCashSettings(settings)
    } catch (error) {
      console.error('Error loading cash settings:', error)
    }
  }

  const loadDCStock = async () => {
    if (!user || !currentAgentContext) return

    try {
      setLoading(true)
      const data = await getDCStock(currentAgentContext.senderOrgId, user.id)
      setDcStock(data)
    } catch (error) {
      console.error('Error loading DC stock:', error)
      toast.error('Failed to load DC stock')
    } finally {
      setLoading(false)
    }
  }

  const searchCustomer = async (identifier: string) => {
    if (!identifier.trim() || !currentAgentContext || !user) return

    try {
      setSearchingCustomer(true)
      const result = await lookupOrCreateCustomerMutation.mutateAsync({
        identifier: identifier,
      })
      setCustomer(result.customer as CustomerWithMaster)
      toast.success('Customer found')
      return true
    } catch (error: any) {
      console.error('Error finding customer:', error)
      toast.error(error.message || 'Failed to find customer')
      return false
    } finally {
      setSearchingCustomer(false)
    }
  }

  const addItem = (productId: string) => {
    if (!productId) {
      toast.error('Please select a product')
      return
    }

    const stockItem = dcStock.find(s => s.product_id === productId)
    if (!stockItem) return

    // Check if product already added
    if (items.find(i => i.product_id === productId)) {
      toast.error('Product already added')
      return
    }

    const newItem: SaleItem = {
      product_id: stockItem.product_id,
      product_name: stockItem.product.name,
      product_sku: stockItem.product.sku,
      quantity: 1,
      unit_price: stockItem.product.selling_price || 0,
      line_total: stockItem.product.selling_price || 0,
      max_quantity: stockItem.current_stock,
    }

    setItems([...items, newItem])
  }

  const updateItemQuantity = (index: number, quantity: number) => {
    const item = items[index]
    if (quantity > item.max_quantity) {
      toast.error(`Only ${item.max_quantity} units available`)
      return
    }

    const updatedItems = [...items]
    updatedItems[index].quantity = quantity
    updatedItems[index].line_total = quantity * item.unit_price
    setItems(updatedItems)
  }

  const updateItemPrice = (index: number, price: number) => {
    const updatedItems = [...items]
    updatedItems[index].unit_price = price
    updatedItems[index].line_total = updatedItems[index].quantity * price
    setItems(updatedItems)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const submitSale = async () => {
    if (!currentAgentContext || !user || !customer) {
      toast.error('Please select a customer')
      return false
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return false
    }

    if (paymentMethod === 'unpaid') {
      toast.error('Please select a payment method')
      return false
    }

    // ENFORCE Section 269ST for cash payments
    if (paymentMethod === 'cash' && cashSettings) {
      const validation = validateSection269ST(subtotal, cashSettings.section_269st_limit)
      if (!validation.valid) {
        toast.error(validation.error)
        return false
      }
    }

    try {
      setSubmitting(true)

      // Create sale
      const result = await createDCSale(
        currentAgentContext.senderOrgId,
        user.id,
        null,
        {
          customer_id: customer.id,
          items: items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: i.line_total,
          })),
        },
        user.id
      )

      // Update invoice payment method
      // TODO: This should ideally be part of the createDCSale transaction or a separate API function
      await supabase
        .from('invoices')
        .update({
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash' ? 'paid' : 'unpaid',
          paid_amount: paymentMethod === 'cash' ? subtotal : 0,
          paid_at: paymentMethod === 'cash' ? new Date().toISOString() : null,
        })
        .eq('id', result.invoice.id)

      // If cash payment, record in cash ledger
      if (paymentMethod === 'cash') {
        await recordCashReceived(
          currentAgentContext.senderOrgId,
          user.id,
          result.invoice.id,
          subtotal,
          user.id
        )
      }

      toast.success(
        paymentMethod === 'cash'
          ? 'Sale created and cash recorded. Please deposit to seller account within allowed timeframe.'
          : 'Sale created successfully'
      )
      return true
    } catch (error: any) {
      console.error('Error creating DC sale:', error)
      toast.error(error.message || 'Failed to create sale')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return {
    // State
    loading,
    submitting,
    dcStock,
    customer,
    searchingCustomer,
    items,
    paymentMethod,
    cashSettings,
    subtotal,

    // Setters
    setCustomer,
    setPaymentMethod,

    // Actions
    searchCustomer,
    addItem,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    submitSale
  }
}
