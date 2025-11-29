import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { useOrgSwitcher } from '../components/orgs/OrgSwitcher'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import {
  UserCircleIcon,
  BuildingOfficeIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  CreditCardIcon,
  CalendarDaysIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
import { toast } from 'react-toastify'
import { canManageOrgSettings } from '../lib/permissions'
import { Modal } from '../components/ui/Modal'
import { setGstFromValidation } from '../lib/api/orgs'
import { fetchGSTBusinessData, validateGSTIN } from '../lib/api/gst'
import { extractStateCodeFromGSTIN, getStateNameFromGSTCode } from '../lib/constants/gstStateCodes'
import type { BillingPlan, SubscriptionEvent } from '../types'
import {
  useOrgSettings,
  useUpdateOrgSettings,
  useUploadOrgLogo,
  useRemoveOrgLogo,
} from '../hooks/useOrgSettings'
import {
  useSubscriptionSummary,
  useBillingPlans,
  useUpgradeSubscription,
  useScheduleDowngrade,
  useCancelSubscription,
  useResumeSubscription,
} from '../hooks/useSubscription'

export function SettingsPage() {
  const { user, memberships, agentRelationships } = useAuth()
  const { openSwitcher } = useOrgSwitcher()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  })
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planAction, setPlanAction] = useState<'upgrade' | 'downgrade'>('upgrade')
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null)
  const [gstinInput, setGstinInput] = useState('')
  const [gstinLoading, setGstinLoading] = useState(false)
  const [gstinError, setGstinError] = useState<string | null>(null)
  const [gstBusinessData, setGstBusinessData] = useState<any>(null)

  const isAdmin = canManageOrgSettings(user)

  // React Query hooks - replaces manual state management
  const { data: orgSettings, isLoading: loading, error: orgSettingsError } = useOrgSettings(user?.orgId)
  const updateSettingsMutation = useUpdateOrgSettings()
  const uploadLogoMutation = useUploadOrgLogo()
  const removeLogoMutation = useRemoveOrgLogo()

  // Billing & Subscription hooks
  const { data: billingSummary, isLoading: billingLoading, error: billingError } = useSubscriptionSummary(
    user?.orgId,
    isAdmin
  )
  const { data: billingPlans = [] } = useBillingPlans()
  const upgradeMutation = useUpgradeSubscription()
  const downgradeMutation = useScheduleDowngrade()
  const cancelMutation = useCancelSubscription()
  const resumeMutation = useResumeSubscription()

  // Initialize form data when org settings load
  useEffect(() => {
    if (orgSettings && !isEditing) {
      setFormData({
        name: orgSettings.name || '',
        phone: orgSettings.phone || '',
      })
    }
  }, [orgSettings, isEditing])

  // Show error toast if org settings query fails
  useEffect(() => {
    if (orgSettingsError) {
      toast.error('Failed to load settings')
    }
  }, [orgSettingsError])

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

  // Show error toast if billing query fails
  useEffect(() => {
    if (billingError) {
      toast.error('Failed to load billing information')
    }
  }, [billingError])


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

  const handleOpenPlanModal = (action: 'upgrade' | 'downgrade') => {
    setPlanAction(action)
    setPlanModalOpen(true)
  }

  const handleConfirmPlanChange = async () => {
    if (!user?.orgId || !selectedPlanSlug) return

    try {
      if (planAction === 'upgrade') {
        // OPTIMISTIC UPDATE: Mutation updates cache immediately
        await upgradeMutation.mutateAsync({
          orgId: user.orgId,
          planSlug: selectedPlanSlug,
          actorUserId: user.id,
        })
        toast.success('Subscription upgraded successfully')
      } else {
        // OPTIMISTIC UPDATE: Mutation updates cache immediately
        await downgradeMutation.mutateAsync({
          orgId: user.orgId,
          planSlug: selectedPlanSlug,
          actorUserId: user.id,
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
    if (!user?.orgId) return
    const confirmCancel = window.confirm(
      'Cancellation will take effect at the end of the current billing period. Do you want to continue?'
    )
    if (!confirmCancel) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await cancelMutation.mutateAsync({
        orgId: user.orgId,
        actorUserId: user.id,
      })
      toast.success('Cancellation scheduled for the end of the term')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Unable to cancel subscription')
    }
  }

  const handleResumeSubscription = async () => {
    if (!user?.orgId) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await resumeMutation.mutateAsync({
        orgId: user.orgId,
        actorUserId: user.id,
      })
      toast.success('Subscription will continue beyond this term')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Unable to resume subscription')
    }
  }

  const hasSubscription = Boolean(billingSummary?.subscription)
  const billingActionPending =
    upgradeMutation.isPending ||
    downgradeMutation.isPending ||
    cancelMutation.isPending ||
    resumeMutation.isPending
  const planIntervalLabel = billingSummary?.plan
    ? billingSummary.plan.billing_interval === 'yearly'
      ? 'year'
      : 'month'
    : ''
  const planPriceLabel = billingSummary?.plan
    ? formatCurrency(billingSummary.plan.price_in_paise)
    : null
  const renewalDateLabel = billingSummary?.subscription
    ? formatDate(billingSummary.subscription.current_period_end)
    : '—'
  const seatLimit = billingSummary?.seatLimit ?? null
  const seatUsageValue = billingSummary?.seatUsage ?? 0
  const seatUsageLabel = seatLimit
    ? `${seatUsageValue}/${seatLimit} seats`
    : `${seatUsageValue} seats in use`
  const seatUsagePercent = seatLimit && seatLimit > 0
    ? Math.min(100, Math.round((seatUsageValue / seatLimit) * 100))
    : null
  const subscriptionStatus = billingSummary?.subscription?.status ?? 'inactive'
  const statusLabel = STATUS_LABELS[subscriptionStatus] ?? STATUS_LABELS.inactive
  const statusClass = STATUS_STYLES[subscriptionStatus] ?? STATUS_STYLES.inactive
  const cancellationScheduled = Boolean(billingSummary?.subscription?.cancel_at_period_end)
  const billingHistory = billingSummary?.events.slice(0, 5) ?? []


  const handleSaveSettings = async () => {
    if (!user?.orgId || !isAdmin) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await updateSettingsMutation.mutateAsync({
        orgId: user.orgId,
        name: formData.name,
        phone: formData.phone || null,
      })
      toast.success('Settings saved successfully')
      setIsEditing(false)
    } catch (error: any) {
      // Error handling is done by mutation's onError (rollback happens automatically)
      toast.error(error.message || 'Failed to save settings')
    }
  }

  const handleCancelEdit = () => {
    if (orgSettings) {
      setFormData({
        name: orgSettings.name || '',
        phone: orgSettings.phone || '',
      })
    }
    setIsEditing(false)
  }

  const hasChanges = useMemo(() => {
    if (!orgSettings) return false
    return formData.name !== orgSettings.name || formData.phone !== orgSettings.phone
  }, [formData, orgSettings])

  const gstVerified = orgSettings?.gst_verification_status === 'verified'
  const isUnregistered = !orgSettings?.gst_number || orgSettings.gst_number.trim() === ''

  // Auto-fetch GST data when GSTIN is complete and valid
  useEffect(() => {
    if (isUnregistered && gstinInput && validateGSTIN(gstinInput)) {
      setGstinLoading(true)
      setGstinError(null)
      fetchGSTBusinessData(gstinInput)
        .then((data) => {
          if (data) {
            setGstBusinessData(data)
          } else {
            setGstinError('GSTIN not found. Please verify and try again.')
          }
        })
        .catch((error: any) => {
          setGstinError(error.message || 'Failed to fetch GST data. Please try again.')
          setGstBusinessData(null)
        })
        .finally(() => {
          setGstinLoading(false)
        })
    } else {
      setGstBusinessData(null)
    }
  }, [gstinInput, isUnregistered])

  const handleAddGSTIN = async () => {
    if (!user?.orgId || !gstinInput || !validateGSTIN(gstinInput)) {
      setGstinError('Please enter a valid 15-character GSTIN')
      return
    }

    if (!gstBusinessData) {
      setGstinError('Please wait for GST data to load')
      return
    }

    setGstinLoading(true)
    setGstinError(null)

    try {
      // Update org state/pincode if needed from GST data
      const gstStateCode = extractStateCodeFromGSTIN(gstinInput)
      const stateName = gstStateCode ? getStateNameFromGSTCode(gstStateCode) : null

      if (stateName && orgSettings) {
        await supabase
          .from('orgs')
          .update({
            state: stateName,
            pincode: gstBusinessData.address.pincode || orgSettings.address || null,
          })
          .eq('id', user.orgId)
      }

      // Set GST number - always unverified until platform admin manually verifies
      await setGstFromValidation(
        user.orgId,
        gstinInput.toUpperCase(),
        true,
        'unverified',
        'manual'
      )

      toast.success('GSTIN added successfully. Awaiting platform admin verification.')
      setGstinInput('')
      setGstBusinessData(null)
      // Invalidate org settings query to refetch with new GST data
      queryClient.invalidateQueries({ queryKey: ['org-settings', user.orgId] })
    } catch (error: any) {
      setGstinError(error.message || 'Failed to add GSTIN. Please try again.')
    } finally {
      setGstinLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.orgId || !isAdmin) return

    const file = e.target.files?.[0]
    if (!file) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache after upload completes
      await uploadLogoMutation.mutateAsync({
        orgId: user.orgId,
        file,
      })
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      // Error handling is done by mutation
      toast.error(error.message || 'Failed to upload logo')
    }
  }

  const handleRemoveLogo = async () => {
    if (!user?.orgId || !isAdmin || !orgSettings?.custom_logo_url) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await removeLogoMutation.mutateAsync({
        orgId: user.orgId,
      })
      toast.success('Logo removed successfully')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Failed to remove logo')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-md">
        <div>
          <h1 className="text-xl font-semibold text-primary-text">Settings</h1>
          <p className="mt-xs text-sm text-secondary-text">
            Only organization admins can access settings
          </p>
        </div>
        <Card>
          <CardContent className="p-lg text-center text-secondary-text">
            You don't have permission to access this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Settings</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Manage your organization profile and settings
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <UserCircleIcon className="h-5 w-5 text-primary" />
            Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-md">
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              User ID
            </label>
            <div className="flex gap-sm items-center">
              <Input
                type="text"
                value={user?.id || ''}
                disabled
                className="bg-neutral-100 font-mono text-xs flex-1"
                readOnly
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (user?.id) {
                    navigator.clipboard.writeText(user.id)
                    toast.success('User ID copied to clipboard')
                  }
                }}
                className="min-w-[80px]"
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-text mt-xs">
              Permanent identifier - cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Organization ID
            </label>
            <div className="flex gap-sm items-center">
              <Input
                type="text"
                value={user?.orgId || ''}
                disabled
                className="bg-neutral-100 font-mono text-xs flex-1"
                readOnly
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (user?.orgId) {
                    navigator.clipboard.writeText(user.orgId)
                    toast.success('Organization ID copied to clipboard')
                  }
                }}
                className="min-w-[80px]"
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-text mt-xs">
              Permanent identifier - cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Email
            </label>
            <Input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-neutral-100"
            />
            <p className="text-xs text-muted-text mt-xs">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Role
            </label>
            <Input
              type="text"
              value={user?.role === 'org_owner' ? 'Org Owner' : user?.role || ''}
              disabled
              className="bg-neutral-100 capitalize"
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization Switching */}
      {(memberships.length > 1 || agentRelationships.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-sm">
              <BuildingOfficeIcon className="h-5 w-5 text-primary" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-md">
            <div>
              <p className="text-sm text-secondary-text mb-md">
                {memberships.length > 1
                  ? `You have access to ${memberships.length} organization${memberships.length > 1 ? 's' : ''}. Switch between them or manage agent contexts.`
                  : agentRelationships.length > 0
                    ? 'You can switch between your business and agent contexts.'
                    : 'Switch between organizations or agent contexts.'}
              </p>
              <Button
                variant="primary"
                onClick={openSwitcher}
                className="w-full sm:w-auto"
              >
                Switch Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <PhotoIcon className="h-5 w-5 text-primary" />
            Organization Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-md">
          <div className="flex items-center gap-md">
            {/* Logo Preview */}
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white shadow-md p-2 border border-neutral-200">
              {orgSettings?.custom_logo_url ? (
                <img
                  src={orgSettings.custom_logo_url}
                  alt="Organization logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src="/pwa-192x192.png"
                  alt="Default Flonest logo"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="flex-1 space-y-sm">
              <p className="text-sm text-secondary-text">
                {orgSettings?.custom_logo_url
                  ? 'Custom logo is active'
                  : 'Using default Flonest logo'}
              </p>
              <div className="flex gap-sm flex-wrap">
                <label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadLogoMutation.isPending}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={uploadLogoMutation.isPending}
                    disabled={uploadLogoMutation.isPending}
                    className="cursor-pointer"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-xs" />
                    {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </label>

                {orgSettings?.custom_logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-error"
                  >
                    Remove Logo
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-text">
                Recommended: Square image, PNG or JPG, max 2MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <BuildingOfficeIcon className="h-5 w-5 text-primary" />
            Organization Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-md">
          {/* Legal Name - Read-only after verification */}
          {gstVerified && orgSettings?.legal_name && (
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-xs">
                Legal Name (GST Registered)
              </label>
              <Input
                type="text"
                value={orgSettings.legal_name}
                disabled
                className="bg-neutral-100"
              />
              <p className="text-xs text-muted-text mt-xs">
                From GST verification - immutable. Used on GST invoices and tax documents.
              </p>
            </div>
          )}

          {/* Display/Brand Name - Always editable */}
          {/* 
            IMPORTANT: For GST-registered orgs:
            - legal_name: Immutable, from GST portal, used on invoices/tax docs
            - name (display name): Editable, used in app UI only, not on legal documents
          */}
          <div>
            <Input
              label={gstVerified ? "Display Name (Brand Name)" : "Organization Name"}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="How you want your business displayed in the app"
              disabled={!isEditing}
              required
            />
            {gstVerified && (
              <p className="text-xs text-muted-text mt-xs">
                Used in app interface only. Legal name from GST verification is used on invoices and tax documents.
              </p>
            )}
          </div>

          {/* Phone Number - Always editable */}
          <Input
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91 98765 43210"
            disabled={!isEditing}
          />

          {/* GSTIN - Read-only after verification, or input for unregistered */}
          {orgSettings?.gst_number ? (
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-xs">
                GSTIN {gstVerified ? '(Verified)' : '(Pending Verification)'}
              </label>
              <div className="flex gap-sm items-center">
                <Input
                  type="text"
                  value={orgSettings.gst_number}
                  disabled
                  className="bg-neutral-100 flex-1 font-mono"
                />
                {gstVerified && (
                  <span className="inline-flex items-center px-sm py-xs rounded-full bg-success-light text-success-dark text-xs font-semibold">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-text mt-xs">
                {gstVerified
                  ? 'Verified by platform admin - cannot be changed'
                  : 'Awaiting platform admin verification'}
              </p>
            </div>
          ) : isAdmin && isUnregistered ? (
            <div className="space-y-sm">
              <label className="block text-sm font-medium text-secondary-text">
                Add GST Registration
              </label>
              <div className="space-y-xs">
                <Input
                  type="text"
                  value={gstinInput}
                  onChange={(e) => {
                    setGstinInput(e.target.value.toUpperCase().replace(/\s/g, ''))
                    setGstinError(null)
                  }}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  className="font-mono"
                  disabled={gstinLoading}
                />
                {gstinInput.length > 0 && gstinInput.length < 15 && (
                  <p className="text-xs text-warning">GSTIN must be exactly 15 characters</p>
                )}
                {gstinError && (
                  <p className="text-xs text-error">{gstinError}</p>
                )}
                {gstBusinessData && (
                  <div className="rounded-md border border-success bg-success-light/20 p-sm text-xs space-y-xs">
                    <p className="font-semibold text-success-dark">GST Data Found:</p>
                    <p><strong>Legal Name:</strong> {gstBusinessData.legal_name || 'N/A'}</p>
                    <p><strong>State:</strong> {gstBusinessData.address.state || 'N/A'}</p>
                    <p className="text-muted-text">GSTIN will be marked unverified until platform admin verifies.</p>
                  </div>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddGSTIN}
                  disabled={!validateGSTIN(gstinInput) || !gstBusinessData || gstinLoading}
                  isLoading={gstinLoading}
                >
                  Add GSTIN
                </Button>
              </div>
              <p className="text-xs text-muted-text">
                After adding GSTIN, it will be reviewed by platform admin before activation.
              </p>
            </div>
          ) : null}

          {/* Address - Read-only after verification */}
          {orgSettings?.address && (
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-xs">
                Principal Place of Business {gstVerified ? '(GST Registered)' : ''}
              </label>
              <textarea
                value={orgSettings.address}
                disabled
                className="w-full rounded-md border bg-neutral-100 px-md py-sm text-sm"
                rows={3}
              />
              <p className="text-xs text-muted-text mt-xs">
                {gstVerified
                  ? 'From GST verification - cannot be changed'
                  : 'Will be updated from GST verification'}
              </p>
            </div>
          )}

          {/* Edit/Save buttons */}
          {!isEditing ? (
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setIsEditing(true)}
            >
              Edit Details
            </Button>
          ) : (
            <div className="flex gap-sm">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleSaveSettings}
                isLoading={updateSettingsMutation.isPending}
                disabled={!hasChanges || updateSettingsMutation.isPending}
              >
                Save Changes
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleCancelEdit}
                disabled={updateSettingsMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing & Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <CreditCardIcon className="h-5 w-5 text-primary" />
            Billing & Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-lg">
          {billingLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : billingError ? (
            <div className="rounded-lg border border-error bg-error-light/40 p-md text-sm text-error-dark space-y-sm">
              <p>{billingError instanceof Error ? billingError.message : 'Failed to load billing information'}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['subscription-summary', user?.orgId] })}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {hasSubscription ? (
                <div className="space-y-md">
                  <div className="flex items-start justify-between gap-sm">
                    <div>
                      <p className="text-sm text-muted-text">Current plan</p>
                      <p className="text-xl font-semibold text-primary-text">{billingSummary?.plan?.name ?? 'Custom'}</p>
                      {planPriceLabel && (
                        <p className="text-sm text-secondary-text">
                          {planPriceLabel}{planIntervalLabel && <span className="text-muted-text"> / {planIntervalLabel}</span>}
                        </p>
                      )}
                    </div>
                    <span className={`px-sm py-xs rounded-full text-xs font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="grid gap-sm md:grid-cols-2 text-sm text-secondary-text">
                    <div className="flex items-center gap-sm rounded-lg border border-neutral-200 px-md py-sm">
                      <CalendarDaysIcon className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-primary-text">Renews</p>
                        <p>{renewalDateLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-sm rounded-lg border border-neutral-200 px-md py-sm">
                      <BanknotesIcon className="h-5 w-5 text-primary" />
                      <div className="w-full">
                        <p className="font-medium text-primary-text">Seats in use</p>
                        <p>{seatUsageLabel}</p>
                        {seatUsagePercent !== null && (
                          <div className="mt-xs h-2 w-full rounded-full bg-neutral-100">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${seatUsagePercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {billingSummary?.pendingPlan && (
                    <div className="rounded-lg border border-warning bg-warning-light/40 px-md py-sm text-sm text-warning-dark">
                      Scheduled to move to <span className="font-semibold">{billingSummary.pendingPlan.name}</span> on {renewalDateLabel}.
                    </div>
                  )}

                  {cancellationScheduled && (
                    <div className="rounded-lg border border-error bg-error-light px-md py-sm text-sm text-error-dark">
                      Cancellation will take effect at the end of this billing period.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-sm">
                    {planOptions.length > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenPlanModal('upgrade')}
                      >
                        Upgrade plan
                      </Button>
                    )}
                    {planOptions.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenPlanModal('downgrade')}
                      >
                        Schedule downgrade
                      </Button>
                    )}
                    {cancellationScheduled ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-success"
                        onClick={handleResumeSubscription}
                        isLoading={resumeMutation.isPending}
                        disabled={billingActionPending}
                      >
                        Resume subscription
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-error"
                        onClick={handleCancelSubscription}
                        isLoading={cancelMutation.isPending}
                        disabled={billingActionPending}
                      >
                        Cancel at period end
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-md py-lg text-center space-y-sm">
                  <p className="text-base font-medium text-primary-text">No subscription yet</p>
                  <p className="text-sm text-secondary-text">
                    Choose a plan to unlock billing insights and admin controls.
                  </p>
                  {planOptions.length > 0 && (
                    <Button variant="primary" onClick={() => handleOpenPlanModal('upgrade')}>
                      Choose a plan
                    </Button>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-secondary-text mb-sm">Billing activity</h3>
                {billingHistory.length === 0 ? (
                  <p className="text-sm text-muted-text">No activity yet.</p>
                ) : (
                  <div className="space-y-sm">
                    {billingHistory.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between gap-sm rounded-lg border border-neutral-200 px-md py-sm"
                      >
                        <div>
                          <p className="text-sm font-medium text-primary-text">{getEventTitle(event)}</p>
                          <p className="text-xs text-secondary-text">{getEventDetail(event)}</p>
                        </div>
                        <p className="text-xs text-muted-text whitespace-nowrap">
                          {formatDateTime(event.event_time)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Modal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={planAction === 'upgrade' ? 'Choose a plan' : 'Schedule downgrade'}
      >
        {planOptions.length === 0 ? (
          <p className="text-sm text-secondary-text">No alternative plans available right now.</p>
        ) : (
          <div className="space-y-md">
            <div className="space-y-sm">
              {planOptions.map((plan) => {
                const seatLimitLabel = getSeatLimitLabel(plan)
                const isSelected = selectedPlanSlug === plan.slug
                return (
                  <button
                    type="button"
                    key={plan.id}
                    onClick={() => setSelectedPlanSlug(plan.slug)}
                    className={`w-full rounded-lg border px-md py-sm text-left transition-all ${isSelected
                        ? 'border-primary bg-primary-light/20 shadow-primary'
                        : 'border-neutral-200 hover:border-primary'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-sm">
                      <div>
                        <p className="font-semibold text-primary-text">{plan.name}</p>
                        <p className="text-sm text-secondary-text">{plan.description}</p>
                        <p className="text-xs text-muted-text mt-xs">{seatLimitLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-primary-text">
                          {formatCurrency(plan.price_in_paise)}
                        </p>
                        <p className="text-xs text-muted-text capitalize">{plan.billing_interval}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={handleConfirmPlanChange}
              disabled={!selectedPlanSlug || billingActionPending}
              isLoading={
                (planAction === 'upgrade' && upgradeMutation.isPending) ||
                (planAction === 'downgrade' && downgradeMutation.isPending)
              }
            >
              {planAction === 'upgrade' ? 'Confirm upgrade' : 'Confirm downgrade'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SettingsPage

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success-light text-success-dark',
  trialing: 'bg-warning-light text-warning-dark',
  past_due: 'bg-error-light text-error-dark',
  canceled: 'bg-neutral-100 text-neutral-600',
  incomplete: 'bg-warning-light text-warning-dark',
  inactive: 'bg-neutral-100 text-neutral-600',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  inactive: 'Not active',
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Subscription created',
  plan_changed: 'Plan changed',
  cancellation_scheduled: 'Cancellation scheduled',
  canceled: 'Subscription canceled',
  renewed: 'Renewed',
  payment_failed: 'Payment failed',
  status_updated: 'Status updated',
}

function formatCurrency(paise: number) {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees)
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function extractSeatLimit(metadata: BillingPlan['metadata']) {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return null
  }
  const value = (metadata as Record<string, any>).seats_included
  return typeof value === 'number' ? value : null
}

function getSeatLimitLabel(plan: BillingPlan) {
  const limit = extractSeatLimit(plan.metadata)
  if (!limit) return 'Usage-based seats'
  return `${limit} seats included`
}

function parsePayload(payload: SubscriptionEvent['payload']) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {}
  }
  return payload as Record<string, any>
}

function getEventTitle(event: SubscriptionEvent) {
  return EVENT_LABELS[event.event_type] ?? 'Subscription update'
}

function getEventDetail(event: SubscriptionEvent) {
  const payload = parsePayload(event.payload)
  if (payload.plan) {
    return `Plan: ${payload.plan}`
  }
  if (payload.action) {
    return String(payload.action)
  }
  if (payload.effective_on) {
    return `Effective ${formatDate(payload.effective_on)}`
  }
  return 'Details updated'
}
