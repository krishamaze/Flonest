import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'
import { checkUserHasPassword } from '../lib/api/auth'
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
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [checkingPassword, setCheckingPassword] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // CRITICAL: Check password requirement for ALL non-platform-admin users
  // This ensures OAuth users without password are caught BEFORE they can access any org routes
  useEffect(() => {
    if (!loading && user && !user.platformAdmin) {
      // Always check password for non-platform-admin users
      // This catches OAuth users even if they have an org
      setCheckingPassword(true)
      checkUserHasPassword()
        .then((hasPwd) => {
          setHasPassword(hasPwd)
          // If no password and on /setup, redirect to set-password
          if (!hasPwd && location.pathname === '/setup') {
            const params = new URLSearchParams()
            params.set('redirect', '/setup')
            navigate(`/set-password?${params.toString()}`, { replace: true })
          }
        })
        .catch((err) => {
          console.error('Error checking password:', err)
          // Assume no password for safety
          setHasPassword(false)
          if (location.pathname === '/setup') {
            const params = new URLSearchParams()
            params.set('redirect', '/setup')
            navigate(`/set-password?${params.toString()}`, { replace: true })
          }
        })
        .finally(() => {
          setCheckingPassword(false)
        })
    } else if (!loading && user) {
      // Platform admins don't need password check
      setHasPassword(true)
    }
  }, [user, loading, location.pathname, navigate])

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

  if (loading || orgLoading || checkingPassword) {
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
  if (!user.orgId || (hasPassword === false && !user.platformAdmin)) {
    // If user has no org, show organization required page
    if (!user.orgId) {
      return <OrganizationRequiredPage />
    }
    
    // If user has org but no password, redirect to unregistered page
    // (which will then redirect to set-password)
    if (hasPassword === false) {
      const params = new URLSearchParams()
      if (user.email) {
        params.set('email', user.email)
      }
      return <Navigate to={`/unregistered?${params.toString()}`} replace />
    }
  }

  // Check if org needs setup (state === "Default")
  // BUT: Only redirect if user has password (checked above)
  if (needsOrgSetup(org) && hasPassword !== false) {
    // If password check is still in progress, wait
    if (checkingPassword) {
      return (
        <div className="viewport-height flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )
    }
    // Only redirect if password check completed and user has password
    if (hasPassword === true) {
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

