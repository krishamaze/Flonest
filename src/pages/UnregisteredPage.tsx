import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { checkUserHasPassword } from '../lib/api/auth'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

export function UnregisteredPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [checkingPassword, setCheckingPassword] = useState(true)
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  useEffect(() => {
    const emailParam = searchParams.get('email') || ''
    setEmail(emailParam)
  }, [searchParams])

  // Check if user has password on mount
  useEffect(() => {
    const checkPassword = async () => {
      if (authLoading || !user) {
        setCheckingPassword(false)
        return
      }

      try {
        const hasPwd = await checkUserHasPassword()
        setHasPassword(hasPwd)
        
        // If user doesn't have password, redirect to set-password page
        if (!hasPwd) {
          const params = new URLSearchParams()
          params.set('redirect', '/unregistered')
          if (email) {
            params.set('email', email)
          }
          navigate(`/set-password?${params.toString()}`, { replace: true })
          return
        }
      } catch (err) {
        console.error('Error checking password:', err)
        // Assume no password for safety - redirect to set password
        const params = new URLSearchParams()
        params.set('redirect', '/unregistered')
        if (email) {
          params.set('email', email)
        }
        navigate(`/set-password?${params.toString()}`, { replace: true })
        return
      } finally {
        setCheckingPassword(false)
      }
    }

    checkPassword()
  }, [user, authLoading, email, navigate])

  const handleOnboardBusiness = async () => {
    // Password check is already done - user has password at this point
    // Keep the current OAuth session so we can convert the account into an owner account
    // without forcing a second email confirmation step.
    const params = new URLSearchParams()
    if (email) {
      params.set('email', email)
    }
    navigate(`/owner-signup${params.toString() ? `?${params.toString()}` : ''}`, { replace: true })
  }

  const handleJoinOrg = async () => {
    try {
      // For joining an existing org, user should log in with an invited account.
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out before join-org flow:', err)
    } finally {
      navigate('/login', { replace: true })
    }
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
            >
              Onboard my own business
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
        </div>
      </div>
    </div>
  )
}



