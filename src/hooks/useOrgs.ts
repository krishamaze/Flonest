import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getOrgById,
  updateOrg,
  isSlugAvailable,
  generateUniqueSlug,
  setGstFromValidation,
  markGstVerified,
  type UpdateOrgData,
} from '../lib/api/orgs'
import type { Org } from '../types'

/**
 * Query hook to get organization by ID
 */
export const useOrg = (orgId: string | null | undefined) => {
  return useQuery<Org | null>({
    queryKey: ['org', orgId],
    queryFn: async () => {
      if (!orgId) return null
      return getOrgById(orgId)
    },
    enabled: !!orgId,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to check if a slug is available
 */
export const useIsSlugAvailable = (slug: string | null | undefined, excludeOrgId?: string, enabled: boolean = true) => {
  return useQuery<boolean>({
    queryKey: ['slug-available', slug, excludeOrgId],
    queryFn: async () => {
      if (!slug) return false
      return isSlugAvailable(slug, excludeOrgId)
    },
    enabled: enabled && !!slug,
    staleTime: 5 * 1000, // 5 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Mutation hook to update organization
 */
export const useUpdateOrg = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<Org, Error, UpdateOrgData, { previousOrg: Org | undefined }>({
    mutationFn: async (data: UpdateOrgData) => {
      if (!orgId) throw new Error('Organization ID is required')
      return updateOrg(orgId, data)
    },
    // Optimistic update
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['org', orgId] })

      const previousOrg = queryClient.getQueryData<Org>(['org', orgId])

      // Optimistically update org
      if (previousOrg) {
        queryClient.setQueryData<Org>(['org', orgId], {
          ...previousOrg,
          ...data,
          updated_at: new Date().toISOString(),
        })
      }

      return { previousOrg }
    },
    onError: (_error, _variables, context) => {
      // Revert on error
      if (context?.previousOrg) {
        queryClient.setQueryData(['org', orgId], context.previousOrg)
      }
    },
    onSuccess: (updatedOrg) => {
      // Set the updated org in cache
      queryClient.setQueryData(['org', orgId], updatedOrg)

      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['org', orgId] })

      // Invalidate auth queries as org data may affect auth context
      queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
    },
  })
}

/**
 * Mutation hook to generate unique slug from org name
 */
export const useGenerateUniqueSlug = () => {
  return useMutation<string, Error, { name: string; orgId?: string }>({
    mutationFn: ({ name, orgId }) => generateUniqueSlug(name, orgId),
  })
}

/**
 * Mutation hook to set GST from validation
 */
export const useSetGstFromValidation = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    void,
    Error,
    {
      gstNumber: string
      gstEnabled: boolean
      verificationStatus: 'unverified' | 'verified'
      verificationSource: 'manual' | 'cashfree' | 'secureid'
    }
  >({
    mutationFn: async ({ gstNumber, gstEnabled, verificationStatus, verificationSource }) => {
      if (!orgId) throw new Error('Organization ID is required')
      return setGstFromValidation(orgId, gstNumber, gstEnabled, verificationStatus, verificationSource)
    },
    onSuccess: () => {
      // Invalidate org query to refetch with updated GST data
      queryClient.invalidateQueries({ queryKey: ['org', orgId] })

      // Invalidate auth queries as org data may affect auth context
      queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
    },
  })
}

/**
 * Mutation hook to mark GST as verified (platform admin only)
 */
export const useMarkGstVerified = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    void,
    Error,
    {
      verificationNotes: string
      legalName?: string | null
      address?: string | null
    }
  >({
    mutationFn: async ({ verificationNotes, legalName, address }) => {
      if (!orgId) throw new Error('Organization ID is required')
      return markGstVerified(orgId, verificationNotes, legalName, address)
    },
    onSuccess: () => {
      // Invalidate org query to refetch with updated GST verification data
      queryClient.invalidateQueries({ queryKey: ['org', orgId] })

      // Invalidate auth queries as org data may affect auth context
      queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
    },
  })
}
