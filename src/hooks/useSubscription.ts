/**
 * React Query hooks for Subscription & Billing
 * 
 * Implements optimistic updates for instant UI feedback when modifying subscriptions.
 * All mutations update the React Query cache immediately, reverting only on error.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSubscriptionSummary,
  listActivePlans,
  upgradeSubscription,
  scheduleDowngrade,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
  type SubscriptionSummary,
} from '../lib/api/billing'
import type { BillingPlan } from '../types'

/**
 * Query hook for subscription summary (subscription, plan, events, seat usage)
 */
export const useSubscriptionSummary = (orgId: string | null | undefined, enabled: boolean = true) => {
  return useQuery<SubscriptionSummary>({
    queryKey: ['subscription-summary', orgId],
    queryFn: () => fetchSubscriptionSummary(orgId!),
    enabled: enabled && !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes - billing data changes infrequently
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook for active billing plans
 */
export const useBillingPlans = () => {
  return useQuery<BillingPlan[]>({
    queryKey: ['billing-plans'],
    queryFn: listActivePlans,
    staleTime: 10 * 60 * 1000, // 10 minutes - plans rarely change
    refetchOnWindowFocus: false,
  })
}

/**
 * Upgrade subscription to a new plan
 * OPTIMISTIC UPDATE: Updates cache immediately, reverts on error
 */
export const useUpgradeSubscription = () => {
  const queryClient = useQueryClient()

  type SubscriptionContext = {
    previousSummary?: SubscriptionSummary
  }

  return useMutation<
    any,
    Error,
    { orgId: string; planSlug: string; actorUserId: string },
    SubscriptionContext
  >({
    mutationFn: ({ orgId, planSlug, actorUserId }) =>
      upgradeSubscription(orgId, planSlug, { actorUserId }),
    // OPTIMISTIC UPDATE: Update cache immediately before server responds
    onMutate: async ({ orgId, planSlug }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['subscription-summary', orgId] })
      await queryClient.cancelQueries({ queryKey: ['billing-plans'] })

      // Snapshot previous value for rollback
      const previousSummary = queryClient.getQueryData<SubscriptionSummary>(['subscription-summary', orgId])
      const plans = queryClient.getQueryData<BillingPlan[]>(['billing-plans'])

      // Find the new plan
      const newPlan = plans?.find(p => p.slug === planSlug)

      // Optimistically update cache
      if (previousSummary && newPlan) {
        const now = new Date()
        const endDate = new Date(now)
        endDate.setMonth(endDate.getMonth() + (newPlan.billing_interval === 'yearly' ? 12 : 1))

        queryClient.setQueryData<SubscriptionSummary>(['subscription-summary', orgId], {
          ...previousSummary,
          subscription: previousSummary.subscription
            ? {
                ...previousSummary.subscription,
                plan_id: newPlan.id,
                pending_plan_id: null,
                cancel_at_period_end: false,
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: endDate.toISOString(),
                updated_at: now.toISOString(),
              }
            : null,
          plan: newPlan,
          pendingPlan: null,
        })
      }

      return { previousSummary }
    },
    // On error, rollback to previous value
    onError: (_error, variables, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(['subscription-summary', variables.orgId], context.previousSummary)
      }
    },
    // On success, invalidate to refetch fresh data
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-summary', variables.orgId] })
    },
  })
}

/**
 * Schedule downgrade to a new plan (effective at period end)
 * OPTIMISTIC UPDATE: Updates cache immediately, reverts on error
 */
