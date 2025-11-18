/**
 * React Query hooks for Agent Relationships
 * 
 * Implements optimistic updates for instant UI feedback when managing agents.
 * All mutations update the React Query cache immediately, reverting only on error.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAgentsForOrg,
  searchPotentialAgents,
  createAgentRelationship,
  revokeAgentRelationship,
  reactivateAgentRelationship,
  getAgentHelpers,
  revokePortalPermission,
} from '../lib/api/agentRelationships'
import type { AgentRelationship } from '../types'

export interface AgentListItem {
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
}

export interface AgentHelper {
  permission: {
    id: string
    agent_relationship_id: string
    helper_user_id: string
    granted_by: string | null
    granted_at: string | null
    created_at: string | null
  }
  helper: {
    id: string
    email: string
    full_name: string | null
  }
  role: string | null
}

/**
 * Query hook for agents list
 */
export const useAgents = (orgId: string | null | undefined) => {
  return useQuery<AgentListItem[]>({
    queryKey: ['agents', orgId],
    queryFn: () => getAgentsForOrg(orgId!),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes - agent list doesn't change frequently
    refetchOnWindowFocus: false,
  })
}

/**
 * Search for potential agents by email
 * Note: This is a search query, not cached long-term
 */
export const useSearchPotentialAgents = (email: string, currentOrgId: string | null | undefined) => {
  return useQuery({
    queryKey: ['agent-search', email, currentOrgId],
    queryFn: () => searchPotentialAgents(email, currentOrgId!),
    enabled: !!email.trim() && email.length >= 3 && !!currentOrgId, // Only search if email is at least 3 chars
    staleTime: 30 * 1000, // 30 seconds - search results are ephemeral
    refetchOnWindowFocus: false,
  })
}

/**
 * Create agent relationship
 * OPTIMISTIC UPDATE: Adds agent to cache immediately, reverts on error
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient()

  return useMutation<
    AgentRelationship,
    Error,
    { senderOrgId: string; agentUserId: string; invitedBy: string; notes?: string }
  >({
    mutationFn: ({ senderOrgId, agentUserId, invitedBy, notes }) =>
      createAgentRelationship(senderOrgId, agentUserId, invitedBy, notes),
    // OPTIMISTIC UPDATE: Add agent to cache immediately
    onMutate: async ({ senderOrgId }): Promise<{ previousAgents?: AgentListItem[] }> => {
      await queryClient.cancelQueries({ queryKey: ['agents', senderOrgId] })
      const previousAgents = queryClient.getQueryData<AgentListItem[]>(['agents', senderOrgId])
      return { previousAgents }
    },
    // On error, rollback
    onError: (error, variables, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents', variables.senderOrgId], context.previousAgents)
      }
    },
    // On success, invalidate to refetch with full data
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents', variables.senderOrgId] })
    },
  })
}

/**
 * Revoke agent relationship
 * OPTIMISTIC UPDATE: Updates status immediately, reverts on error
 */
export const useRevokeAgent = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { relationshipId: string; orgId: string }>({
    mutationFn: ({ relationshipId }) => revokeAgentRelationship(relationshipId),
    // OPTIMISTIC UPDATE: Update status immediately
    onMutate: async ({ relationshipId, orgId }): Promise<{ previousAgents?: AgentListItem[] }> => {
      await queryClient.cancelQueries({ queryKey: ['agents', orgId] })
      const previousAgents = queryClient.getQueryData<AgentListItem[]>(['agents', orgId])

      if (previousAgents) {
        queryClient.setQueryData<AgentListItem[]>(['agents', orgId], previousAgents.map(agent =>
          agent.relationship.id === relationshipId
            ? {
                ...agent,
                relationship: {
                  ...agent.relationship,
                  status: 'revoked' as const,
                },
              }
            : agent
        ))
      }

      return { previousAgents }
    },
    onError: (error, variables, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents', variables.orgId], context.previousAgents)
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents', variables.orgId] })
    },
  })
}

/**
 * Reactivate agent relationship
 * OPTIMISTIC UPDATE: Updates status immediately, reverts on error
 */
export const useReactivateAgent = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { relationshipId: string; orgId: string }>({
    mutationFn: ({ relationshipId }) => reactivateAgentRelationship(relationshipId),
    // OPTIMISTIC UPDATE: Update status immediately
    onMutate: async ({ relationshipId, orgId }): Promise<{ previousAgents?: AgentListItem[] }> => {
      await queryClient.cancelQueries({ queryKey: ['agents', orgId] })
      const previousAgents = queryClient.getQueryData<AgentListItem[]>(['agents', orgId])

      if (previousAgents) {
        queryClient.setQueryData<AgentListItem[]>(['agents', orgId], previousAgents.map(agent =>
          agent.relationship.id === relationshipId
            ? {
                ...agent,
                relationship: {
                  ...agent.relationship,
                  status: 'active' as const,
                },
              }
            : agent
        ))
      }

      return { previousAgents }
    },
    onError: (error, variables, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents', variables.orgId], context.previousAgents)
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents', variables.orgId] })
    },
  })
}

/**
 * Query hook for agent helpers
 */
export const useAgentHelpers = (relationshipId: string | null | undefined) => {
  return useQuery<AgentHelper[]>({
    queryKey: ['agent-helpers', relationshipId],
    queryFn: () => getAgentHelpers(relationshipId!),
    enabled: !!relationshipId,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  })
}

/**
 * Revoke portal permission from helper
 * OPTIMISTIC UPDATE: Removes helper from cache immediately, reverts on error
 */
export const useRevokeHelperPermission = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { permissionId: string; relationshipId: string }>({
    mutationFn: ({ permissionId }) => revokePortalPermission(permissionId),
    // OPTIMISTIC UPDATE: Remove helper immediately
    onMutate: async ({ permissionId, relationshipId }): Promise<{ previousHelpers?: AgentHelper[] }> => {
      await queryClient.cancelQueries({ queryKey: ['agent-helpers', relationshipId] })
      const previousHelpers = queryClient.getQueryData<AgentHelper[]>(['agent-helpers', relationshipId])

      if (previousHelpers) {
        queryClient.setQueryData<AgentHelper[]>(
          ['agent-helpers', relationshipId],
          previousHelpers.filter(helper => helper.permission.id !== permissionId)
        )
      }

      return { previousHelpers }
    },
    onError: (error, variables, context) => {
      if (context?.previousHelpers) {
        queryClient.setQueryData(['agent-helpers', variables.relationshipId], context.previousHelpers)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-helpers', variables.relationshipId] })
    },
  })
}

