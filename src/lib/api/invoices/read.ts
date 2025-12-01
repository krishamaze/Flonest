import { supabase } from '../../supabase'
import type { Invoice, InvoiceItem } from '../../../types'
import { reloadSchemaCache } from './actions'

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
