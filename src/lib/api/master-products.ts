import { supabase } from '../supabase'

export interface MasterProduct {
  id: string
  sku: string
  barcode_ean: string | null
  name: string
  category: string | null
  hsn_code: string | null
  base_unit: string
  base_price: number | null
  gst_rate: number | null
  gst_type: 'goods' | 'services' | null
  status: 'active' | 'inactive' | 'discontinued'
  approval_status: 'pending' | 'auto_pass' | 'approved' | 'rejected'
  created_by: string | null
  submitted_org_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SearchMasterProductsParams {
  q?: string
  sku?: string
  ean?: string
  category?: string
  limit?: number
  offset?: number
  include_pending?: boolean
}

export interface SubmitMasterProductSuggestionParams {
  name: string
  sku: string
  barcode_ean?: string
  category?: string
  suggested_hsn_code?: string
  base_unit?: string
  base_price?: number
  org_id: string
  user_id: string
}

/**
 * Search master products using the RPC function
 * Returns only approved products for org users, can include pending for internal users
 */
export async function searchMasterProducts(
  params: SearchMasterProductsParams = {}
): Promise<MasterProduct[]> {
  const { data, error } = await supabase.rpc('search_master_products' as any, {
    search_query: params.q || null,
    search_sku: params.sku || null,
    search_ean: params.ean || null,
    search_category: params.category || null,
    result_limit: params.limit || 50,
    result_offset: params.offset || 0,
    include_pending: params.include_pending || false,
  })

  if (error) {
    throw new Error(`Failed to search master products: ${error.message}`)
  }

  return (data || []) as MasterProduct[]
}

/**
 * Get a single master product by ID
 * RLS will filter based on user permissions (only approved for org users)
 */
export async function getMasterProduct(id: string): Promise<MasterProduct> {
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch master product: ${error.message}`)
  }

  if (!data) {
    throw new Error('Master product not found')
  }

  // Map database row to MasterProduct interface
  const row = data as any
  return {
    id: row.id,
    sku: row.sku,
    barcode_ean: row.barcode_ean ?? null,
    name: row.name,
    category: row.category ?? null,
    hsn_code: row.hsn_code ?? null,
    base_unit: row.base_unit ?? 'pcs',
    base_price: row.base_price ?? null,
    gst_rate: row.gst_rate ?? null,
    gst_type: (row.gst_type as 'goods' | 'services' | null) ?? null,
    status: (row.status as 'active' | 'inactive' | 'discontinued') ?? 'active',
    approval_status: (row.approval_status as 'pending' | 'auto_pass' | 'approved' | 'rejected') ?? 'pending',
    created_by: row.created_by ?? null,
    submitted_org_id: row.submitted_org_id ?? null,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

/**
 * Submit a master product suggestion for review
 */
export async function submitMasterProductSuggestion(
  params: SubmitMasterProductSuggestionParams
): Promise<MasterProduct> {
  const { data: masterProductId, error } = await supabase.rpc(
    'submit_master_product_suggestion' as any,
    {
      p_name: params.name,
      p_sku: params.sku,
      p_org_id: params.org_id,
      p_user_id: params.user_id,
      p_barcode_ean: params.barcode_ean || null,
      p_category: params.category || null,
      p_suggested_hsn_code: params.suggested_hsn_code || null,
      p_base_unit: params.base_unit || 'pcs',
      p_base_price: params.base_price || null,
    }
  )

  if (error) {
    throw new Error(`Failed to submit master product suggestion: ${error.message}`)
  }

  if (!masterProductId) {
    throw new Error('Failed to create master product: no ID returned')
  }

  // Fetch the created master product
  return await getMasterProduct(masterProductId as string)
}

/**
 * Get pending master products for an org (their own submissions)
 */
export async function getPendingMasterProducts(orgId: string): Promise<MasterProduct[]> {
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .eq('submitted_org_id', orgId)
    .in('approval_status', ['pending', 'auto_pass', 'rejected'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch pending master products: ${error.message}`)
  }

  return (data || []) as MasterProduct[]
}

/**
 * Cancel a master product submission (set status to inactive)
 */
export async function cancelMasterProductSubmission(
  masterProductId: string
): Promise<void> {
  const { error } = await supabase
    .from('master_products')
    .update({ status: 'inactive' })
    .eq('id', masterProductId)
    .eq('approval_status', 'pending')

  if (error) {
    throw new Error(`Failed to cancel master product submission: ${error.message}`)
  }
}


