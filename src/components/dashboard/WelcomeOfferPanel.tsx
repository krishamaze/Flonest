import { useState, useEffect } from 'react'
import { XMarkIcon, SparklesIcon, ClockIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'

interface WelcomeOfferPanelProps {
    /** User's email for personalization */
    userEmail: string
    /** Tenant/organization name (optional, for context display) */
    tenantName?: string
    /** Whether user is org owner (determines CTA visibility) */
    isOrgOwner: boolean
    /** Callback when user clicks upgrade CTA */
    onUpgrade?: () => void
}

const TRIAL_DURATION_DAYS = 90
const TRIAL_VALUE_PER_MONTH = 1999
const LAUNCH_DISCOUNT = 1000
const STORAGE_KEY = 'ft_welcome_offer_dismissed'

/**
 * WelcomeOfferPanel - Professional onboarding panel for dashboard
 * 
 * Features:
 * - Mobile-first responsive design
 * - Trial countdown with urgency messaging
 * - Clear upgrade CTA for org owners
 * - Proper product branding (Flonest.app)
 * - Tenant name shown in context, not as product brand
 */
export function WelcomeOfferPanel({
    userEmail,
    tenantName,
    isOrgOwner,
    onUpgrade,
}: WelcomeOfferPanelProps) {
    const [isDismissed, setIsDismissed] = useState(false)
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null)

    // Check if panel was previously dismissed
    useEffect(() => {
        try {
            const dismissed = localStorage.getItem(STORAGE_KEY)
            if (dismissed === 'true') {
                setIsDismissed(true)
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [])

    // Calculate trial days remaining (mock calculation - should come from backend)
    useEffect(() => {
        // TODO: Replace with actual trial end date from backend
        // For now, showing static value
        setDaysRemaining(TRIAL_DURATION_DAYS)
    }, [])

    const handleDismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEY, 'true')
        } catch {
            // Ignore localStorage errors
        }
        setIsDismissed(true)
    }

    const handleUpgrade = () => {
        if (onUpgrade) {
            onUpgrade()
        } else {
            // Default behavior: navigate to settings/billing
            window.location.href = '/settings?tab=billing'
        }
    }

    if (isDismissed) {
        return null
    }

    const urgencyLevel = daysRemaining !== null && daysRemaining < 30 ? 'high' : 'medium'
    const urgencyColor = urgencyLevel === 'high' ? 'var(--color-error)' : 'var(--color-warning)'

    return (
        <div
            className="relative rounded-xl overflow-hidden mb-lg"
            style={{
                background: `linear-gradient(135deg, ${urgencyColor}, var(--color-primary))`,
                boxShadow: 'var(--shadow-lg)',
            }}
        >
            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-md right-md z-10 p-xs rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 active:scale-95"
                aria-label="Dismiss welcome panel"
            >
                <XMarkIcon className="h-5 w-5 text-white" />
            </button>

            <div className="p-lg pr-xl">
                {/* Header Section */}
                <div className="flex items-start gap-md mb-md">
                    <div className="flex-shrink-0 p-sm rounded-lg bg-white/20">
                        <SparklesIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white mb-xs leading-tight">
                            Welcome to Flonest.app
                        </h2>
                        <p className="text-sm text-white/90 leading-relaxed">
                            {userEmail}
                            {tenantName && (
                                <span className="block text-xs text-white/75 mt-xs">
                                    Organization: {tenantName}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Trial Info Section */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-md mb-md">
                    <div className="flex items-center gap-sm mb-sm">
                        <ClockIcon className="h-5 w-5 text-white" />
                        <p className="text-sm font-semibold text-white">
                            {daysRemaining !== null ? `${daysRemaining} days remaining` : 'Trial Active'}
                        </p>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed">
                        You're on a {TRIAL_DURATION_DAYS}-day free trial worth ₹{TRIAL_VALUE_PER_MONTH.toLocaleString('en-IN')}/month
                    </p>
                    <p className="text-xs text-white/75 mt-xs">
                        Launch offer: ₹{LAUNCH_DISCOUNT.toLocaleString('en-IN')} off your first subscription
                    </p>
                </div>

                {/* CTA Section - Only for org owners */}
                {isOrgOwner && (
                    <div className="flex flex-col sm:flex-row gap-sm">
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={handleUpgrade}
                            className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold shadow-md"
                        >
                            Upgrade Now
                        </Button>
                        <Button
                            variant="ghost"
                            size="md"
                            onClick={handleDismiss}
                            className="flex-1 text-white border-white/30 hover:bg-white/10"
                        >
                            Remind Me Later
                        </Button>
                    </div>
                )}

                {/* Non-owner message */}
                {!isOrgOwner && (
                    <p className="text-xs text-white/75 italic">
                        Contact your organization owner to upgrade your plan
                    </p>
                )}
            </div>

            {/* Decorative gradient overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    background: 'radial-gradient(circle at top right, white, transparent 70%)',
                }}
            />
        </div>
    )
}
