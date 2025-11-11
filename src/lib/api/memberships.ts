import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type Membership = Database['public']['Tables']['memberships']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Branch = Database['public']['Tables']['branches']['Row']

export interface PendingMembership {
  membership: Membership
  profile: Profile
  branch: Branch | null
}

/**
 * Get pending memberships for approval (Owner only)
 */
export async function getPendingMemberships(orgId: string): Promise<PendingMembership[]> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase.rpc('approve_membership', {
    p_membership_id: membershipId,
  })

  if (error) {
    throw new Error(`Failed to approve membership: ${error.message}`)
  }

  if (!data || !data.success) {
    throw new Error('Failed to approve membership')
  }
}

/**
 * Create staff membership (Owner or Branch Head)
 * Owner-created: active immediately
 * Branch Head-created: pending approval
 */
export async function createStaffMembership(
  profileId: string,
  branchId: string,
  email: string
): Promise<{ membership_id: string; status: string }> {
  const { data, error } = await supabase.rpc('create_staff_membership', {
    p_profile_id: profileId,
    p_branch_id: branchId,
    p_email: email,
  })

  if (error) {
    throw new Error(`Failed to create staff membership: ${error.message}`)
  }

  if (!data || !data.success) {
    throw new Error('Failed to create staff membership')
  }

  return {
    membership_id: data.membership_id,
    status: data.status,
  }
}

/**
 * Get all memberships in org (Owner can see all, others see active only)
 */
export async function getOrgMemberships(orgId: string): Promise<PendingMembership[]> {
  const { data, error } = await supabase
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

