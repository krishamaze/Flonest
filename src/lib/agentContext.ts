import { supabase } from './supabase'
import type { AuthUser, AgentRelationship, Org } from '../types'

export interface AgentContextInfo {
  senderOrgId: string
  senderOrgName: string
  relationshipId: string
  canManage: boolean
}

/**
 * Get all agent relationships for a user
 * Returns orgs where the user is an agent or has portal permissions
 */
export async function getAgentRelationships(userId: string): Promise<{
  relationship: AgentRelationship
  senderOrg: Org
  canManage: boolean
}[]> {
  try {
    // Get relationships where user is the agent
    const { data: agentRels, error: agentError } = await supabase
      .from('agent_relationships')
      .select('*, orgs!agent_relationships_sender_org_id_fkey(*)')
      .eq('agent_user_id', userId)
      .eq('status', 'active')

    if (agentError) {
      console.error('Error fetching agent relationships:', agentError)
      throw agentError
    }

    // Get relationships where user has portal permissions
    const { data: helperPerms, error: helperError } = await supabase
      .from('agent_portal_permissions')
      .select(`
        *,
        agent_relationships!inner(
          *,
          orgs!agent_relationships_sender_org_id_fkey(*)
        )
      `)
      .eq('helper_user_id', userId)

    if (helperError) {
      console.error('Error fetching helper permissions:', helperError)
      throw helperError
    }

    const results: {
      relationship: AgentRelationship
      senderOrg: Org
      canManage: boolean
    }[] = []

    // Add agent relationships (user is the agent)
    if (agentRels) {
      for (const rel of agentRels) {
        results.push({
          relationship: rel as AgentRelationship,
          senderOrg: (rel as any).orgs as Org,
          canManage: true,
        })
      }
    }

    // Add helper relationships (user has been granted access)
    if (helperPerms) {
      for (const perm of helperPerms) {
        const rel = (perm as any).agent_relationships
        // Only add if not already in results (avoid duplicates if user is both agent and helper)
        if (!results.find(r => r.relationship.id === rel.id)) {
          results.push({
            relationship: rel as AgentRelationship,
            senderOrg: rel.orgs as Org,
            canManage: false, // Helpers can't manage agent relationships
          })
        }
      }
    }

    return results
  } catch (error) {
    console.error('Error in getAgentRelationships:', error)
    return []
  }
}

/**
 * Get agent context information for a specific sender org
 */
export async function getAgentContextForOrg(
  userId: string,
  senderOrgId: string
): Promise<AgentContextInfo | null> {
  try {
    // Check if user is the agent
    const { data: agentRel, error: agentError } = await supabase
      .from('agent_relationships')
      .select('*, orgs!agent_relationships_sender_org_id_fkey(*)')
      .eq('agent_user_id', userId)
      .eq('sender_org_id', senderOrgId)
      .eq('status', 'active')
      .single()

    if (!agentError && agentRel) {
      return {
        senderOrgId: agentRel.sender_org_id,
        senderOrgName: (agentRel as any).orgs.name,
        relationshipId: agentRel.id,
        canManage: true,
      }
    }

    // Check if user has helper permissions
    const { data: helperPerm, error: helperError } = await supabase
      .from('agent_portal_permissions')
      .select(`
        *,
        agent_relationships!inner(
          *,
          orgs!agent_relationships_sender_org_id_fkey(*)
        )
      `)
      .eq('helper_user_id', userId)
      .eq('agent_relationships.sender_org_id', senderOrgId)
      .single()

    if (!helperError && helperPerm) {
      const rel = (helperPerm as any).agent_relationships
      return {
        senderOrgId: rel.sender_org_id,
        senderOrgName: rel.orgs.name,
        relationshipId: rel.id,
        canManage: false,
      }
    }

    return null
  } catch (error) {
    console.error('Error in getAgentContextForOrg:', error)
    return null
  }
}

/**
 * Check if user has any agent relationships
 */
export async function hasAgentRelationships(userId: string): Promise<boolean> {
  try {
    const relationships = await getAgentRelationships(userId)
    return relationships.length > 0
  } catch (error) {
    console.error('Error checking agent relationships:', error)
    return false
  }
}

/**
 * Save agent context mode to localStorage
 */
export function saveAgentContextMode(mode: 'business' | 'agent', senderOrgId?: string) {
  try {
    localStorage.setItem('agentContextMode', mode)
    if (senderOrgId) {
      localStorage.setItem('agentContextSenderOrg', senderOrgId)
    } else {
      localStorage.removeItem('agentContextSenderOrg')
    }
  } catch (error) {
    console.error('Error saving agent context mode:', error)
  }
}

/**
 * Load agent context mode from localStorage
 */
export function loadAgentContextMode(): {
  mode: 'business' | 'agent'
  senderOrgId?: string
} {
  try {
    const mode = localStorage.getItem('agentContextMode') as 'business' | 'agent' | null
    const senderOrgId = localStorage.getItem('agentContextSenderOrg') || undefined
    return {
      mode: mode || 'business',
      senderOrgId,
    }
  } catch (error) {
    console.error('Error loading agent context mode:', error)
    return { mode: 'business' }
  }
}

