import { supabase } from '../supabase'
import type { AgentRelationship, AgentPortalPermission } from '../../types'

/**
 * Create an agent relationship
 * Only org admins can add agents
 * The agent user must be an admin of their own org
 */
export async function createAgentRelationship(
  senderOrgId: string,
  agentUserId: string,
  invitedBy: string,
  notes?: string
): Promise<AgentRelationship> {
  // First verify the agent user is an admin of their own org
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role, org_id')
    .eq('profile_id', agentUserId)
    .eq('membership_status', 'active')
    .single()

  if (membershipError || !membership) {
    throw new Error('User not found or not a member of any organization')
  }

  if (membership.role !== 'admin') {
    throw new Error('Only organization admins can be appointed as agents')
  }

  // Prevent adding agent from same org
  if (membership.org_id === senderOrgId) {
    throw new Error('Cannot appoint users from your own organization as agents')
  }

  const { data, error } = await supabase
    .from('agent_relationships')
    .insert({
      sender_org_id: senderOrgId,
      agent_user_id: agentUserId,
      invited_by: invitedBy,
      notes,
      accepted_at: new Date().toISOString(), // Auto-accept for now
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get all agent relationships for a sender org
 */
export async function getAgentsForOrg(senderOrgId: string): Promise<{
  relationship: AgentRelationship
  agentProfile: {
    id: string
    email: string
    full_name: string | null
  }
  agentOrg: {
    id: string
    name: string
  } | null
}[]> {
  const { data, error } = await supabase
    .from('agent_relationships')
    .select(`
      *,
      profiles!agent_relationships_agent_user_id_fkey(id, email, full_name),
      memberships!inner(
        org_id,
        orgs!memberships_org_id_fkey(id, name)
      )
    `)
    .eq('sender_org_id', senderOrgId)
    .order('created_at', { ascending: false })

  if (error) throw error

  if (!data) return []

  return data.map((item: any) => ({
    relationship: item as AgentRelationship,
    agentProfile: item.profiles,
    agentOrg: item.memberships[0]?.orgs || null,
  }))
}

/**
 * Revoke agent relationship
 */
export async function revokeAgentRelationship(relationshipId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_relationships')
    .update({ status: 'revoked' })
    .eq('id', relationshipId)

  if (error) throw error
}

/**
 * Reactivate agent relationship
 */
export async function reactivateAgentRelationship(relationshipId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_relationships')
    .update({ status: 'active' })
    .eq('id', relationshipId)

  if (error) throw error
}

/**
 * Grant agent portal permission to a helper (branch_head or advisor from agent's org)
 */
export async function grantPortalPermission(
  relationshipId: string,
  helperUserId: string,
  grantedBy: string
): Promise<AgentPortalPermission> {
  // Verify helper is from the agent's org
  const { data: relationship, error: relError } = await supabase
    .from('agent_relationships')
    .select('agent_user_id')
    .eq('id', relationshipId)
    .single()

  if (relError || !relationship) {
    throw new Error('Agent relationship not found')
  }

  // Verify helper is in the same org as the agent
  const { data: agentMembership, error: agentError } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('profile_id', relationship.agent_user_id)
    .eq('membership_status', 'active')
    .single()

  if (agentError || !agentMembership) {
    throw new Error('Agent membership not found')
  }

  const { data: helperMembership, error: helperError } = await supabase
    .from('memberships')
    .select('org_id, role')
    .eq('profile_id', helperUserId)
    .eq('membership_status', 'active')
    .single()

  if (helperError || !helperMembership) {
    throw new Error('Helper user not found or not active')
  }

  if (helperMembership.org_id !== agentMembership.org_id) {
    throw new Error('Helper must be from the same organization as the agent')
  }

  if (helperMembership.role !== 'branch_head' && helperMembership.role !== 'advisor') {
    throw new Error('Only branch heads and advisors can be granted portal access')
  }

  const { data, error } = await supabase
    .from('agent_portal_permissions')
    .insert({
      agent_relationship_id: relationshipId,
      helper_user_id: helperUserId,
      granted_by: grantedBy,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Revoke portal permission from a helper
 */
export async function revokePortalPermission(permissionId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_portal_permissions')
    .delete()
    .eq('id', permissionId)

  if (error) throw error
}

/**
 * Get all helpers for an agent relationship
 */
export async function getAgentHelpers(relationshipId: string): Promise<{
  permission: AgentPortalPermission
  helper: {
    id: string
    email: string
    full_name: string | null
  }
  role: string | null
}[]> {
  const { data, error } = await supabase
    .from('agent_portal_permissions')
    .select(`
      *,
      profiles!agent_portal_permissions_helper_user_id_fkey(id, email, full_name),
      memberships!inner(role)
    `)
    .eq('agent_relationship_id', relationshipId)
    .order('granted_at', { ascending: false })

  if (error) throw error

  if (!data) return []

  return data.map((item: any) => ({
    permission: item as AgentPortalPermission,
    helper: item.profiles,
    role: item.memberships[0]?.role || null,
  }))
}

/**
 * Search for users by email to add as agents
 * Returns users who are admins of their own orgs
 */
export async function searchPotentialAgents(email: string, currentOrgId: string): Promise<{
  id: string
  email: string
  full_name: string | null
  org: {
    id: string
    name: string
  }
}[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      memberships!inner(
        role,
        org_id,
        membership_status,
        orgs!memberships_org_id_fkey(id, name)
      )
    `)
    .ilike('email', `%${email}%`)
    .eq('memberships.role', 'org_owner')
    .eq('memberships.membership_status', 'active')
    .neq('memberships.org_id', currentOrgId) // Exclude same org
    .limit(10)

  if (error) throw error

  if (!data) return []

  return data.map((item: any) => ({
    id: item.id,
    email: item.email,
    full_name: item.full_name,
    org: item.memberships[0]?.orgs,
  }))
}

