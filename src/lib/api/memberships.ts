import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type Membership = Database['public']['Tables']['memberships']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
// Branch type may not exist in generated types yet, use any for now
type Branch = any

export interface PendingMembership {
  membership: Membership
  profile: Profile
  branch: Branch | null
}

/**
 * Get pending memberships for approval (Owner only)
 */
export async function getPendingMemberships(orgId: string): Promise<PendingMembership[]> {
  const { data, error } = await (supabase as any)
    .from('memberships')
    .select(`
      *,
      profiles(*),
      branches(*)
    `)
    .eq('org_id', orgId)
    .eq('membership_status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch pending memberships: ${error.message}`)
  }

  if (!data) return []

  return data.map((item: any) => ({
    membership: item as Membership,
    profile: item.profiles as Profile,
    branch: item.branches as Branch | null,
  }))
}

/**
 * Approve a pending membership (Owner only)
 */
export async function approveMembership(membershipId: string): Promise<void> {
  const { data, error } = await (supabase.rpc as any)('approve_membership', {
    p_membership_id: membershipId,
  })

  if (error) {
    throw new Error(`Failed to approve membership: ${error.message}`)
  }

  const result = data as any
  if (!result || !result.success) {
    throw new Error('Failed to approve membership')
  }
}

/**
 * Create advisor membership (OrgOwner or Branch Head)
 * OrgOwner-created: active immediately
 * Branch Head-created: pending approval
 */
export async function createAdvisorMembership(
  profileId: string,
  branchId: string,
  email: string
): Promise<{ membership_id: string; status: string }> {
  const { data, error } = await (supabase.rpc as any)('create_staff_membership', {
    p_profile_id: profileId,
    p_branch_id: branchId,
    p_email: email,
  })

  if (error) {
    throw new Error(`Failed to create advisor membership: ${error.message}`)
  }

  const result = data as any
  if (!result || !result.success) {
    throw new Error('Failed to create advisor membership')
  }

  return {
    membership_id: result.membership_id,
    status: result.status,
  }
}

/**
 * Get all memberships in org (Owner can see all, others see active only)
 */
export async function getOrgMemberships(orgId: string): Promise<PendingMembership[]> {
  const { data, error } = await (supabase as any)
    .from('memberships')
    .select(`
      *,
      profiles(*),
      branches(*)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch memberships: ${error.message}`)
  }

  if (!data) return []

  return data.map((item: any) => ({
    membership: item as Membership,
    profile: item.profiles as Profile,
    branch: item.branches as Branch | null,
  }))
}

