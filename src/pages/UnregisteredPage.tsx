import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'

export function UnregisteredPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    const emailParam = searchParams.get('email') || ''
    setEmail(emailParam)
  }, [searchParams])

  const handleOnboardBusiness = async () => {
    try {
      // Clear any existing OAuth session so the new owner account is password-based.
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out before owner signup:', err)
    } finally {
      const params = new URLSearchParams()
      if (email) {
        params.set('email', email)
      }
      navigate(`/owner-signup${params.toString() ? `?${params.toString()}` : ''}`, { replace: true })
    }
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



