import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'
import type { Org } from '../types'

/**
 * Check if organization needs setup (state is "Default")
 */
function needsOrgSetup(org: Org | null): boolean {
  return org?.state === 'Default'
}

/**
 * Protected route that requires authentication and org membership
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, requiresAdminMfa } = useAuth()
  const [org, setOrg] = useState<Org | null>(null)
  const [orgLoading, setOrgLoading] = useState(false)
  const location = useLocation()

  // Fetch org data when user has orgId
  useEffect(() => {
    if (!loading && user?.orgId && !user.platformAdmin) {
      setOrgLoading(true)
      supabase
        .from('orgs')
        .select('*')
        .eq('id', user.orgId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching org:', error)
          } else {
            setOrg(data)
          }
          setOrgLoading(false)
        })
    }
  }, [user?.orgId, user?.platformAdmin, loading])

  if (loading || orgLoading) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.platformAdmin && requiresAdminMfa && location.pathname !== '/admin-mfa') {
    return <Navigate to="/admin-mfa" replace />
  }

  // Internal users don't need org membership - allow them through
  // They will be redirected to /platform-admin in App.tsx if they try to access org routes
  if (user.platformAdmin) {
    return <>{children}</>
  }

  // Non-internal users must have an org
  // User is authenticated but hasn't joined an org yet
  // Redirect to onboarding (org join/invite flow) when implemented
  // For now, show a message that they need to be invited
  if (!user.orgId) {
    return <OrganizationRequiredPage />
  }

  // Check if org needs setup (state === "Default")
  if (needsOrgSetup(org)) {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}

/**
 * Organization Required page - shown when user is authenticated but has no org
 */
function OrganizationRequiredPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="viewport-height flex items-center justify-center bg-bg-page safe-top safe-bottom p-spacing-lg">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-spacing-md">
          Organization Required
        </h1>
        <p className="text-text-secondary mb-spacing-lg">
          You need to be invited to an organization or join one using an organization code.
        </p>
        <p className="text-sm text-text-muted mb-spacing-lg">
          Please contact your administrator to receive an invitation.
        </p>
        {user && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleSignOut}
            className="w-full"
          >
            Sign out
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Reviewer route that requires internal user access
 */
export function ReviewerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, requiresAdminMfa } = useAuth()

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

  if (requiresAdminMfa) {
    return <Navigate to="/admin-mfa" replace />
  }

  if (!user.platformAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

