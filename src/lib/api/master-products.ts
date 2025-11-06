import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type MasterProductRow = {
  id: string
  sku: string
  barcode_ean: string | null
  name: string
  category: string | null
  hsn_code: string | null
  base_unit: string
  base_price: number | null
  gst_rate: number | null
  gst_type: string | null
  status: string
  created_at: string | null
  updated_at: string | null
}

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
  const { data, error } = await supabase.rpc('search_master_products', {
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

  return data as MasterProduct
}