export const useScheduleDowngrade = () => {
  const queryClient = useQueryClient()

  type SubscriptionContext = {
    previousSummary?: SubscriptionSummary
  }

  return useMutation<
    any,
    Error,
    { orgId: string; planSlug: string; actorUserId: string },
    SubscriptionContext
  >({
    mutationFn: ({ orgId, planSlug, actorUserId }) =>
      scheduleDowngrade(orgId, planSlug, { actorUserId }),
    // OPTIMISTIC UPDATE: Update cache immediately
    onMutate: async ({ orgId, planSlug }) => {
      await queryClient.cancelQueries({ queryKey: ['subscription-summary', orgId] })
      await queryClient.cancelQueries({ queryKey: ['billing-plans'] })

      const previousSummary = queryClient.getQueryData<SubscriptionSummary>(['subscription-summary', orgId])
      const plans = queryClient.getQueryData<BillingPlan[]>(['billing-plans'])
      const newPlan = plans?.find(p => p.slug === planSlug)

      if (previousSummary && newPlan && previousSummary.subscription) {
        queryClient.setQueryData<SubscriptionSummary>(['subscription-summary', orgId], {
          ...previousSummary,
          subscription: {
            ...previousSummary.subscription,
            pending_plan_id: newPlan.id,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          },
          pendingPlan: newPlan,
        })
      }

      return { previousSummary }
    },
    onError: (_error, variables, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(['subscription-summary', variables.orgId], context.previousSummary)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-summary', variables.orgId] })
    },
  })
}

/**
 * Cancel subscription at period end
 * OPTIMISTIC UPDATE: Updates cache immediately, reverts on error
 */
export const useCancelSubscription = () => {
  const queryClient = useQueryClient()

  type SubscriptionContext = {
    previousSummary?: SubscriptionSummary
  }

  return useMutation<
    any,
    Error,
    { orgId: string; actorUserId: string },
    SubscriptionContext
  >({
    mutationFn: ({ orgId, actorUserId }) =>
      cancelSubscriptionAtPeriodEnd(orgId, { actorUserId }),
    // OPTIMISTIC UPDATE: Update cache immediately
    onMutate: async ({ orgId }) => {
      await queryClient.cancelQueries({ queryKey: ['subscription-summary', orgId] })

      const previousSummary = queryClient.getQueryData<SubscriptionSummary>(['subscription-summary', orgId])

      if (previousSummary?.subscription) {
        queryClient.setQueryData<SubscriptionSummary>(['subscription-summary', orgId], {
          ...previousSummary,
          subscription: {
            ...previousSummary.subscription,
            cancel_at_period_end: true,
            pending_plan_id: null,
            updated_at: new Date().toISOString(),
          },
          pendingPlan: null,
        })
      }

      return { previousSummary }
    },
    onError: (_error, variables, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(['subscription-summary', variables.orgId], context.previousSummary)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-summary', variables.orgId] })
    },
  })
}

/**
 * Resume subscription (cancel scheduled cancellation)
 * OPTIMISTIC UPDATE: Updates cache immediately, reverts on error
 */
export const useResumeSubscription = () => {
  const queryClient = useQueryClient()

  type SubscriptionContext = {
    previousSummary?: SubscriptionSummary
  }

  return useMutation<
    any,
    Error,
    { orgId: string; actorUserId: string },
    SubscriptionContext
  >({
    mutationFn: ({ orgId, actorUserId }) =>
      resumeSubscription(orgId, { actorUserId }),
    // OPTIMISTIC UPDATE: Update cache immediately
    onMutate: async ({ orgId }) => {
      await queryClient.cancelQueries({ queryKey: ['subscription-summary', orgId] })

      const previousSummary = queryClient.getQueryData<SubscriptionSummary>(['subscription-summary', orgId])

      if (previousSummary?.subscription) {
        queryClient.setQueryData<SubscriptionSummary>(['subscription-summary', orgId], {
          ...previousSummary,
          subscription: {
            ...previousSummary.subscription,
            cancel_at_period_end: false,
            pending_plan_id: null,
            updated_at: new Date().toISOString(),
          },
          pendingPlan: null,
        })
      }

      return { previousSummary }
    },
    onError: (_error, variables, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(['subscription-summary', variables.orgId], context.previousSummary)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-summary', variables.orgId] })
    },
  })
}

