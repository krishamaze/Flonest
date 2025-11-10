import { supabase } from '../supabase'
import type { Invoice, InvoiceItem } from '../../types'

export interface BlockedInvoice {
  invoice: Invoice
  errors: InvoiceValidationError[]
}

export interface InvoiceValidationError {
  item_index: number
  type: 'product_not_approved' | 'missing_hsn' | 'invalid_hsn' | 'product_not_found'
  message: string
  product_id?: string
  master_product_id?: string
  hsn_code?: string
}

export interface BlockedInvoiceFilters {
  org_id?: string
  date_from?: string
  date_to?: string
}

/**
 * Get blocked invoices (invoices with validation errors)
 * Internal users only - queries invoices with products that aren't approved or missing HSN
 */
export async function getBlockedInvoices(
  filters?: BlockedInvoiceFilters
): Promise<BlockedInvoice[]> {
  // First, get all draft invoices (these are the ones that might be blocked)
  let invoiceQuery = supabase
    .from('invoices')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })

  if (filters?.org_id) {
    invoiceQuery = invoiceQuery.eq('org_id', filters.org_id)
  }

  if (filters?.date_from) {
    invoiceQuery = invoiceQuery.gte('created_at', filters.date_from)
  }

  if (filters?.date_to) {
    invoiceQuery = invoiceQuery.lte('created_at', filters.date_to)
  }

  const { data: invoices, error: invoicesError } = await invoiceQuery

  if (invoicesError) {
    throw new Error(`Failed to fetch invoices: ${invoicesError.message}`)
  }

  if (!invoices || invoices.length === 0) {
    return []
  }

  // For each invoice, check its items for validation errors
  const blockedInvoices: BlockedInvoice[] = []

  for (const invoice of invoices) {
    // Get invoice items
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*, products(*, master_product:master_products(*))')
      .eq('invoice_id', invoice.id)

    if (itemsError) {
      console.error(`Error fetching items for invoice ${invoice.id}:`, itemsError)
      continue
    }

    if (!items || items.length === 0) {
      continue
    }

    const errors: InvoiceValidationError[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as any
      const product = item.products
      const masterProduct = product?.master_product

      if (!product) {
        errors.push({
          item_index: i + 1,
          type: 'product_not_found',
          message: 'Product not found',
          product_id: item.product_id,
        })
        continue
      }

      if (!masterProduct) {
        errors.push({
          item_index: i + 1,
          type: 'product_not_approved',
          message: 'Product is not linked to a master product',
          product_id: product.id,
        })
        continue
      }

      // Check approval status
      if (masterProduct.approval_status !== 'approved') {
        errors.push({
          item_index: i + 1,
          type: 'product_not_approved',
          message: `Master product is ${masterProduct.approval_status}`,
          product_id: product.id,
          master_product_id: masterProduct.id,
        })
        continue
      }

      // Check HSN code
      if (!masterProduct.hsn_code) {
        errors.push({
          item_index: i + 1,
          type: 'missing_hsn',
          message: 'Master product is missing HSN code',
          product_id: product.id,
          master_product_id: masterProduct.id,
        })
        continue
      }

      // Validate HSN code exists in hsn_master
      const { data: hsnData, error: hsnError } = await supabase
        .from('hsn_master')
        .select('hsn_code')
        .eq('hsn_code', masterProduct.hsn_code)
        .eq('is_active', true)
        .single()

      if (hsnError || !hsnData) {
        errors.push({
          item_index: i + 1,
          type: 'invalid_hsn',
          message: `HSN code ${masterProduct.hsn_code} is not found in HSN master`,
          product_id: product.id,
          master_product_id: masterProduct.id,
          hsn_code: masterProduct.hsn_code,
        })
      }
    }

    if (errors.length > 0) {
      blockedInvoices.push({
        invoice,
        errors,
      })
    }
  }

  return blockedInvoices
}

/**
 * Get validation errors for a specific invoice
 */
export async function getInvoiceValidationErrors(
  invoiceId: string
): Promise<InvoiceValidationError[]> {
  // Use the validate_invoice_items RPC function
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('org_id')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    throw new Error(`Invoice not found: ${invoiceError?.message}`)
  }

  // Get invoice items
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)

  if (itemsError) {
    throw new Error(`Failed to fetch invoice items: ${itemsError.message}`)
  }

  if (!items || items.length === 0) {
    return []
  }

  // Format items for RPC call
  const itemsJson = items.map((item: any) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    serial_tracked: item.serial_tracked || false,
    serials: item.serials || [],
  }))

  // Call validation RPC
  const { data: validationResult, error: validationError } = await supabase.rpc(
    'validate_invoice_items' as any,
    {
      p_org_id: invoice.org_id,
      p_items: JSON.stringify(itemsJson),
      p_allow_draft: false,
    }
  )

  if (validationError) {
    throw new Error(`Failed to validate invoice: ${validationError.message}`)
  }

  if (!validationResult || validationResult.valid) {
    return []
  }

  // Parse errors from RPC result
  const errors: InvoiceValidationError[] = []
  if (validationResult.errors && Array.isArray(validationResult.errors)) {
    for (const error of validationResult.errors) {
      errors.push({
        item_index: error.item_index || 0,
        type: error.type || 'product_not_found',
        message: error.message || 'Validation error',
        product_id: error.product_id,
        master_product_id: error.master_product_id,
        hsn_code: error.hsn_code,
      })
    }
  }

  return errors
}

