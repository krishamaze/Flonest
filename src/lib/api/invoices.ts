import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { Invoice, InvoiceItem, InvoiceFormData } from '../../types'
import { calculateGST, extractStateCodeFromGSTIN, getGSTRate } from '../utils/gstCalculation'

type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert']

/**
 * Generate invoice number for an organization
 * Format: INV-YYYYMMDD-XXX (e.g., INV-20251106-001)
 */
async function generateInvoiceNumber(orgId: string): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `INV-${dateStr}`

  // Get the last invoice number for today
  const { data: lastInvoice, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('org_id', orgId)
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to generate invoice number: ${error.message}`)
  }

  if (!lastInvoice) {
    return `${prefix}-001`
  }

  // Extract sequence number and increment
  const lastSeq = parseInt(lastInvoice.invoice_number.slice(-3)) || 0
  const nextSeq = String(lastSeq + 1).padStart(3, '0')

  return `${prefix}-${nextSeq}`
}

/**
 * Create a new invoice (draft or finalized)
 */
export async function createInvoice(
  orgId: string,
  userId: string,
  data: InvoiceFormData,
  orgState?: string,
  orgGstEnabled: boolean = false,
  customerStateCode?: string | null
): Promise<Invoice> {
  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + item.line_total, 0)

  // Calculate GST if enabled
  let cgst_amount = 0
  let sgst_amount = 0
  const gstRate = getGSTRate(orgGstEnabled)
  
  if (gstRate > 0 && orgState) {
    const sellerStateCode = extractStateCodeFromGSTIN(orgState) || orgState.slice(0, 2)
    const gstCalc = calculateGST(subtotal, gstRate, sellerStateCode, customerStateCode)
    cgst_amount = gstCalc.cgst_amount
    sgst_amount = gstCalc.sgst_amount
  }

  const total_amount = subtotal + cgst_amount + sgst_amount

  // Generate invoice number if not provided
  const invoice_number = data.invoice_number || await generateInvoiceNumber(orgId)

  const invoiceData: InvoiceInsert = {
    org_id: orgId,
    customer_id: data.customer_id,
    invoice_number,
    subtotal,
    cgst_amount,
    sgst_amount,
    total_amount,
    status: 'draft',
    created_by: userId,
  }

  // Create invoice and items in a transaction
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert([invoiceData])
    .select()
    .single()

  if (invoiceError) {
    // Check for unique constraint violation
    if (invoiceError.code === '23505') {
      throw new Error(`Invoice number "${invoice_number}" already exists`)
    }
    throw new Error(`Failed to create invoice: ${invoiceError.message}`)
  }

  // Create invoice items
  if (data.items.length > 0) {
    const itemsData: InvoiceItemInsert[] = data.items.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsData)

    if (itemsError) {
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      throw new Error(`Failed to create invoice items: ${itemsError.message}`)
    }
  }

  return invoice
}

/**
 * Finalize an invoice (changes status from draft to finalized)
 * Also deducts stock from inventory
 */
export async function finalizeInvoice(invoiceId: string, orgId: string): Promise<Invoice> {
  // Get invoice with items
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      items:invoice_items(*)
    `)
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (invoiceError || !invoice) {
    throw new Error('Invoice not found')
  }

  if (invoice.status !== 'draft') {
    throw new Error(`Cannot finalize invoice with status: ${invoice.status}`)
  }

  // Update invoice status
  const { data: updated, error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'finalized' })
    .eq('id', invoiceId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to finalize invoice: ${updateError.message}`)
  }

  // TODO: Deduct stock from inventory when invoice is finalized
  // This will be implemented when we integrate with stock_ledger

  return updated
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(invoiceId: string, orgId: string): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to cancel invoice: ${error.message}`)
  }

  return data
}

/**
 * Get invoice by ID with items and customer
 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice & {
  items: (InvoiceItem & { product: any })[]
  customer?: any
}> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      items:invoice_items(
        *,
        product:products(*)
      ),
      customer:customers(
        *,
        master_customer:master_customers(*)
      )
    `)
    .eq('id', invoiceId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch invoice: ${error.message}`)
  }

  return data as any
}

/**
 * Get all invoices for an organization
 */
export async function getInvoicesByOrg(
  orgId: string,
  filters?: {
    status?: 'draft' | 'finalized' | 'cancelled'
    customer_id?: string
  }
): Promise<(Invoice & { customer?: any })[]> {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(
        *,
        master_customer:master_customers(*)
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.customer_id) {
    query = query.eq('customer_id', filters.customer_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch invoices: ${error.message}`)
  }

  return (data || []) as any
}

