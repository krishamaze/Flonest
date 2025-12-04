import { supabase } from '../supabase'

/**
 * Reactive Entry Service
 * Implements the "Cascade Lookup" protocol for lightning-fast product entry
 * 
 * Architecture:
 * - Level 1: Serial Number lookup (org-scoped, instant product lock)
 * - Level 2: Product Code/SKU lookup (global/local, auto-fill HSN/tax)
 * - Level 3: Unknown → Create New Product modal
 */

export type EntryResolution =
  | { 
      type: 'SERIAL_FOUND'
      data: {
        found: boolean
        lookup_type: 'serial_number'
        product_id: string
        product_name: string
        product_sku: string
        selling_price: number | null
        hsn_code: string | null
        gst_rate: number | null
      }
      action: 'LOCK_SERIAL' // Auto-fill & focus "Price" field
    }
  | { 
      type: 'PRODUCT_FOUND'
      data: {
        found: boolean
        lookup_type: 'product_code'
        product_id: string
        master_product_id: string | null
        product_name: string
        product_sku: string
        selling_price: number | null
        hsn_code: string | null
        gst_rate: number | null
        category_id: string | null
        category_name: string | null
      }
      source: 'master' | 'org'
      action: 'LOCK_PRODUCT' // Auto-fill Description & focus "Serial/Qty" field
    }
  | { 
      type: 'UNKNOWN'
      query: string
      action: 'CREATE_NEW' // Open "New Product Modal" with Category Selector
    }

/**
 * Resolve user input using cascade lookup protocol
 * 
 * @param query - User input (Serial Number, SKU, or EAN)
 * @param orgId - Organization ID for scoping
 * @returns EntryResolution with action directive
 */
export async function resolveEntry(
  query: string,
  orgId: string
): Promise<EntryResolution> {
  if (!query || !query.trim()) {
    return {
      type: 'UNKNOWN',
      query: '',
      action: 'CREATE_NEW'
    }
  }

  const trimmedQuery = query.trim()

  // Level 1: Serial Number Lookup (Local, Org-Scoped)
  // SECURITY: Function validates org_id server-side against current_user_org_id()
  try {
    const { data: serialData, error: serialError } = await supabase.rpc(
      'lookup_serial_number',
      {
        p_org_id: orgId,
        p_serial_number: trimmedQuery
      }
    ).single()

    // Handle security errors (tenant isolation breach)
    if (serialError?.message?.includes('Access denied') || serialError?.message?.includes('organization')) {
      throw new Error(`Security error: ${serialError.message}`)
    }

    if (!serialError && serialData?.found) {
      return {
        type: 'SERIAL_FOUND',
        data: {
          found: serialData.found,
          lookup_type: serialData.lookup_type as 'serial_number',
          product_id: serialData.product_id,
          product_name: serialData.product_name || '',
          product_sku: serialData.product_sku || '',
          selling_price: serialData.selling_price,
          hsn_code: serialData.hsn_code,
          gst_rate: serialData.gst_rate
        },
        action: 'LOCK_SERIAL'
      }
    }
  } catch (error) {
    // Continue to Level 2 if serial lookup fails or returns no result
    console.warn('[ReactiveEntry] Serial lookup failed:', error)
  }

  // Level 2: Product Code/SKU Lookup (Global/Local)
  // SECURITY: Function validates org_id server-side against current_user_org_id()
  try {
    const { data: productData, error: productError } = await supabase.rpc(
      'lookup_product_code',
      {
        p_org_id: orgId,
        p_code: trimmedQuery
      }
    ).single()

    // Handle security errors (tenant isolation breach)
    if (productError?.message?.includes('Access denied') || productError?.message?.includes('organization')) {
      throw new Error(`Security error: ${productError.message}`)
    }

    if (!productError && productData?.found) {
      // Determine source (master_product_id indicates global master)
      const source: 'master' | 'org' = productData.master_product_id ? 'master' : 'org'

      return {
        type: 'PRODUCT_FOUND',
        data: {
          found: productData.found,
          lookup_type: productData.lookup_type as 'product_code',
          product_id: productData.product_id,
          master_product_id: productData.master_product_id,
          product_name: productData.product_name || '',
          product_sku: productData.product_sku || '',
          selling_price: productData.selling_price,
          hsn_code: productData.hsn_code,
          gst_rate: productData.gst_rate,
          category_id: productData.category_id,
          category_name: productData.category_name
        },
        source,
        action: 'LOCK_PRODUCT'
      }
    }
  } catch (error) {
    // Continue to Level 3 if product lookup fails or returns no result
    console.warn('[ReactiveEntry] Product lookup failed:', error)
  }

  // Level 3: Unknown → Create New Product
  return {
    type: 'UNKNOWN',
    query: trimmedQuery,
    action: 'CREATE_NEW'
  }
}

/**
 * Debounced resolve entry (for real-time input)
 * Returns a debounced version that waits for user to pause typing
 * 
 * @param delayMs - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced resolver function
 */
export function createDebouncedResolver(delayMs: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return async (
    query: string,
    orgId: string,
    onResolve: (resolution: EntryResolution) => void
  ): Promise<void> => {
    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Set new timeout
    timeoutId = setTimeout(async () => {
      try {
        const resolution = await resolveEntry(query, orgId)
        onResolve(resolution)
      } catch (error) {
        console.error('[ReactiveEntry] Resolution error:', error)
        // On error, treat as UNKNOWN
        onResolve({
          type: 'UNKNOWN',
          query,
          action: 'CREATE_NEW'
        })
      }
    }, delayMs)
  }
}

/** Category spec field definition (platform-configurable) */
export interface CategorySpecField {
  name: string
  label: string
  type: 'text' | 'select' | 'number'
  options?: string[]
  required?: boolean
  order?: number
}

/** Category specs schema (platform-configurable) */
export interface CategorySpecsSchema {
  fields: CategorySpecField[]
}

/** Master category with specs schema */
export interface MasterCategoryWithSpecs {
  id: string
  name: string
  hsn_code: string
  gst_rate: number
  gst_type: 'goods' | 'services'
  description: string | null
  parent_category_id: string | null
  specs_schema: CategorySpecsSchema | null
}

/**
 * Get all master categories for category selector
 * Used when user needs to create a new product
 * Includes specs_schema for dynamic form field rendering
 * Note: specs_schema column may not exist until migration is applied
 */
export async function getMasterCategories(): Promise<MasterCategoryWithSpecs[]> {
  const { data, error } = await supabase
    .from('master_categories')
    .select('id, name, hsn_code, gst_rate, gst_type, description, parent_category_id')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch master categories: ${error.message}`)
  }

  // Filter out null gst_type and cast to expected type
  // specs_schema will be null until migration adds the column
  return (data || []).filter(cat => cat.gst_type !== null).map(cat => ({
    ...cat,
    gst_type: cat.gst_type as 'goods' | 'services',
    specs_schema: (cat as Record<string, unknown>).specs_schema as CategorySpecsSchema | null ?? null
  }))
}

