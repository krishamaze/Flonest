import { supabase } from '../supabase'
import type { HSNMaster } from '../../types'

export interface HSNFilters {
  search?: string
  category?: string
  gst_rate?: number
  is_active?: boolean
}

export interface CreateHSNCodeData {
  hsn_code: string
  description: string
  gst_rate: number
  category?: string
  chapter_code?: string
}

export interface UpdateHSNCodeData {
  description?: string
  gst_rate?: number
  category?: string
  chapter_code?: string
  is_active?: boolean
}

/**
 * Get HSN codes with optional filters
 * Internal users only (enforced by RLS)
 */
export async function getHSNCodes(filters?: HSNFilters): Promise<HSNMaster[]> {
  let query = supabase
    .from('hsn_master')
    .select('*')
    .order('hsn_code', { ascending: true })

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  } else {
    // Default to active only if not specified
    query = query.eq('is_active', true)
  }

  if (filters?.search) {
    const search = filters.search.toLowerCase()
    query = query.or(`hsn_code.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.gst_rate !== undefined) {
    query = query.eq('gst_rate', filters.gst_rate)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch HSN codes: ${error.message}`)
  }

  return (data || []) as HSNMaster[]
}

/**
 * Get a single HSN code by code
 */
export async function getHSNCode(hsnCode: string): Promise<HSNMaster | null> {
  const { data, error } = await supabase
    .from('hsn_master')
    .select('*')
    .eq('hsn_code', hsnCode)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch HSN code: ${error.message}`)
  }

  return data as HSNMaster
}

/**
 * Create a new HSN code
 * Internal users only (enforced by RLS)
 */
export async function createHSNCode(data: CreateHSNCodeData): Promise<HSNMaster> {
  const { data: hsn, error } = await supabase
    .from('hsn_master')
    .insert([{
      hsn_code: data.hsn_code,
      description: data.description,
      gst_rate: data.gst_rate,
      category: data.category || null,
      chapter_code: data.chapter_code || null,
      is_active: true,
    }])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`HSN code "${data.hsn_code}" already exists`)
    }
    throw new Error(`Failed to create HSN code: ${error.message}`)
  }

  return hsn as HSNMaster
}

/**
 * Update an existing HSN code
 * Internal users only (enforced by RLS)
 */
export async function updateHSNCode(
  hsnCode: string,
  data: UpdateHSNCodeData
): Promise<HSNMaster> {
  const updateData: any = {}
  
  if (data.description !== undefined) updateData.description = data.description
  if (data.gst_rate !== undefined) updateData.gst_rate = data.gst_rate
  if (data.category !== undefined) updateData.category = data.category || null
  if (data.chapter_code !== undefined) updateData.chapter_code = data.chapter_code || null
  if (data.is_active !== undefined) updateData.is_active = data.is_active

  updateData.last_updated_at = new Date().toISOString()

  const { data: hsn, error } = await supabase
    .from('hsn_master')
    .update(updateData)
    .eq('hsn_code', hsnCode)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`HSN code "${hsnCode}" not found`)
    }
    throw new Error(`Failed to update HSN code: ${error.message}`)
  }

  return hsn as HSNMaster
}

/**
 * Delete (soft delete) an HSN code by setting is_active to false
 * Internal users only (enforced by RLS)
 */
export async function deleteHSNCode(hsnCode: string): Promise<void> {
  const { error } = await supabase
    .from('hsn_master')
    .update({ is_active: false, last_updated_at: new Date().toISOString() })
    .eq('hsn_code', hsnCode)

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`HSN code "${hsnCode}" not found`)
    }
    throw new Error(`Failed to delete HSN code: ${error.message}`)
  }
}

