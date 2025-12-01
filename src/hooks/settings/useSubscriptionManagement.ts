import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import type { BillingPlan } from '../../types'
import type { SubscriptionSummary } from '../../lib/api/billing'
import {
  useSubscriptionSummary,
  useBillingPlans,
  useUpgradeSubscription,
  useScheduleDowngrade,
  useCancelSubscription,
  useResumeSubscription,
} from '../useSubscription'

export interface UseSubscriptionManagementReturn {
  // Data
  billingSummary: SubscriptionSummary | undefined
  billingLoading: boolean
  billingError: Error | null
  planOptions: BillingPlan[]

  // Modal State
  planModalOpen: boolean
  setPlanModalOpen: (open: boolean) => void
  planAction: 'upgrade' | 'downgrade'
  selectedPlanSlug: string | null
  setSelectedPlanSlug: (slug: string | null) => void

  // Actions
  onRetry: () => void
  onOpenPlanModal: (action: 'upgrade' | 'downgrade') => void
  onConfirmPlanChange: () => void
  onCancelSubscription: () => void
  onResumeSubscription: () => void

  // Loading States
  isUpgradePending: boolean
  isDowngradePending: boolean
  isCancelPending: boolean
  isResumePending: boolean
}

export function useSubscriptionManagement(
  orgId: string | null | undefined,
  userId: string | undefined,
  isAdmin: boolean
): UseSubscriptionManagementReturn {
  const queryClient = useQueryClient()

  // COPY PHASE: State copied from SettingsPage.tsx lines 42-44
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planAction, setPlanAction] = useState<'upgrade' | 'downgrade'>('upgrade')
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null)

  // COPY PHASE: Billing & Subscription hooks copied from SettingsPage.tsx lines 59-67
  const { data: billingSummary, isLoading: billingLoading, error: billingError } = useSubscriptionSummary(
    orgId,
    isAdmin
  )
  const { data: billingPlans = [] } = useBillingPlans()
  const upgradeMutation = useUpgradeSubscription()
  const downgradeMutation = useScheduleDowngrade()
  const cancelMutation = useCancelSubscription()
  const resumeMutation = useResumeSubscription()

  // COPY PHASE: planOptions memo copied from SettingsPage.tsx lines 86-95
  const planOptions = useMemo(() => {
    if (!billingPlans.length) return []
    const currentPlanId = billingSummary?.plan?.id
    return billingPlans
      .filter((plan) => {
        if (!currentPlanId) return true
        return plan.id !== currentPlanId
      })
      .sort((a, b) => a.price_in_paise - b.price_in_paise)
  }, [billingPlans, billingSummary?.plan?.id])

  // COPY PHASE: Error toast effect copied from SettingsPage.tsx lines 98-102
  useEffect(() => {
    if (billingError) {
      toast.error('Failed to load billing information')
    }
  }, [billingError])

  // COPY PHASE: Default plan selection effect copied from SettingsPage.tsx lines 105-118
  useEffect(() => {
    if (!planModalOpen) return
    if (!planOptions.length) {
      setSelectedPlanSlug(null)
      return
    }

    setSelectedPlanSlug((prev) => {
      if (prev && planOptions.some((plan) => plan.slug === prev)) {
        return prev
      }
      return planOptions[0].slug
    })
  }, [planModalOpen, planOptions])

  // COPY PHASE: Handlers copied from SettingsPage.tsx lines 120-187
  const handleOpenPlanModal = (action: 'upgrade' | 'downgrade') => {
    setPlanAction(action)
    setPlanModalOpen(true)
  }

  const handleConfirmPlanChange = async () => {
    if (!orgId || !selectedPlanSlug || !userId) return

    try {
      if (planAction === 'upgrade') {
        // OPTIMISTIC UPDATE: Mutation updates cache immediately
        await upgradeMutation.mutateAsync({
          orgId,
          planSlug: selectedPlanSlug,
          actorUserId: userId,
        })
        toast.success('Subscription upgraded successfully')
      } else {
        // OPTIMISTIC UPDATE: Mutation updates cache immediately
        await downgradeMutation.mutateAsync({
          orgId,
          planSlug: selectedPlanSlug,
          actorUserId: userId,
        })
        toast.success('Downgrade scheduled for the next renewal')
      }
      setPlanModalOpen(false)
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Unable to update subscription')
    }
  }

  const handleCancelSubscription = async () => {
    if (!orgId || !userId) return
    const confirmCancel = window.confirm(
      'Cancellation will take effect at the end of the current billing period. Do you want to continue?'
    )
    if (!confirmCancel) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await cancelMutation.mutateAsync({
        orgId,
        actorUserId: userId,
      })
      toast.success('Cancellation scheduled for the end of the term')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Unable to cancel subscription')
    }
  }

  const handleResumeSubscription = async () => {
    if (!orgId || !userId) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await resumeMutation.mutateAsync({
        orgId,
        actorUserId: userId,
      })
      toast.success('Subscription will continue beyond this term')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Unable to resume subscription')
    }
  }

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription-summary', orgId] })
  }

  return {
    billingSummary,
    billingLoading,
    billingError,
    planOptions,
    planModalOpen,
    setPlanModalOpen,
    planAction,
    selectedPlanSlug,
    setSelectedPlanSlug,
    onRetry: handleRetry,
    onOpenPlanModal: handleOpenPlanModal,
    onConfirmPlanChange: handleConfirmPlanChange,
    onCancelSubscription: handleCancelSubscription,
    onResumeSubscription: handleResumeSubscription,
    isUpgradePending: upgradeMutation.isPending,
    isDowngradePending: downgradeMutation.isPending,
    isCancelPending: cancelMutation.isPending,
    isResumePending: resumeMutation.isPending,
  }
}
