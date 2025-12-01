import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Org } from '../types'
import { InvoiceForm } from '../components/forms/InvoiceForm'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ArrowLeftIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../components/ui/Button'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('InvoiceForm crashed:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="bg-error/10 p-4 rounded-full mb-4">
                        <ExclamationTriangleIcon className="h-8 w-8 text-error" />
                    </div>
                    <h2 className="text-lg font-semibold text-primary-text mb-2">Something went wrong</h2>
                    <p className="text-sm text-secondary-text mb-6 max-w-md">
                        {this.state.error?.message || 'An unexpected error occurred while loading the invoice form.'}
                    </p>
                    <Button
                        variant="primary"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
}

/**
 * Full-page invoice creation view for mobile devices
 * Accessed via /invoices/new route
 */
export function NewInvoicePage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [org, setOrg] = useState<Org | null>(null)
    const [loading, setLoading] = useState(true)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Load organization data
    useEffect(() => {
        let mounted = true

        async function loadOrg() {
            if (!user || !user.orgId) {
                navigate('/inventory')
                return
            }

            try {
                const { data, error } = await supabase
                    .from('orgs')
                    .select('*')
                    .eq('id', user.orgId)
                    .single()

                if (error) throw error

                if (mounted) {
                    setOrg(data)
                    setLoading(false)
                }
            } catch (error) {
                console.error('Error loading org:', error)
                if (mounted) {
                    // Don't set loading false here - let the spinner show until redirect
                    navigate('/inventory')
                }
            }
        }

        loadOrg()

        return () => {
            mounted = false
        }
    }, [user, navigate])

    // Warn user before leaving with unsaved changes
    useEffect(() => {
        if (!hasUnsavedChanges) return

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    const handleBack = () => {
        navigate('/inventory')
    }

    const handleClose = () => {
        if (hasUnsavedChanges) {
            const confirmed = window.confirm(
                'You have unsaved changes. Are you sure you want to exit? Your draft will be saved automatically.'
            )
            if (!confirmed) return
        }
        navigate('/inventory')
    }

    const handleSubmit = async (_invoiceId: string) => {
        setHasUnsavedChanges(false)
        // Navigate back to inventory after successful submission
        // Could also navigate to invoice details: navigate(`/invoices/${invoiceId}`)
        navigate('/inventory')
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (!user || !org) {
        return (
            <div className="flex h-screen items-center justify-center p-4 text-center">
                <p className="text-secondary-text">Unable to load organization details.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Left: Back button */}
                    <button
                        onClick={handleBack}
                        className="p-2 -ml-2 text-muted-text hover:text-primary-text transition-colors rounded-md hover:bg-neutral-100"
                        aria-label="Go back"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>

                    {/* Center: Title */}
                    <h1 className="text-lg font-semibold text-primary-text">New Invoice</h1>

                    {/* Right: Close button */}
                    <button
                        onClick={handleClose}
                        className="p-2 -mr-2 text-muted-text hover:text-primary-text transition-colors rounded-md hover:bg-neutral-100"
                        aria-label="Close"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="container mx-auto px-4 py-6 max-w-4xl">
                    <ErrorBoundary>
                        <InvoiceForm
                            isOpen={true}
                            onClose={handleClose}
                            onSubmit={handleSubmit}
                            orgId={user.orgId!}
                            userId={user.id}
                            org={org}
                            mode="page"
                            onFormChange={(hasChanges: boolean) => setHasUnsavedChanges(hasChanges)}
                        />
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    )
}
