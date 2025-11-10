import { supabase } from '../supabase'
import type { MasterProduct } from './master-products'

export interface SubmissionStats {
  total: number
  pending: number
  approved: number
  rejected: number
  byDay: Array<{
    date: string
    count: number
  }>
}

export interface SubmissionAnomaly {
  type: 'high_volume' | 'duplicate'
  description: string
  count: number
  org_id?: string
}

/**
 * Get recent product submissions
 */
export async function getRecentSubmissions(
  days: number = 7,
  orgId?: string
): Promise<MasterProduct[]> {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)

  let query = supabase
    .from('master_products')
    .select('*')
    .gte('created_at', dateFrom.toISOString())
    .order('created_at', { ascending: false })

  if (orgId) {
    query = query.eq('submitted_org_id', orgId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch recent submissions: ${error.message}`)
  }

  return (data || []) as MasterProduct[]
}

/**
 * Get submission statistics
 */
export async function getSubmissionStats(days: number = 30): Promise<SubmissionStats> {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)

  const { data, error } = await supabase
    .from('master_products')
    .select('approval_status, created_at')
    .gte('created_at', dateFrom.toISOString())

  if (error) {
    throw new Error(`Failed to fetch submission stats: ${error.message}`)
  }

  const submissions = (data || []) as Array<{ approval_status: string; created_at: string }>

  const stats: SubmissionStats = {
    total: submissions.length,
    pending: submissions.filter(s => s.approval_status === 'pending' || s.approval_status === 'auto_pass').length,
    approved: submissions.filter(s => s.approval_status === 'approved').length,
    rejected: submissions.filter(s => s.approval_status === 'rejected').length,
    byDay: [],
  }

  // Group by day
  const dayMap = new Map<string, number>()
  submissions.forEach(sub => {
    const date = new Date(sub.created_at).toISOString().split('T')[0]
    dayMap.set(date, (dayMap.get(date) || 0) + 1)
  })

  stats.byDay = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return stats
}

/**
 * Get submission anomalies
 */
export async function getSubmissionAnomalies(): Promise<SubmissionAnomaly[]> {
  const anomalies: SubmissionAnomaly[] = []

  // Check for high volume submissions (more than 10 in last 24 hours from same org)
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: recentSubmissions, error } = await supabase
    .from('master_products')
    .select('submitted_org_id, created_at')
    .gte('created_at', oneDayAgo.toISOString())
    .not('submitted_org_id', 'is', null)

  if (error) {
    console.error('Error fetching submissions for anomaly detection:', error)
    return anomalies
  }

  // Group by org
  const orgCounts = new Map<string, number>()
  recentSubmissions?.forEach((sub: any) => {
    if (sub.submitted_org_id) {
      orgCounts.set(sub.submitted_org_id, (orgCounts.get(sub.submitted_org_id) || 0) + 1)
    }
  })

  // Find orgs with high volume
  orgCounts.forEach((count, orgId) => {
    if (count > 10) {
      anomalies.push({
        type: 'high_volume',
        description: `Org ${orgId} submitted ${count} products in the last 24 hours`,
        count,
        org_id: orgId,
      })
    }
  })

  // Check for duplicate submissions (same SKU from different orgs in last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: recentBySku, error: skuError } = await supabase
    .from('master_products')
    .select('sku, submitted_org_id')
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('submitted_org_id', 'is', null)

  if (!skuError && recentBySku) {
    const skuCounts = new Map<string, Set<string>>()
    recentBySku.forEach((sub: any) => {
      if (!skuCounts.has(sub.sku)) {
        skuCounts.set(sub.sku, new Set())
      }
      if (sub.submitted_org_id) {
        skuCounts.get(sub.sku)?.add(sub.submitted_org_id)
      }
    })

    skuCounts.forEach((orgs, sku) => {
      if (orgs.size > 1) {
        anomalies.push({
          type: 'duplicate',
          description: `SKU "${sku}" submitted by ${orgs.size} different orgs`,
          count: orgs.size,
        })
      }
    })
  }

  return anomalies
}

