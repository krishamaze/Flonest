import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { Invoice, InvoiceItem, InvoiceFormData, Org, CustomerWithMaster } from '../../types'
import { calculateTax, createTaxContext, productToLineItem } from '../utils/taxCalculationService'
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

  // Get the last invoice number for today using ilike for case-insensitive matching
  const { data: lastInvoices, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('org_id', orgId)
    .ilike('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)

  if (error) {
    // If error is "not found", that's okay - we'll start with 001
    if (error.code === 'PGRST116') {
      return `${prefix}-001`
    }
    throw new Error(`Failed to generate invoice number: ${error.message}`)
  }

  if (!lastInvoices || lastInvoices.length === 0) {
    return `${prefix}-001`
  }

  const lastInvoice = lastInvoices[0]
  
  if (!lastInvoice || !lastInvoice.invoice_number) {
    return `${prefix}-001`
  }

  // Extract sequence number and increment
  const lastSeq = parseInt(lastInvoice.invoice_number.slice(-3)) || 0
  const nextSeq = String(lastSeq + 1).padStart(3, '0')

  return `${prefix}-${nextSeq}`
}

/**
 * Create a new invoice (draft or finalized)
 * Uses new Tax Calculation Service for comprehensive GST handling (SEZ, Intrastate, Interstate)
 */
export async function createInvoice(
  orgId: string,
  userId: string,
  data: InvoiceFormData,
  org: Org,
  customer: CustomerWithMaster
): Promise<Invoice> {
  // Create tax calculation context using new schema fields
  const taxContext = createTaxContext(org, customer)

  // Fetch products and convert to line items for tax calculation
  const lineItems = await Promise.all(
    data.items.map(async (item) => {
      try {
        const product = await getProduct(item.product_id) as ProductWithMaster & {
          tax_rate?: number | null
          hsn_sac_code?: string | null
        }
        
        // Use product.tax_rate (org-specific) if available, otherwise fallback to master_product.gst_rate
        const taxRate = product?.tax_rate ?? product?.master_product?.gst_rate ?? null
        const hsnSacCode = product?.hsn_sac_code ?? product?.master_product?.hsn_code ?? null
        
        return productToLineItem(
          item.line_total,
          taxRate,
          hsnSacCode
        )
      } catch (error) {
        console.error(`Error fetching product ${item.product_id} for tax calculation:`, error)
        // Return zero-tax line item if product fetch fails
        return productToLineItem(item.line_total, null, null)
      }
    })
  )

  // Calculate tax using new service
  const taxResult = calculateTax(taxContext, lineItems, true) // GST-inclusive pricing

  // Extract tax amounts
  const subtotal = taxResult.subtotal
  const cgst_amount = taxResult.cgst_amount
  const sgst_amount = taxResult.sgst_amount
  const igst_amount = taxResult.igst_amount
  const total_amount = taxResult.grand_total

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
    // Validate all products exist and belong to the organization, and get their master_product_id
    const productIds = data.items.map(item => item.product_id)
    const { data: existingProducts, error: validationError } = await supabase
      .from('products')
      .select('id, master_product_id')
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

    // Create a map of product_id -> master_product_id for quick lookup
    const productMasterMap = new Map<string, string | null>()
    existingProducts?.forEach(p => {
      productMasterMap.set(p.id, p.master_product_id)
    })

    // Auto-link products without master_product_id to master products
    const productsNeedingLink = data.items
      .map(item => item.product_id)
      .filter(productId => {
        const masterProductId = productMasterMap.get(productId)
        return !masterProductId
      })

    if (productsNeedingLink.length > 0) {
      // Auto-create master products and link them
      for (const productId of productsNeedingLink) {
        try {
          const { data: masterProductId, error: linkError } = await supabase.rpc('auto_link_product_to_master' as any, {
            p_product_id: productId,
            p_org_id: orgId,
            p_user_id: userId,
          })

          if (linkError) {
            console.error(`Failed to auto-link product ${productId}:`, linkError)
            throw new Error(`Failed to link product to master catalog: ${linkError.message}`)
          }

          if (masterProductId) {
            productMasterMap.set(productId, masterProductId as string)
          }
        } catch (error) {
          // Rollback: delete the invoice
          await supabase.from('invoices').delete().eq('id', invoice.id)
          throw error instanceof Error 
            ? error 
            : new Error(`Failed to auto-link product ${productId} to master catalog`)
        }
      }
    }

    // Build invoice items using master_product_id instead of product_id
    const itemsData: InvoiceItemInsert[] = data.items.map((item) => {
      const masterProductId = productMasterMap.get(item.product_id)
      
      if (!masterProductId) {
        throw new Error(`Product ${item.product_id} does not have a master product and could not be auto-linked.`)
      }

      return {
        invoice_id: invoice.id,
        product_id: masterProductId, // Use master_product_id, not products.id
        quantity: item.quantity,
        unit: 'pcs', // Default unit, should come from product
        unit_price: item.unit_price,
        total_amount: item.line_total, // Map line_total to total_amount
      }
    })

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

  // Validate items before finalization (block pending masters)
  const items = (invoice.items || []) as InvoiceItem[]
  if (items.length > 0) {
    // Note: invoice_items.product_id stores master_product_id, not org product_id
    // We need to find org products that have these master_product_ids
    const masterProductIds = items.map(item => item.product_id)
    
    // Get org products that have these master_product_ids
    const { data: orgProducts } = await supabase
      .from('products')
      .select('id, master_product_id, serial_tracked')
      .in('master_product_id', masterProductIds)
      .eq('org_id', orgId)
      .eq('status', 'active')

    // Create a map: master_product_id -> org product
    const masterToOrgProductMap = new Map(
      (orgProducts || []).map(p => [p.master_product_id, p])
    )

    // Build validation items using org product_ids
    // For each invoice item (which has master_product_id), find the corresponding org product
    const validationItems: Array<{
      product_id: string
      quantity: number
      serials: string[]
      serial_tracked: boolean
    }> = []

    for (const item of items) {
      const orgProduct = masterToOrgProductMap.get(item.product_id)
      
      if (!orgProduct) {
        // No org product found for this master_product_id
        // This shouldn't happen if invoice was created correctly, but handle it
        throw new Error(
          `Cannot finalize invoice: No org product found for master product ${item.product_id}. ` +
          `This may indicate a data inconsistency. Please contact support.`
        )
      }

      validationItems.push({
        product_id: orgProduct.id, // Use org product_id for validation
        quantity: item.quantity || 1,
        serials: [], // Serial validation handled separately if needed
        serial_tracked: orgProduct.serial_tracked || false,
      })
    }

    // Validate with allowDraft=false to block pending masters
    const validation = await validateInvoiceItems(orgId, validationItems, false)

    if (!validation.valid) {
      const masterProductErrors = validation.errors.filter(e => 
        e.type === 'master_product_not_approved' || 
        e.type === 'master_product_missing_hsn' ||
        e.type === 'master_product_not_linked' ||
        e.type === 'master_product_invalid_hsn'
      )

      if (masterProductErrors.length > 0) {
        throw new Error(
          `Cannot finalize invoice: ${masterProductErrors.length} product(s) pending master approval or missing HSN code. ` +
          `Please wait for approval or contact support.`
        )
      }

      // Other validation errors (shouldn't happen if draft was valid, but check anyway)
      const otherErrors = validation.errors.filter(e => 
        e.type !== 'master_product_not_approved' && 
        e.type !== 'master_product_missing_hsn' &&
        e.type !== 'master_product_not_linked' &&
        e.type !== 'master_product_invalid_hsn'
      )

      if (otherErrors.length > 0) {
        throw new Error(`Cannot finalize invoice: ${otherErrors[0].message}`)
      }
    }
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

  return updated
}

/**
 * Translate RPC error messages to user-friendly guidance
 * Maps backend error strings to actionable frontend messages
 */
function getUserFriendlyError(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message
  const lowerMessage = message.toLowerCase()

  // Workflow enforcement errors
  if (lowerMessage.includes('must be finalized') || lowerMessage.includes('status "draft"')) {
    return 'Invoice must be finalized before posting. Please finalize the invoice first.'
  }
  if (lowerMessage.includes('already posted')) {
    return 'Invoice is already posted to inventory.'
  }
  if (lowerMessage.includes('cancelled invoice')) {
    return 'Cannot post cancelled invoice.'
  }

  // Stock validation errors
  if (lowerMessage.includes('insufficient stock')) {
    // Extract product name and quantities if available
    const match = message.match(/Insufficient stock for product "([^"]+)"\. Available: (\d+), Requested: (\d+)/)
    if (match) {
      return `Insufficient stock for "${match[1]}". Available: ${match[2]}, Requested: ${match[3]}. Please reduce quantity or add stock.`
    }
    return 'Insufficient stock available. Please reduce quantity or add stock to inventory.'
  }
  if (lowerMessage.includes('insufficient serials')) {
    const match = message.match(/Insufficient serials linked to invoice item for product ([^.]+)\. Linked: (\d+), Required: (\d+)/)
    if (match) {
      return `Insufficient serials linked for ${match[1]}. Linked: ${match[2]}, Required: ${match[3]}. Please link more serial numbers.`
    }
    return 'Insufficient serial numbers linked. Please link the required serial numbers to the invoice items.'
  }

  // Product mapping errors
  if (lowerMessage.includes('no active org product found') || lowerMessage.includes('product mapping not found')) {
    return 'Product not found in organization inventory. Please verify the product is active and linked correctly.'
  }

  // General validation errors
  if (lowerMessage.includes('no items')) {
    return 'Cannot post invoice with no items. Please add items to the invoice.'
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('access denied')) {
    return 'Invoice not found or access denied. Please refresh and try again.'
  }

  // Return original message if no specific mapping found
  return message
}

/**
 * Post a sales invoice to inventory (Finalized → Posted)
 * Performs atomic stock deduction and serial number updates.
 * 
 * WORKFLOW: Only allows 'finalized' → 'posted' transition
 * ATOMICITY: All operations (stock deduction + status update) succeed or fail together
 * CONCURRENCY: Row-level locking prevents race conditions
 */
export async function postSalesInvoice(
  invoiceId: string,
  orgId: string,
  userId: string
): Promise<{ success: boolean; invoice_id: string; status: string; stock_entries_created?: number }> {
  try {
    // Type assertion needed until database types are regenerated
    const { data, error } = await (supabase.rpc as any)('post_sales_invoice', {
      p_invoice_id: invoiceId,
      p_org_id: orgId,
      p_user_id: userId
    })

    if (error) {
      // Translate database errors to user-friendly messages
      throw new Error(getUserFriendlyError(error.message))
    }

    if (!data || !data.success) {
      throw new Error('Failed to post invoice. Please try again.')
    }

    return data as { success: boolean; invoice_id: string; status: string; stock_entries_created?: number }
  } catch (error) {
    // Re-throw with user-friendly error message
    if (error instanceof Error) {
      throw new Error(getUserFriendlyError(error))
    }
    throw error
  }
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
          product:products(
            *,
            master_product:master_products(*)
          )
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
  }>,
  allowDraft: boolean = false
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
    master_product_id?: string
    approval_status?: string
    hsn_code?: string
  }>
}> {
  try {
    const { data, error } = await supabase.rpc('validate_invoice_items' as any, {
      p_org_id: orgId,
      p_items: items,
      p_allow_draft: allowDraft,
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
    // For draft invoices, allow pending master products
    const validation = await validateInvoiceItems(orgId, items, true)

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
  _userId: string,
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

