import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'

/**
 * Protected route that requires authentication and org membership
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    requiresAdminMfa,
    currentOrg,
    memberships,
    agentRelationships,
    currentAgentContext,
    hasPassword,
    checkingPassword,
  } = useAuth()
  const location = useLocation()
  const isSetupRoute = location.pathname === '/setup'
  const navigate = useNavigate()

  // Redirect to set-password if user doesn't have password and is on /setup
  useEffect(() => {
    if (!loading && user && !user.platformAdmin && hasPassword === false && isSetupRoute) {
      const params = new URLSearchParams()
      params.set('redirect', '/setup')
      navigate(`/set-password?${params.toString()}`, { replace: true })
    }
  }, [user, loading, hasPassword, isSetupRoute, navigate])

  if (loading || checkingPassword) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Block setup page if user doesn't have password
  if (location.pathname === '/setup' && user && hasPassword === false) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    if (location.pathname.startsWith('/platform-admin')) {
      return <>{children}</>
    }
    return <Navigate to="/login" replace />
  }

  if (user.platformAdmin && requiresAdminMfa && location.pathname !== '/admin-mfa') {
    return <Navigate to="/admin-mfa" replace />
  }

  // Platform admins don't need org membership - allow them through
  // They will be redirected to /platform-admin in App.tsx if they try to access org routes
  if (user.platformAdmin) {
    return <>{children}</>
  }

  // CRITICAL: OAuth users without password MUST go to unregistered page first
  // This applies even if they have an org (they need to set password before onboarding)
  const hasOrgMembership = memberships.length > 0
  const hasAgentAccess = agentRelationships.length > 0
  const isAgentRoute = location.pathname.startsWith('/agent')

  if (!hasOrgMembership) {
    if (hasAgentAccess) {
      if (!isAgentRoute) {
        return <Navigate to="/agent/dashboard" replace />
      }
      if (!currentAgentContext) {
        return <AgentContextRequiredPage />
      }
      // Agent routes with context can continue
      if (hasPassword === false && !user.platformAdmin) {
        const params = new URLSearchParams()
        if (user.email) {
          params.set('email', user.email)
        }
        return <Navigate to={`/unregistered?${params.toString()}`} replace />
      }
      return <>{children}</>
    }
    return <OrganizationRequiredPage />
  }

  if (!currentOrg) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (hasPassword === false && !user.platformAdmin) {
    const params = new URLSearchParams()
    if (user.email) {
      params.set('email', user.email)
    }
    return <Navigate to={`/unregistered?${params.toString()}`} replace />
  }

  // Check if org needs setup based on lifecycle state
  // BUT: Only redirect if user has password (checked above)
  const orgNeedsSetup = currentOrg.lifecycleState === 'onboarding_pending'
  const orgSetupCompleted = currentOrg.lifecycleState === 'active' || 
                            currentOrg.lifecycleState === 'suspended' || 
                            currentOrg.lifecycleState === 'archived'
  
  // Inverse logic: If setup is completed, prevent access to /setup route
  if (orgSetupCompleted && isSetupRoute && hasPassword !== false) {
    if (checkingPassword) {
      return (
        <div className="viewport-height flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )
    }
    if (hasPassword === true) {
      return <Navigate to="/" replace />
    }
  }
  
  if (orgNeedsSetup && hasPassword !== false) {
    // If password check is still in progress, wait
    if (checkingPassword) {
      return (
        <div className="viewport-height flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )
    }
    // Only redirect if password check completed and user has password
    if (hasPassword === true && !isSetupRoute) {
      return <Navigate to="/setup" replace />
    }
    // If hasPassword === false, redirect already happened above
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

function AgentContextRequiredPage() {
  const navigate = useNavigate()
  return (
    <div className="viewport-height flex items-center justify-center bg-bg-page safe-top safe-bottom p-spacing-lg">
      <div className="max-w-md w-full text-center space-y-md">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Select an agent context</h1>
          <p className="mt-sm text-text-secondary">
            Use the org switcher at the top of the app to pick which sender organization you&apos;re
            working for.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => navigate('/')}>
          Open dashboard
        </Button>
      </div>
    </div>
  )
}

/**
 * Platform admin route that requires platform admin access
 */
export function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
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

