import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { Invoice, InvoiceItem, InvoiceFormData, Org, CustomerWithMaster } from '../../types'
import { calculateItemGST, extractStateCodeFromGSTIN, getCustomerStateCode } from '../utils/gstCalculation'
import { isOrgGstEnabled } from '../utils/orgGst'
import { getProduct } from './products'
import type { ProductWithMaster } from '../../types'
import { clearDraftSessionId } from '../utils/draftSession'

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
 * Uses per-item GST calculation based on product's gst_rate
 */
export async function createInvoice(
  orgId: string,
  userId: string,
  data: InvoiceFormData,
  org: Org,
  customer: CustomerWithMaster
): Promise<Invoice> {
  // Determine org GST mode
  const gstEnabled = isOrgGstEnabled(org)
  
  // Get seller state code from org GSTIN or state field
  const sellerStateCode = org.gst_number 
    ? extractStateCodeFromGSTIN(org.gst_number) 
    : (org.state ? org.state.slice(0, 2) : null)

  // Get buyer state code with fallback logic
  const buyerStateCode = sellerStateCode 
    ? getCustomerStateCode(customer, sellerStateCode) 
    : null

  // Calculate subtotal
  const subtotal = data.items.reduce((sum, item) => sum + item.line_total, 0)

  // Initialize tax accumulators
  let cgst_amount = 0
  let sgst_amount = 0
  let igst_amount = 0

  // Calculate GST per item if org has GST enabled
  if (gstEnabled && sellerStateCode) {
    // Fetch master product data for each item to get GST rates
    for (const item of data.items) {
      try {
        const product = await getProduct(item.product_id) as ProductWithMaster
        
        // Get product's GST rate from master product
        const productGstRate = product.master_product?.gst_rate

        // Skip GST calculation if product has no GST rate
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

        // Accumulate tax amounts (already rounded to 2 decimals per item)
        cgst_amount += itemGst.cgst_amount
        sgst_amount += itemGst.sgst_amount
        igst_amount += itemGst.igst_amount
      } catch (error) {
        console.error(`Error fetching product ${item.product_id} for GST calculation:`, error)
        // Continue with other items even if one fails
      }
    }
  }

  // Round aggregated amounts to 2 decimals
  cgst_amount = Math.round(cgst_amount * 100) / 100
  sgst_amount = Math.round(sgst_amount * 100) / 100
  igst_amount = Math.round(igst_amount * 100) / 100

  // Calculate total
  const total_amount = subtotal + cgst_amount + sgst_amount + igst_amount

  // Generate invoice number if not provided
  const invoice_number = data.invoice_number || await generateInvoiceNumber(orgId)

  const invoiceData: InvoiceInsert = {
    org_id: orgId,
    customer_id: data.customer_id,
    invoice_number,
    subtotal,
    cgst_amount,
    sgst_amount,
    igst_amount,
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
    // Validate all products exist and belong to the organization before inserting
    const productIds = data.items.map(item => item.product_id)
    const { data: existingProducts, error: validationError } = await supabase
      .from('products')
      .select('id')
      .eq('org_id', orgId)
      .in('id', productIds)

    if (validationError) {
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      throw new Error(`Failed to validate products: ${validationError.message}`)
    }

    // Check if all products were found
    const foundProductIds = new Set(existingProducts?.map(p => p.id) || [])
    const missingProducts = productIds.filter(id => !foundProductIds.has(id))
    
    if (missingProducts.length > 0) {
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      throw new Error(`One or more products not found or do not belong to this organization: ${missingProducts.join(', ')}`)
    }

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
 * Reload PostgREST schema cache
 * Useful when schema cache becomes stale and relationship errors occur
 */
const reloadSchemaCache = async (): Promise<void> => {
  try {
    // Option 1: Via RPC function (recommended)
    // Type cast needed since RPC function types may not be generated yet
    await (supabase.rpc as any)('reload_schema_cache')
    // Wait for cache to reload
    await new Promise(resolve => setTimeout(resolve, 1000))
  } catch (error) {
    console.warn('Failed to reload schema cache via RPC, using fallback:', error)
    // Option 2: Fallback - trigger cache reload via dummy query
    try {
      await supabase.from('invoices').select('id').limit(1)
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (fallbackError) {
      console.warn('Fallback schema cache reload also failed:', fallbackError)
    }
  }
}

export async function getInvoiceById(invoiceId: string): Promise<Invoice & {
  items: (InvoiceItem & { product: any })[]
  customer?: any
}> {
  const loadInvoice = async (retryCount = 0): Promise<any> => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(
          *,
          product:master_products(*)
        ),
        customer:customers(
          *,
          master_customer:master_customers(*)
        )
      `)
      .eq('id', invoiceId)
      .single()

    if (error) {
      // Detect schema cache error specifically
      const isSchemaCacheError = 
        error.code === 'PGRST200' || 
        error.message?.includes('Could not find a relationship') ||
        error.message?.includes('schema cache') ||
        error.message?.includes('relationship') && error.message?.includes('schema')

      if (isSchemaCacheError && retryCount === 0) {
        console.warn('Schema cache stale, reloading...')
        await reloadSchemaCache()
        // Retry once after cache reload
        return loadInvoice(1)
      }

      throw new Error(`Failed to fetch invoice: ${error.message}`)
    }

    return data as any
  }

  return loadInvoice()
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

/**
 * Get draft invoice for a specific customer
 */
export async function getDraftInvoiceByCustomer(
  orgId: string,
  customerId: string
): Promise<(Invoice & { draft_data?: any }) | null> {
  const loadDraft = async (retryCount = 0): Promise<(Invoice & { draft_data?: any }) | null> => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, draft_data')
        .eq('org_id', orgId)
        .eq('customer_id', customerId)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        // Check for schema cache errors
        if ((error.code === 'PGRST200' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) && retryCount === 0) {
          console.warn('Schema cache stale for getDraftInvoiceByCustomer, reloading...')
          await reloadSchemaCache()
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadDraft(1)
        }
        
        if (error.code === 'PGRST116') {
          // No draft found
          return null
        }
        throw new Error(`Failed to fetch draft invoice: ${error.message}`)
      }

      return data as any
    } catch (error) {
      if (retryCount === 0 && (error instanceof Error && (error.message.includes('schema cache') || error.message.includes('does not exist')))) {
        console.warn('Schema cache error in getDraftInvoiceByCustomer, retrying...')
        await reloadSchemaCache()
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadDraft(1)
      }
      throw error
    }
  }

  return loadDraft()
}

/**
 * Load draft invoice data for form restoration
 */
export async function loadDraftInvoiceData(invoiceId: string): Promise<{
  customer_id: string
  draft_session_id?: string
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    line_total: number
    serials?: string[]
    serial_tracked?: boolean
  }>
} | null> {
  const loadDraft = async (retryCount = 0): Promise<any> => {
    const { data, error } = await supabase
      .from('invoices')
      .select('customer_id, draft_data, draft_session_id')
      .eq('id', invoiceId)
      .single()

    if (error) {
      // Detect schema cache error specifically
      const isSchemaCacheError = 
        error.code === 'PGRST200' || 
        error.message?.includes('Could not find a relationship') ||
        error.message?.includes('schema cache') ||
        error.message?.includes('relationship') && error.message?.includes('schema')

      if (isSchemaCacheError && retryCount === 0) {
        console.warn('Schema cache stale in loadDraftInvoiceData, reloading...')
        await reloadSchemaCache()
        // Retry once after cache reload
        return loadDraft(1)
      }

      throw new Error(`Failed to load draft invoice: ${error.message}`)
    }

    if (!data) {
      throw new Error('Invoice not found')
    }

    const invoiceData = data as any

    if (!invoiceData.draft_data) {
      return null
    }

    // Parse versioned draft_data JSONB
    const draftData = invoiceData.draft_data as any
    const draftContent = draftData.data || draftData

    return {
      customer_id: draftContent.customer_id,
      draft_session_id: invoiceData.draft_session_id,
      items: draftContent.items || [],
    }
  }

  return loadDraft()
}

/**
 * Validate invoice items before finalization
 */
export async function validateInvoiceItems(
  orgId: string,
  items: Array<{
    product_id: string
    quantity: number
    serials?: string[]
    serial_tracked?: boolean
  }>
): Promise<{
  valid: boolean
  errors: Array<{
    item_index: number
    type: string
    message: string
    product_id?: string
    serial?: string
    available_stock?: number
    requested_quantity?: number
  }>
}> {
  try {
    const { data, error } = await supabase.rpc('validate_invoice_items' as any, {
      p_org_id: orgId,
      p_items: items,
    })

    if (error) {
      throw new Error(`Failed to validate invoice items: ${error.message}`)
    }

    if (!data || typeof data !== 'object') {
      return { valid: true, errors: [] }
    }

    return {
      valid: data.valid || false,
      errors: data.errors || [],
    }
  } catch (error) {
    console.error('Error validating invoice items:', error)
    throw error
  }
}

/**
 * Re-validate draft invoice to check if items are now valid
 */
export async function revalidateDraftInvoice(
  invoiceId: string,
  orgId: string
): Promise<{
  valid: boolean
  errors: any[]
  updated: boolean
}> {
  try {
    // Load draft invoice with items
    const invoice = await getInvoiceById(invoiceId)
    
    if (!invoice || invoice.status !== 'draft') {
      throw new Error('Invoice not found or not a draft')
    }

    // Extract items for validation
    const items = (invoice.items || []).map((item: any) => ({
      product_id: item.product_id,
      quantity: item.quantity || 0,
      serials: item.serials || [],
      serial_tracked: item.product?.serial_tracked || false,
    }))

    // Validate items
    const validation = await validateInvoiceItems(orgId, items)

    // Check if status changed (was invalid, now valid)
    const invoiceData = invoice as any
    const wasInvalid = invoiceData.draft_data?.data?.has_validation_errors || false
    const isNowValid = validation.valid
    const updated = wasInvalid && isNowValid

    return {
      valid: validation.valid,
      errors: validation.errors,
      updated,
    }
  } catch (error) {
    console.error('Error re-validating draft invoice:', error)
    throw error
  }
}

/**
 * Wrap draft data with versioning
 * Preserves compatibility with existing draft_data structure
 */
function wrapDraftData(data: any): any {
  return {
    v: 1,
    data: data,
  }
}

/**
 * Auto-save invoice draft using draft_session_id
 * Updates existing draft if session ID matches, otherwise creates new draft
 * Uses manual check/update/insert since partial unique indexes aren't directly supported by Supabase upsert
 */
export async function autoSaveInvoiceDraft(
  orgId: string,
  userId: string,
  draftSessionId: string,
  draftData: {
    customer_id?: string
    items: Array<{
      product_id: string
      quantity: number
      unit_price: number
      line_total: number
      serials?: string[]
    }>
  }
): Promise<{ invoiceId: string; sessionId: string }> {
  try {
    // Wrap draft data with versioning (for compatibility with existing format)
    const wrappedDraftData = wrapDraftData(draftData)

    // Calculate totals from items
    const subtotal = draftData.items.reduce((sum, item) => sum + (item.line_total || 0), 0)

    // Check if draft with this session ID already exists
    const { data: existingDraft, error: selectError } = await supabase
      .from('invoices')
      .select('id, draft_session_id')
      .eq('draft_session_id', draftSessionId)
      .eq('org_id', orgId)
      .eq('status', 'draft')
      .maybeSingle() as any

    if (selectError && selectError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing draft: ${selectError.message}`)
    }

    if (existingDraft) {
      // Update existing draft with retry logic for schema cache errors
      const updateDraft = async (retryCount = 0): Promise<any> => {
        const { data: updated, error: updateError } = await supabase
          .from('invoices')
          .update({
            customer_id: draftData.customer_id || null,
            subtotal: subtotal,
            total_amount: subtotal,
            draft_data: wrappedDraftData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existingDraft as any).id)
          .select('id, draft_session_id')
          .single()

        if (updateError) {
          // Check for schema cache errors
          if ((updateError.code === 'PGRST200' || updateError.message?.includes('schema cache') || updateError.message?.includes('does not exist') || updateError.message?.includes('updated_at')) && retryCount === 0) {
            console.warn('Schema cache stale for autoSaveInvoiceDraft update, reloading...')
            await reloadSchemaCache()
            await new Promise(resolve => setTimeout(resolve, 1000))
            return updateDraft(1)
          }
          throw new Error(`Failed to update draft: ${updateError.message}`)
        }

        return updated
      }

      const updated = await updateDraft()

      const updatedData = updated as any
      return {
        invoiceId: updatedData.id,
        sessionId: updatedData.draft_session_id || draftSessionId,
      }
    } else {
      // Create new draft
      const { data: created, error: insertError } = await supabase
        .from('invoices')
        .insert({
          draft_session_id: draftSessionId,
          org_id: orgId,
          customer_id: draftData.customer_id || null,
          invoice_number: 'DRAFT-' + Date.now().toString(), // Temporary, will be replaced on finalize
          subtotal: subtotal,
          cgst_amount: 0, // Will be calculated on finalize
          sgst_amount: 0,
          igst_amount: 0,
          total_amount: subtotal,
          status: 'draft',
          created_by: userId,
          draft_data: wrappedDraftData,
        } as any)
        .select('id, draft_session_id')
        .single()

      if (insertError) {
        throw new Error(`Failed to create draft: ${insertError.message}`)
      }

      const createdData = created as any
      return {
        invoiceId: createdData.id,
        sessionId: createdData.draft_session_id || draftSessionId,
      }
    }
  } catch (error) {
    console.error('Error auto-saving invoice draft:', error)
    throw error
  }
}

/**
 * Delete a draft invoice
 * Only allows deletion of drafts (status = 'draft')
 */
export async function deleteDraft(invoiceId: string, orgId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('org_id', orgId)
      .eq('status', 'draft')

    if (error) {
      throw new Error(`Failed to delete draft: ${error.message}`)
    }

    // Clear session storage for this draft
    clearDraftSessionId(invoiceId)
  } catch (error) {
    console.error('Error deleting draft:', error)
    throw error
  }
}

/**
 * Clear draft session from sessionStorage
 * Helper function exported for use in components
 */
export { clearDraftSessionId } from '../utils/draftSession'

