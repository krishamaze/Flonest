import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Org } from '../types'
import { InvoiceForm } from '../components/forms/InvoiceForm'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../components/ui/Button'
import { FocusPageLayout } from '../components/layout/FocusPageLayout'

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
 * Edit invoice / continue draft page
 * Accessed via /invoices/:id/edit route
 */
export function EditInvoicePage() {
    const { id } = useParams<{ id: string }>()
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
        navigate('/inventory')
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (!user || !org || !id) {
        return (
            <div className="flex h-screen items-center justify-center p-4 text-center">
                <p className="text-secondary-text">Unable to load invoice.</p>
            </div>
        )
    }

    return (
        <FocusPageLayout
            title="Edit Invoice"
            backTo="/inventory"
            onClose={handleClose}
        >
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
                        draftInvoiceId={id}
                        onFormChange={(hasChanges: boolean) => setHasUnsavedChanges(hasChanges)}
                    />
                </ErrorBoundary>
            </div>
        </FocusPageLayout>
    )
}
