import { Component, ReactNode } from 'react'
import { Button } from './ui/Button'
import { ExclamationTriangleIcon, ArrowPathIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: string | null
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Displays fallback UI with reload and logout options
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: error.message || 'An unexpected error occurred',
        }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    handleReload = () => {
        window.location.reload()
    }

    handleLogout = async () => {
        try {
            await supabase.auth.signOut()
            window.location.href = '/login'
        } catch (error) {
            console.error('Error signing out:', error)
            window.location.href = '/login'
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4">
                    <div className="max-w-md w-full bg-surface rounded-lg shadow-lg p-6 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                            </div>
                        </div>

                        <h1 className="text-xl font-semibold text-primary-text mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-sm text-secondary-text mb-6">
                            {this.state.errorInfo || 'An unexpected error occurred. Please try reloading the page.'}
                        </p>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={this.handleReload}
                                variant="primary"
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                                Reload Page
                            </Button>

                            <Button
                                onClick={this.handleLogout}
                                variant="secondary"
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                Logout
                            </Button>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="text-xs text-muted-text cursor-pointer hover:text-secondary-text">
                                    Error Details (Dev Only)
                                </summary>
                                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
