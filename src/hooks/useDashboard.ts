/**
 * React Query hooks for Dashboard Statistics
 * 
 * Implements parallel queries to eliminate loading waterfalls.
 * All dashboard metrics are fetched simultaneously and cached independently.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getPendingMemberships, approveMembership, type PendingMembership } from '../lib/api/memberships'

export interface DashboardStats {
  totalProducts: number
  lowStockItems: number
  totalValue: number
  totalInvoices: number
  finalizedDrafts: number
}

/**
 * Query hook for dashboard statistics
 * Fetches all metrics in parallel for optimal performance
 * 
 * SECURITY: RLS policies on inventory and invoices tables enforce org-scoped access.
 * All queries use org_id filter which is validated by RLS.
 * 
 * PERFORMANCE: 30-second stale time ensures low-stock alerts remain accurate
 * during rapid inventory changes while reducing unnecessary refetches.
 */
export const useDashboardStats = (orgId: string | null | undefined) => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', orgId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!orgId) {
        throw new Error('Organization ID is required')
      }

      // Execute all queries in parallel for better performance
      const [inventoryCountResult, inventoryResult, invoicesCountResult, finalizedDraftsResult] = await Promise.all([
        supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('inventory')
          .select('quantity, cost_price, selling_price')
          .eq('org_id', orgId),
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'finalized')
          .not('draft_data', 'is', null),
      ])

      if (inventoryCountResult.error) throw inventoryCountResult.error
      if (inventoryResult.error) throw inventoryResult.error
      if (invoicesCountResult.error) throw invoicesCountResult.error
      if (finalizedDraftsResult.error) throw finalizedDraftsResult.error

      const inventory = inventoryResult.data || []
      const lowStockItems = inventory.filter((item: any) => item.quantity < 10).length

      const totalValue = inventory.reduce(
        (sum: number, item: any) => sum + item.quantity * item.selling_price,
        0
      )

      return {
        totalProducts: inventoryCountResult.count || 0,
        lowStockItems,
        totalValue,
        totalInvoices: invoicesCountResult.count || 0,
        finalizedDrafts: finalizedDraftsResult.count || 0,
      }
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds - reduced for accurate low-stock alerts during rapid inventory changes
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook for pending memberships (admin only)
 * 
 * SECURITY: 
 * - Client-side `enabled` flag is UX optimization only
 * - RLS policy `memberships_owner_view_all` enforces server-side authorization
 * - Non-owners attempting to query pending memberships will receive empty results
 * - RLS policy requires: `current_user_role() = 'org_owner'` AND `org_id = current_user_org_id()`
 * - See: supabase/migrations/00000000000000_baseline_schema.sql line 1480-1487
 */
export const usePendingMemberships = (orgId: string | null | undefined, enabled: boolean = true) => {
  return useQuery<PendingMembership[]>({
    queryKey: ['pending-memberships', orgId],
    queryFn: () => getPendingMemberships(orgId!),
    enabled: enabled && !!orgId,
    staleTime: 30 * 1000, // 30 seconds - pending memberships change frequently
    refetchOnWindowFocus: false,
  })
}

/**
 * Approve pending membership
 * OPTIMISTIC UPDATE: Removes membership from cache immediately, reverts on error
 * 
 * SECURITY:
 * - Optimistic cache update is safe because backend RPC `approve_membership` re-validates permissions
 * - Backend checks: approver role = 'org_owner', membership belongs to approver's org, membership is pending
 * - If backend validation fails, mutation error triggers automatic rollback
 * - See: supabase/migrations/00000000000000_baseline_schema.sql line 1108-1158
 * - Never trust optimistic cache state - backend is authoritative
 */
export const useApproveMembership = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { membershipId: string; orgId: string }>({
    mutationFn: ({ membershipId }) => approveMembership(membershipId),
    // OPTIMISTIC UPDATE: Remove membership from cache immediately
    // SECURITY: Backend RPC re-validates permissions - if unauthorized, error triggers rollback
    onMutate: async ({ membershipId, orgId }) => {
      await queryClient.cancelQueries({ queryKey: ['pending-memberships', orgId] })
      const previousMemberships = queryClient.getQueryData<PendingMembership[]>(['pending-memberships', orgId])

      if (previousMemberships) {
        queryClient.setQueryData<PendingMembership[]>(
          ['pending-memberships', orgId],
          previousMemberships.filter(m => m.membership.id !== membershipId)
        )
      }

      return { previousMemberships }
    },
    onError: (error, variables, context) => {
      // SECURITY: Rollback on error - backend rejected unauthorized attempt
      if (context?.previousMemberships) {
        queryClient.setQueryData(['pending-memberships', variables.orgId], context.previousMemberships)
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-memberships', variables.orgId] })
    },
  })
}

