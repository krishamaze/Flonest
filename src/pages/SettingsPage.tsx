import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
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
import {
  fetchSubscriptionSummary,
  listActivePlans,
  upgradeSubscription,
  scheduleDowngrade,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
} from '../lib/api/billing'
import type { SubscriptionSummary } from '../lib/api/billing'
import type { BillingPlan, SubscriptionEvent } from '../types'

interface OrgSettings {
  id: string
  name: string
  custom_logo_url: string | null
  phone: string | null
  address: string | null
  gstin: string | null
}

export function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    gstin: '',
  })
  const [billingSummary, setBillingSummary] = useState<SubscriptionSummary | null>(null)
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([])
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planAction, setPlanAction] = useState<'upgrade' | 'downgrade'>('upgrade')
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null)
  const [billingAction, setBillingAction] = useState<null | 'upgrade' | 'downgrade' | 'cancel' | 'resume'>(null)

  const isAdmin = canManageOrgSettings(user)
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

  useEffect(() => {
    loadOrgSettings()
  }, [user])

  useEffect(() => {
    if (!isAdmin || !user?.orgId) {
      setBillingLoading(false)
      return
    }
    loadBillingSummary()
  }, [isAdmin, user?.orgId])

  const loadOrgSettings = async () => {
    if (!user?.orgId) return

    try {
      const { data, error } = await supabase
        .from('orgs')
        .select('id, name, custom_logo_url, phone, address, gst_number')
        .eq('id', user.orgId)
        .single()

      if (error) throw error

      if (data) {
        setOrgSettings(data as any)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          gstin: data.gst_number || '',
        })
      }
    } catch (error: any) {
      console.error('Error loading org settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

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
    const actionType = planAction
    setBillingAction(actionType)
    try {
      if (actionType === 'upgrade') {
        await upgradeSubscription(user.orgId, selectedPlanSlug, { actorUserId: user.id })
        toast.success('Subscription upgraded successfully')
      } else {
        await scheduleDowngrade(user.orgId, selectedPlanSlug, { actorUserId: user.id })
        toast.success('Downgrade scheduled for the next renewal')
      }
      setPlanModalOpen(false)
      await loadBillingSummary()
    } catch (error: any) {
      console.error('Error updating subscription:', error)
      toast.error(error.message || 'Unable to update subscription')
    } finally {
      setBillingAction(null)
    }
  }

  const handleCancelSubscription = async () => {
    if (!user?.orgId) return
    const confirmCancel = window.confirm(
      'Cancellation will take effect at the end of the current billing period. Do you want to continue?'
    )
    if (!confirmCancel) return

    setBillingAction('cancel')
    try {
      await cancelSubscriptionAtPeriodEnd(user.orgId, { actorUserId: user.id })
      toast.success('Cancellation scheduled for the end of the term')
      await loadBillingSummary()
    } catch (error: any) {
      console.error('Error scheduling cancellation:', error)
      toast.error(error.message || 'Unable to cancel subscription')
    } finally {
      setBillingAction(null)
    }
  }

  const handleResumeSubscription = async () => {
    if (!user?.orgId) return
    setBillingAction('resume')
    try {
      await resumeSubscription(user.orgId, { actorUserId: user.id })
      toast.success('Subscription will continue beyond this term')
      await loadBillingSummary()
    } catch (error: any) {
      console.error('Error resuming subscription:', error)
      toast.error(error.message || 'Unable to resume subscription')
    } finally {
      setBillingAction(null)
    }
  }

  const hasSubscription = Boolean(billingSummary?.subscription)
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

  const loadBillingSummary = async () => {
    if (!user?.orgId || !isAdmin) {
      setBillingSummary(null)
      setBillingPlans([])
      return
    }

    setBillingError(null)
    setBillingLoading(true)
    try {
      const [summary, plans] = await Promise.all([
        fetchSubscriptionSummary(user.orgId),
        listActivePlans(),
      ])
      setBillingSummary(summary)
      setBillingPlans(plans)
    } catch (error: any) {
      console.error('Error loading billing information:', error)
      setBillingError(error.message || 'Failed to load billing information')
    } finally {
      setBillingLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!user?.orgId || !isAdmin) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('orgs')
        .update({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          gst_number: formData.gstin,
        })
        .eq('id', user.orgId)

      if (error) throw error

      toast.success('Settings saved successfully')
      await loadOrgSettings()
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error(error.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.orgId || !isAdmin) return
    
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB')
      return
    }

    setUploading(true)
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.orgId}-${Date.now()}.${fileExt}`
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
        .eq('id', user.orgId)

      if (updateError) throw updateError

      toast.success('Logo uploaded successfully')
      await loadOrgSettings()
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!user?.orgId || !isAdmin || !orgSettings?.custom_logo_url) return

    try {
      // Update org to remove logo
      const { error } = await supabase
        .from('orgs')
        .update({ custom_logo_url: null })
        .eq('id', user.orgId)

      if (error) throw error

      toast.success('Logo removed successfully')
      await loadOrgSettings()
    } catch (error: any) {
      console.error('Error removing logo:', error)
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
              value={user?.role === 'admin' ? 'Owner/Admin' : user?.role || ''}
              disabled
              className="bg-neutral-100 capitalize"
            />
          </div>
        </CardContent>
      </Card>

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
                  alt="Default finetune logo" 
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="flex-1 space-y-sm">
              <p className="text-sm text-secondary-text">
                {orgSettings?.custom_logo_url 
                  ? 'Custom logo is active' 
                  : 'Using default finetune logo'}
              </p>
              <div className="flex gap-sm flex-wrap">
                <label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={uploading}
                    disabled={uploading}
                    className="cursor-pointer"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-xs" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
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
          <Input
            label="Organization Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter organization name"
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91 98765 43210"
          />

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter business address"
              rows={3}
              className="w-full rounded-md border border-neutral-200 bg-bg-card px-md py-sm text-sm text-primary-text placeholder-muted-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 transition-base"
            />
          </div>

          <Input
            label="GSTIN (Optional)"
            type="text"
            value={formData.gstin}
            onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSaveSettings}
            isLoading={saving}
            disabled={saving}
          >
            Save Settings
          </Button>
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
              <p>{billingError}</p>
              <Button variant="secondary" size="sm" onClick={loadBillingSummary}>
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
                        isLoading={billingAction === 'resume'}
                      >
                        Resume subscription
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-error"
                        onClick={handleCancelSubscription}
                        isLoading={billingAction === 'cancel'}
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
                    className={`w-full rounded-lg border px-md py-sm text-left transition-all ${
                      isSelected
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
              disabled={!selectedPlanSlug}
              isLoading={billingAction === planAction}
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
