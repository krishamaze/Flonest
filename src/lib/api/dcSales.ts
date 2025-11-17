import { supabase } from '../supabase'
import type { Invoice, InvoiceItem } from '../../types'
import type { Database } from '../../types/database'
import { validateDCStockAvailability } from './dcStock'

export interface DCSaleItemInput {
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface DCSaleInput {
  customer_id: string
  items: DCSaleItemInput[]
  notes?: string
}

/**
 * Create a customer sale from DC stock
 * CRITICAL: Invoice is created in SENDER's org, not agent's org
 * Deducts from DC stock ledger
 */
export async function createDCSale(
  senderOrgId: string,
  agentUserId: string,
  dcId: string | null,
  saleData: DCSaleInput,
  createdBy: string
): Promise<{ invoice: Invoice; items: InvoiceItem[] }> {
  // Validate DC stock availability
  const validation = await validateDCStockAvailability(
    senderOrgId,
    agentUserId,
    saleData.items
  )

  if (!validation.valid) {
    throw new Error(
      `Insufficient DC stock: ${validation.errors.map(e => 
        `Product ${e.product_id} needs ${e.requested} but only ${e.available} available`
      ).join(', ')}`
    )
  }

  // Get sender org GST info for tax calculation
  const { data: senderOrg, error: orgError } = await supabase
    .from('orgs')
    .select('gst_enabled, state')
    .eq('id', senderOrgId)
    .single()

  if (orgError) throw orgError

  // Get customer info to determine if inter-state
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('master_customer_id, master_customers(state_code)')
    .eq('id', saleData.customer_id)
    .single()

  if (customerError) throw customerError

  const customerState = (customer as any).master_customers?.state_code as string | undefined
  const senderStatePrefix = senderOrg.state ? senderOrg.state.substring(0, 2) : null
  const isInterstate =
    Boolean(customerState) &&
    Boolean(senderStatePrefix) &&
    customerState!.substring(0, 2) !== senderStatePrefix

  // Calculate totals
  const subtotal = saleData.items.reduce((sum, item) => sum + item.line_total, 0)
  let cgst = 0
  let sgst = 0
  let igst = 0

  if (senderOrg.gst_enabled) {
    // Get GST rate from first product (simplified - should calculate per item)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('master_products(gst_rate)')
      .eq('id', saleData.items[0].product_id)
      .single()

    if (!productError && product) {
      const gstRate = (product as any).master_products?.gst_rate || 0
      const gstAmount = (subtotal * gstRate) / 100

      if (isInterstate) {
        igst = gstAmount
      } else {
        cgst = gstAmount / 2
        sgst = gstAmount / 2
      }
    }
  }

  const totalAmount = subtotal + cgst + sgst + igst

  // Generate invoice number
  const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

  // Create invoice in SENDER's org
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      org_id: senderOrgId, // CRITICAL: Sender's org, not agent's
      customer_id: saleData.customer_id,
      subtotal,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_amount: totalAmount,
      status: 'finalized',
      is_dc_sale: true,
      dc_id: dcId,
      agent_user_id: agentUserId,
      created_by: createdBy,
      notes: saleData.notes,
    })
    .select()
    .single()

  if (invoiceError) throw invoiceError

  // Create invoice items
  const invoiceItemsData: Database['public']['Tables']['invoice_items']['Insert'][] = saleData.items.map(item => ({
    invoice_id: invoice.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit: 'pcs', // Default unit, should come from product
    unit_price: item.unit_price,
    total_amount: item.line_total, // Map line_total to total_amount
  }))

  const { data: invoiceItems, error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItemsData)
    .select()

  if (itemsError) {
    // Rollback invoice if items fail
    await supabase.from('invoices').delete().eq('id', invoice.id)
    throw itemsError
  }

  // Deduct from DC stock
  const dcStockDeductions = saleData.items.map(item => ({
    sender_org_id: senderOrgId,
    agent_user_id: agentUserId,
    dc_id: dcId,
    product_id: item.product_id,
    transaction_type: 'dc_sale',
    quantity: -item.quantity, // Negative for sale
    notes: `Sold via invoice ${invoiceNumber}`,
    created_by: createdBy,
  }))

  const { error: stockError } = await supabase
    .from('dc_stock_ledger')
    .insert(dcStockDeductions)

  if (stockError) {
    // Rollback invoice and items if stock deduction fails
    await supabase.from('invoices').delete().eq('id', invoice.id)
    throw stockError
  }

  return {
    invoice,
    items: invoiceItems,
  }
}

/**
 * Get all DC sales for an agent
 */
export async function getDCSales(
  senderOrgId: string,
  agentUserId: string
): Promise<(Invoice & {
  customer: {
    id: string
    master_customer: {
      legal_name: string
      mobile: string | null
    }
  }
  invoice_items: (InvoiceItem & {
    master_products: {
      name: string
      sku: string
    }
  })[]
})[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customers(
        id,
        master_customers(legal_name, mobile)
      ),
      invoice_items(
        *,
        master_products(name, sku)
      )
    `)
    .eq('org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .eq('is_dc_sale', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    customer: item.customers,
  }))
}

/**
 * Get DC sales summary/stats for reporting
 */
export async function getDCSalesSummary(
  senderOrgId: string,
  agentUserId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total_sales: number
  total_invoices: number
  total_items_sold: number
}> {
  let query = supabase
    .from('invoices')
    .select('total_amount, invoice_items(quantity)')
    .eq('org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .eq('is_dc_sale', true)
    .eq('status', 'finalized')

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) throw error

  if (!data || data.length === 0) {
    return {
      total_sales: 0,
      total_invoices: 0,
      total_items_sold: 0,
    }
  }

  const total_sales = data.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const total_invoices = data.length
  const total_items_sold = data.reduce(
    (sum, inv) => sum + (inv as any).invoice_items.reduce(
      (itemSum: number, item: any) => itemSum + (item.quantity || 0),
      0
    ),
    0
  )

  return {
    total_sales,
    total_invoices,
    total_items_sold,
  }
}

