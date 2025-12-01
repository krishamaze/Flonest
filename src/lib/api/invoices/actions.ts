import { supabase } from '../../supabase'

/**
 * Reload PostgREST schema cache
 * Useful when schema cache becomes stale and relationship errors occur
 */
export async function reloadSchemaCache(): Promise<void> {
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

/**
 * Generate invoice number for an organization
 * Format: INV-YYYYMMDD-XXX (e.g., INV-20251106-001)
 */
export async function generateInvoiceNumber(orgId: string): Promise<string> {
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
 * Translate RPC error messages to user-friendly guidance
 * Maps backend error strings to actionable frontend messages
 */
export function getUserFriendlyError(error: Error | string): string {
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
 * Wrap draft data with versioning
 * Preserves compatibility with existing draft_data structure
 * Internal helper - not exported
 */
export function wrapDraftData(data: any): any {
  return {
    v: 1,
    data: data,
  }
}
