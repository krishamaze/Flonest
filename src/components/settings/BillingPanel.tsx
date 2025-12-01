import {
    CreditCardIcon,
    CalendarDaysIcon,
    BanknotesIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Modal } from '../ui/Modal'
import type { BillingPlan, SubscriptionEvent } from '../../types'
import { useSubscriptionManagement } from '../../hooks/settings/useSubscriptionManagement'

interface BillingPanelProps {
    // Context Props
    orgId: string | null | undefined
    userId: string | undefined
    isAdmin: boolean
}

export function BillingPanel({
    orgId,
    userId,
    isAdmin,
}: BillingPanelProps) {
    // SWITCH PHASE: Use hook directly instead of props
    const {
        billingSummary,
        billingLoading,
        billingError,
        planOptions,
        planModalOpen,
        setPlanModalOpen,
        planAction,
        selectedPlanSlug,
        setSelectedPlanSlug,
        onRetry,
        onOpenPlanModal,
        onConfirmPlanChange,
        onCancelSubscription,
        onResumeSubscription,
        isUpgradePending,
        isDowngradePending,
        isCancelPending,
        isResumePending,
    } = useSubscriptionManagement(orgId, userId, isAdmin)
    const hasSubscription = Boolean(billingSummary?.subscription)
    const billingActionPending =
        isUpgradePending ||
        isDowngradePending ||
        isCancelPending ||
        isResumePending

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

    return (
        <div className="space-y-md">
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
                                onClick={onRetry}
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
                                                onClick={() => onOpenPlanModal('upgrade')}
                                            >
                                                Upgrade plan
                                            </Button>
                                        )}
                                        {planOptions.length > 0 && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => onOpenPlanModal('downgrade')}
                                            >
                                                Schedule downgrade
                                            </Button>
                                        )}
                                        {cancellationScheduled ? (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="text-success"
                                                onClick={onResumeSubscription}
                                                isLoading={isResumePending}
                                                disabled={billingActionPending}
                                            >
                                                Resume subscription
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-error"
                                                onClick={onCancelSubscription}
                                                isLoading={isCancelPending}
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
                                        <Button variant="primary" onClick={() => onOpenPlanModal('upgrade')}>
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
                            onClick={onConfirmPlanChange}
                            disabled={!selectedPlanSlug || billingActionPending}
                            isLoading={
                                (planAction === 'upgrade' && isUpgradePending) ||
                                (planAction === 'downgrade' && isDowngradePending)
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

// --- Helpers & Constants ---

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
