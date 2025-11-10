import { supabase } from '../supabase'
import type { MasterProduct } from './master-products'

export interface MasterProductReview {
  id: string
  master_product_id: string
  action: 'submitted' | 'approved' | 'rejected' | 'edited' | 'auto_passed' | 'migrated'
  reviewed_by: string | null
  reviewed_at: string
  note: string | null
  field_changes: Record<string, any> | null
  previous_approval_status: string | null
  new_approval_status: string | null
}

export interface ReviewMasterProductParams {
  master_product_id: string
  action: 'approve' | 'reject' | 'edit_and_approve'
  changes?: Record<string, any>
  note?: string
  hsn_code?: string
  reviewer_id: string
}

/**
 * Review a master product (approve/reject/edit)
 * Internal users only
 */
export async function reviewMasterProduct(
  params: ReviewMasterProductParams
): Promise<MasterProduct> {
  const { data: success, error } = await supabase.rpc(
    'review_master_product' as any,
    {
      p_master_product_id: params.master_product_id,
      p_action: params.action,
      p_changes: params.changes ? JSON.stringify(params.changes) : null,
      p_note: params.note || null,
      p_hsn_code: params.hsn_code || null,
      p_reviewer_id: params.reviewer_id,
    }
  )

  if (error) {
    throw new Error(`Failed to review master product: ${error.message}`)
  }

  if (!success) {
    throw new Error('Failed to review master product: action failed')
  }

  // Fetch the updated master product
  const { getMasterProduct } = await import('./master-products')
  return await getMasterProduct(params.master_product_id)
}

/**
 * Get pending reviews for internal users
 */
export async function getPendingReviews(): Promise<MasterProduct[]> {
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .in('approval_status', ['pending', 'auto_pass'])
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch pending reviews: ${error.message}`)
  }

  return (data || []) as MasterProduct[]
}

/**
 * Get review history for a master product
 */
export async function getMasterProductReviews(
  masterProductId: string
): Promise<MasterProductReview[]> {
  const { data, error } = await supabase
    .from('master_product_reviews')
    .select('*')
    .eq('master_product_id', masterProductId)
    .order('reviewed_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch master product reviews: ${error.message}`)
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    master_product_id: row.master_product_id,
    action: row.action,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at,
    note: row.note ?? null,
    field_changes: row.field_changes ? (typeof row.field_changes === 'string' ? JSON.parse(row.field_changes) : row.field_changes) : null,
    previous_approval_status: row.previous_approval_status ?? null,
    new_approval_status: row.new_approval_status ?? null,
  })) as MasterProductReview[]
}

