import { ReactNode } from 'react'
import { Button } from './ui/Button'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { ExclamationTriangleIcon, ArrowPathIcon, ArrowRightOnRectangleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'

interface QueryErrorHandlerProps {
    isLoading: boolean
    isError: boolean
    error: Error | null
    children: ReactNode
    onRetry?: () => void
    loadingTimeout?: number // milliseconds, default 30000 (30s)
}

/**
 * Query Error Handler Component
 * Handles loading states with timeout and error states for React Query
 * Shows loader, timeout message, or error UI with reload/logout options
 */
export function QueryErrorHandler({
    isLoading,
    isError,
    error,
    children,
    onRetry,
    loadingTimeout = 30000,
}: QueryErrorHandlerProps) {
    const [showTimeout, setShowTimeout] = React.useState(false)

    React.useEffect(() => {
        if (!isLoading) {
            setShowTimeout(false)
            return
        }

        const timer = setTimeout(() => {
            setShowTimeout(true)
        }, loadingTimeout)

        return () => clearTimeout(timer)
    }, [isLoading, loadingTimeout])

    const handleReload = () => {
        window.location.reload()
    }

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut()
            window.location.href = '/login'
        } catch (err) {
            console.error('Error signing out:', err)
            window.location.href = '/login'
        }
    }

    const handleRetry = () => {
        setShowTimeout(false)
        if (onRetry) {
            onRetry()
        } else {
            window.location.reload()
        }
    }

    // Show timeout message if loading takes too long
    if (isLoading && showTimeout) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                    <ClockIcon className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-lg font-semibold text-primary-text mb-2">
                    Taking longer than expected
                </h2>
                <p className="text-sm text-secondary-text mb-6 text-center max-w-md">
                    The request is taking longer than usual. Please check your connection or try again.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        onClick={handleRetry}
                        variant="primary"
                        className="flex items-center justify-center gap-2"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Retry
                    </Button>
                    <Button
                        onClick={handleLogout}
                        variant="secondary"
                        className="flex items-center justify-center gap-2"
                    >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Logout
                    </Button>
                </div>
            </div>
        )
    }

    // Show loading spinner
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    // Show error UI
    if (isError) {
        const errorMessage = error?.message || 'Failed to load data'

        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-primary-text mb-2">
                    Error loading data
                </h2>
                <p className="text-sm text-secondary-text mb-6 text-center max-w-md">
                    {errorMessage}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        onClick={handleRetry}
                        variant="primary"
                        className="flex items-center justify-center gap-2"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Retry
                    </Button>
                    <Button
                        onClick={handleReload}
                        variant="secondary"
                        className="flex items-center justify-center gap-2"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Reload Page
                    </Button>
                    <Button
                        onClick={handleLogout}
                        variant="secondary"
                        className="flex items-center justify-center gap-2"
                    >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Logout
                    </Button>
                </div>
            </div>
        )
    }

    return <>{children}</>
}

// Add React import
import React from 'react'
