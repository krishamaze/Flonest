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
}

/**
 * Search master products using the RPC function
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
  })

  if (error) {
    throw new Error(`Failed to search master products: ${error.message}`)
  }

  return (data || []) as MasterProduct[]
}

/**
 * Get a single master product by ID
 */
export async function getMasterProduct(id: string): Promise<MasterProduct> {
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error) {
    throw new Error(`Failed to fetch master product: ${error.message}`)
  }

  if (!data) {
    throw new Error('Master product not found')
  }

  // Map database row to MasterProduct interface
  return {
    id: data.id,
    sku: data.sku,
    barcode_ean: data.barcode_ean,
    name: data.name,
    category: data.category,
    hsn_code: data.hsn_code,
    base_unit: data.base_unit,
    base_price: data.base_price,
    gst_rate: data.gst_rate,
    gst_type: data.gst_type as 'goods' | 'services' | null,
    status: data.status as 'active' | 'inactive' | 'discontinued',
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}


