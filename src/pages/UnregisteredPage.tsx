import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

export function UnregisteredPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading, retryConnection, hasPassword, checkingPassword } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)

  useEffect(() => {
    const emailParam = searchParams.get('email') || ''
    setEmail(emailParam)
  }, [searchParams])

  // Redirect to set-password if user doesn't have password
  useEffect(() => {
    if (!authLoading && user && !user.platformAdmin && hasPassword === false) {
      const params = new URLSearchParams()
      params.set('redirect', '/unregistered')
      if (email) {
        params.set('email', email)
      }
      navigate(`/set-password?${params.toString()}`, { replace: true })
    }
  }, [user, authLoading, hasPassword, email, navigate])

  const handleOnboardBusiness = async () => {
    if (!user) return
    setCreationError(null)
    setCreatingOrg(true)

    try {
      // If user already has an org (legacy auto-created), just continue to setup
      if (user.orgId) {
        navigate('/setup', { replace: true })
        return
      }

      const { error } = await supabase.rpc('create_default_org_for_user' as any)
      if (error) {
        throw error
      }

      if (retryConnection) {
        await retryConnection()
      }

      navigate('/setup', { replace: true })
    } catch (err: any) {
      console.error('Failed to create default org:', err)
      setCreationError(err?.message || 'Failed to create organization. Please try again.')
    } finally {
      setCreatingOrg(false)
    }
  }

  const handleJoinOrg = async () => {
    navigate('/join-org', { replace: false })
  }

  const handleSwitchAccount = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out for account switch:', err)
    } finally {
      navigate('/login', { replace: true })
    }
  }

  // Show loading while checking password
  if (checkingPassword || authLoading || hasPassword === null) {
    return (
      <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-secondary-text mt-md">Checking account...</p>
        </div>
      </div>
    )
  }

  // If user doesn't have password, they should be redirected (handled in useEffect)
  // This is a fallback in case redirect didn't happen
  if (!hasPassword) {
    return (
      <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-secondary-text mt-md">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex flex-col items-center justify-center px-md">
      <div className="w-full max-w-lg page-enter">
        <div className="rounded-2xl bg-bg-card p-xl shadow-lg border border-color space-y-lg">
          <div className="space-y-sm text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-primary-text">Unregistered account</h1>
            <p className="text-sm md:text-base text-secondary-text">
              You are not registered. You can onboard your own business or join an organization you work for.
            </p>
            {email && (
              <p className="text-xs text-muted-text break-words mt-xs">
                Current account: <span className="font-medium">{email}</span>
              </p>
            )}
          </div>

          <div className="grid gap-sm md:gap-md">
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleOnboardBusiness}
              disabled={creatingOrg}
            >
              {creatingOrg ? 'Preparing setup...' : 'Onboard my own business'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={handleJoinOrg}
            >
              Join an existing organization
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full mt-xs"
              onClick={handleSwitchAccount}
            >
              {email ? `Switch account (${email})` : 'Switch account'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-text">
            To join an existing business, ask the owner or admin to invite you, then sign in with that account.
          </p>

          {creationError && (
            <p className="text-sm text-error text-center break-words">
              {creationError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}



