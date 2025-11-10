import { supabase } from '../supabase'

export interface HSNMaster {
  hsn_code: string
  description: string
  gst_rate: number
  category: string | null
  chapter_code: string | null
  is_active: boolean
  last_updated_at: string | null
  created_at: string | null
}

export interface SearchHSNParams {
  query?: string
  category?: string
  limit?: number
  offset?: number
}

/**
 * Get HSN master by HSN code
 */
export async function getHSNByCode(hsnCode: string): Promise<HSNMaster> {
  const { data, error } = await supabase
    .from('hsn_master' as any)
    .select('*')
    .eq('hsn_code', hsnCode)
    .eq('is_active', true)
    .single()

  if (error) {
    throw new Error(`Failed to fetch HSN: ${error.message}`)
  }

  if (!data) {
    throw new Error('HSN code not found')
  }

  return data as unknown as HSNMaster
}

/**
 * Search HSN codes
 */
export async function searchHSN(
  params: SearchHSNParams = {}
): Promise<HSNMaster[]> {
  let query = supabase
    .from('hsn_master' as any)
    .select('*')
    .eq('is_active', true)

  if (params.query) {
    query = query.or(
      `hsn_code.ilike.%${params.query}%,description.ilike.%${params.query}%`
    )
  }

  if (params.category) {
    query = query.eq('category', params.category)
  }

  if (params.limit) {
    query = query.limit(params.limit)
  }

  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  const { data, error } = await query.order('hsn_code', { ascending: true })

  if (error) {
    throw new Error(`Failed to search HSN: ${error.message}`)
  }

  return (data || []) as unknown as HSNMaster[]
}

/**
 * Get HSN codes by category
 */
export async function getHSNByCategory(category: string): Promise<HSNMaster[]> {
  const { data, error } = await supabase
    .from('hsn_master' as any)
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('hsn_code', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch HSN by category: ${error.message}`)
  }

  return (data || []) as unknown as HSNMaster[]
}

/**
 * Suggest HSN code from category using category_map
 */
export async function suggestHSNFromCategory(
  category: string
): Promise<HSNMaster | null> {
  // First, try to get suggested HSN from category_map
  const { data: categoryMap, error: categoryError } = await supabase
    .from('category_map' as any)
    .select('suggested_hsn_code')
    .eq('category_name', category)
    .single()

  const categoryMapData = categoryMap as unknown as { suggested_hsn_code?: string | null } | null
  if (categoryError || !categoryMapData?.suggested_hsn_code) {
    // Fallback: get first HSN from category
    const hsnList = await getHSNByCategory(category)
    return hsnList.length > 0 ? hsnList[0] : null
  }

  // Get the suggested HSN code
  try {
    return await getHSNByCode(categoryMapData.suggested_hsn_code)
  } catch (error) {
    // If suggested HSN doesn't exist, fallback to first HSN in category
    const hsnList = await getHSNByCategory(category)
    return hsnList.length > 0 ? hsnList[0] : null
  }
}

