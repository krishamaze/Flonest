import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './ui/LoadingSpinner'

/**
 * Protected route that requires authentication and org membership
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // User is authenticated but hasn't joined an org yet
  // Redirect to onboarding (org join/invite flow) when implemented
  // For now, show a message that they need to be invited
  if (!user.orgId) {
    return (
      <div className="viewport-height flex items-center justify-center bg-bg-page safe-top safe-bottom p-spacing-lg">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-spacing-md">
            Organization Required
          </h1>
          <p className="text-text-secondary mb-spacing-lg">
            You need to be invited to an organization or join one using an organization code.
          </p>
          <p className="text-sm text-text-muted">
            Please contact your administrator to receive an invitation.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Reviewer route that requires internal user access
 */
export function ReviewerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.isInternal) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

