/**
 * React Query hooks for MFA enrollment and verification
 * 
 * SECURITY: All queries/mutations use retry: 0 to prevent redundant retries on invalid tokens
 * Session errors (401) are handled globally via QueryCache/MutationCache in App.tsx
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminMfaStatus, adminMfaStart, adminMfaVerify } from '../lib/api/adminMfa'
import { useAuth } from '../contexts/AuthContext'

interface StatusResponse {
  hasVerifiedFactor: boolean
  factorId?: string
}

interface StartResponse {
  mode: 'none' | 'enrollment' | 'challenge'
  factorId?: string
  qrCode?: string
  secret?: string
}

/**
 * Query hook for MFA status
 * SECURITY: retry: 0 - invalid tokens don't self-correct
 */
export const useMFAStatus = (enabled: boolean = true) => {
  const { user, requiresAdminMfa } = useAuth()

  return useQuery<StatusResponse>({
    queryKey: ['mfa-status', user?.id],
    queryFn: adminMfaStatus,
    enabled: enabled && !!user && !!user.platformAdmin && requiresAdminMfa,
    retry: 0, // SECURITY: Don't retry on failure - invalid tokens don't self-correct
    staleTime: 0, // Always fetch fresh status
    refetchOnWindowFocus: false,
  })
}

/**
 * Mutation hook for starting MFA enrollment
 * SECURITY: retry: false - invalid tokens don't self-correct
 */
export const useEnrollMFA = () => {
  const queryClient = useQueryClient()

  return useMutation<StartResponse, Error>({
    mutationFn: () => adminMfaStart(),
    retry: false, // SECURITY: Don't retry on failure
    onSuccess: (_data) => {
      // Invalidate status query to refetch after enrollment starts
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
    },
  })
}

/**
 * Mutation hook for verifying MFA code
 * SECURITY: retry: false - invalid tokens don't self-correct
 */
export const useVerifyMFA = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshAdminMfaRequirement } = useAuth()

  return useMutation<void, Error, { factorId: string; code: string }>({
    mutationFn: ({ factorId, code }) => adminMfaVerify(factorId, code),
    retry: false, // SECURITY: Don't retry on failure
    onSuccess: async () => {
      // Refresh session and MFA requirement after successful verification
      await supabase.auth.refreshSession()
      await refreshAdminMfaRequirement()
      
      // Invalidate status query
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      
      // Redirect to platform admin dashboard
      navigate('/platform-admin', { replace: true })
    },
  })
}

