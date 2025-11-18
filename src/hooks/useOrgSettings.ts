/**
 * React Query hooks for Organization Settings
 * 
 * Implements optimistic updates for instant UI feedback when updating org settings.
 * All mutations update the React Query cache immediately, reverting only on error.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface OrgSettings {
  id: string
  name: string
  legal_name: string | null
  custom_logo_url: string | null
  phone: string | null
  address: string | null
  gst_number: string | null
  gst_verification_status: string
}

/**
 * Query hook for organization settings
 */
export const useOrgSettings = (orgId: string | null | undefined) => {
  return useQuery<OrgSettings>({
    queryKey: ['org-settings', orgId],
    queryFn: async (): Promise<OrgSettings> => {
      if (!orgId) {
        throw new Error('Organization ID is required')
      }

      const { data, error } = await supabase
        .from('orgs')
        .select('id, name, legal_name, custom_logo_url, phone, address, gst_number, gst_verification_status')
        .eq('id', orgId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Organization not found')

      return data as OrgSettings
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - org settings don't change frequently
    refetchOnWindowFocus: false,
  })
}

/**
 * Update organization settings (name, phone)
 * OPTIMISTIC UPDATE: Updates cache immediately, reverts on error
 */
export const useUpdateOrgSettings = () => {
  const queryClient = useQueryClient()

  return useMutation<
    OrgSettings,
    Error,
    { orgId: string; name: string; phone: string | null }
  >({
    mutationFn: async ({ orgId, name, phone }) => {
      const { data, error } = await supabase
        .from('orgs')
        .update({ name, phone })
        .eq('id', orgId)
        .select('id, name, legal_name, custom_logo_url, phone, address, gst_number, gst_verification_status')
        .single()

      if (error) throw error
      if (!data) throw new Error('Failed to update organization settings')

      return data as OrgSettings
    },
    // OPTIMISTIC UPDATE: Update cache immediately before server responds
    onMutate: async ({ orgId, name, phone }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['org-settings', orgId] })

      // Snapshot previous value for rollback
      const previousSettings = queryClient.getQueryData<OrgSettings>(['org-settings', orgId])

      // Optimistically update cache
      if (previousSettings) {
        queryClient.setQueryData<OrgSettings>(['org-settings', orgId], {
          ...previousSettings,
          name,
          phone,
        })
      }

      // Return context with previous value for rollback
      return { previousSettings }
    },
    // On error, rollback to previous value
    onError: (error, variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['org-settings', variables.orgId], context.previousSettings)
      }
    },
    // On success, ensure cache is in sync with server
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['org-settings', variables.orgId], data)
    },
    // Always refetch after mutation to ensure consistency
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-settings', variables.orgId] })
    },
  })
}

/**
 * Upload organization logo
 * Updates cache optimistically after upload completes
 */
export const useUploadOrgLogo = () => {
  const queryClient = useQueryClient()

  return useMutation<
    { logoUrl: string },
    Error,
    { orgId: string; file: File }
  >({
    mutationFn: async ({ orgId, file }) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file')
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB')
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${orgId}-${Date.now()}.${fileExt}`
      const filePath = `org-logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath)

      // Update org with logo URL
      const { error: updateError } = await supabase
        .from('orgs')
        .update({ custom_logo_url: publicUrl })
        .eq('id', orgId)

      if (updateError) throw updateError

      return { logoUrl: publicUrl }
    },
    // OPTIMISTIC UPDATE: Update cache immediately after upload succeeds
    onSuccess: async (data, variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['org-settings', variables.orgId] })

      // Get current settings
      const previousSettings = queryClient.getQueryData<OrgSettings>(['org-settings', variables.orgId])

      // Optimistically update cache with new logo URL
      if (previousSettings) {
        queryClient.setQueryData<OrgSettings>(['org-settings', variables.orgId], {
          ...previousSettings,
          custom_logo_url: data.logoUrl,
        })
      }

      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['org-settings', variables.orgId] })
    },
  })
}

/**
 * Remove organization logo
 * OPTIMISTIC UPDATE: Updates cache immediately, reverts on error
 */
export const useRemoveOrgLogo = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { orgId: string }>({
    mutationFn: async ({ orgId }) => {
      const { error } = await supabase
        .from('orgs')
        .update({ custom_logo_url: null })
        .eq('id', orgId)

      if (error) throw error
    },
    // OPTIMISTIC UPDATE: Update cache immediately
    onMutate: async ({ orgId }) => {
      await queryClient.cancelQueries({ queryKey: ['org-settings', orgId] })

      const previousSettings = queryClient.getQueryData<OrgSettings>(['org-settings', orgId])

      if (previousSettings) {
        queryClient.setQueryData<OrgSettings>(['org-settings', orgId], {
          ...previousSettings,
          custom_logo_url: null,
        })
      }

      return { previousSettings }
    },
    // Rollback on error
    onError: (error, variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['org-settings', variables.orgId], context.previousSettings)
      }
    },
    // Invalidate on success
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-settings', variables.orgId] })
    },
  })
}

