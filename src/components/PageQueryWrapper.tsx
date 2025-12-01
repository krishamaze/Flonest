import { ReactNode } from 'react'
import { QueryErrorHandler } from './QueryErrorHandler'

interface PageQueryWrapperProps {
    isLoading: boolean
    isError: boolean
    error: Error | null
    children: ReactNode
    onRetry?: () => void
    loadingTimeout?: number
    isTimeout?: boolean
}

/**
 * Page Query Wrapper
 * Drop-in replacement for manual loading/error checks
 * Wraps page content with automatic loading, timeout, and error handling
 * 
 * Usage:
 * Replace:
 *   if (loading) return <LoadingSpinner />
 *   return <div>content</div>
 * 
 * With:
 *   return (
 *     <PageQueryWrapper isLoading={loading} isError={isError} error={error} onRetry={refetch}>
 *       <div>content</div>
 *     </PageQueryWrapper>
 *   )
 */
export function PageQueryWrapper({
    isLoading,
    isError,
    error,
    children,
    onRetry,
    loadingTimeout = 15000,
    isTimeout = false,
}: PageQueryWrapperProps) {
    return (
        <QueryErrorHandler
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={onRetry}
            loadingTimeout={loadingTimeout}
        >
            {children}
        </QueryErrorHandler>
    )
}
