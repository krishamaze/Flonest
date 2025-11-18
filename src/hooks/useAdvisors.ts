/**
 * React Query hooks for Advisors/Memberships
 * 
 * Implements optimistic updates for instant UI feedback when managing advisors.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { createAdvisorMembership } from '../lib/api/memberships'

export interface Branch {
  id: string
  name: string
  org_id: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
}

/**
 * Query hook for organization branches
 */
export const useBranches = (orgId: string | null | undefined) => {
  return useQuery<Branch[]>({
    queryKey: ['branches', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')

      const { data, error } = await (supabase as any)
        .from('branches')
        .select('*')
        .eq('org_id', orgId)
        .order('name')

      if (error) throw error
      return data || []
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - branches don't change frequently
    refetchOnWindowFocus: false,
  })
}

/**
 * Search for user by email
 * Note: This is a search query, not cached long-term
 */
export const useSearchUser = (email: string, orgId: string | null | undefined) => {
  return useQuery<UserProfile | null>({
    queryKey: ['user-search', email, orgId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!email.trim() || !orgId) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      if (error) throw error

      if (!data) return null

      // Check if user already has membership in this org
      const { data: existingMembership } = await supabase
        .from('memberships')
        .select('id')
        .eq('profile_id', data.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingMembership) {
        throw new Error('User already has a membership in this organization')
      }

      return data
    },
    enabled: !!email.trim() && email.length >= 3 && !!orgId, // Only search if email is at least 3 chars
    staleTime: 0, // Don't cache search results
    retry: false, // Don't retry on "not found" errors
    refetchOnWindowFocus: false,
  })
}

/**
 * Create advisor membership
 * OPTIMISTIC UPDATE: Invalidates pending memberships cache immediately
 */
export const useCreateAdvisorMembership = () => {
  const queryClient = useQueryClient()

  return useMutation<
    { membership_id: string; status: string },
    Error,
    { userId: string; branchId: string; email: string }
  >({
    mutationFn: ({ userId, branchId, email }) =>
      createAdvisorMembership(userId, branchId, email),
    // On success, invalidate relevant queries
    onSuccess: (_data, _variables) => {
      // Invalidate pending memberships (shown on dashboard)
      queryClient.invalidateQueries({ queryKey: ['pending-memberships'] })
      // Invalidate user search to clear cached "already exists" state
      queryClient.invalidateQueries({ queryKey: ['user-search'] })
    },
  })
}

