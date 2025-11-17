/**
 * React Query hooks for user security checks
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Check if current user has a password set
 * Returns true if user has encrypted_password, false for OAuth-only users
 * Uses React Query for automatic caching and deduplication
 */
export const useUserPasswordCheck = (userId: string | undefined, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['hasPassword', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_user_has_password' as any)
      if (error) {
        console.error('[Auth] Error checking password:', error)
        return false // Default to false for safety
      }
      return Boolean(data ?? false)
    },
    enabled: enabled && !!userId,
    staleTime: Infinity, // Password status rarely changes during a session
    retry: false, // Don't retry on failure - just return false
  })
}

