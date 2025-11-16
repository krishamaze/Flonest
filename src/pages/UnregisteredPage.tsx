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

  const handleOnboardBusiness = () => {
    // Just UX: prefill email via navigation state or query param if needed later
    navigate('/setup', { replace: true })
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
      <div className="w-full max-w-md page-enter">
        <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color space-y-lg">
          <div className="space-y-sm text-center">
            <h1 className="text-2xl font-semibold text-primary-text">Unregistered account</h1>
            <p className="text-sm text-secondary-text">
              You are not registered. You can onboard your own business or join an organization you work for.
            </p>
            {email && (
              <p className="text-xs text-muted-text break-words mt-xs">
                Current account: <span className="font-medium">{email}</span>
              </p>
            )}
          </div>

          <div className="space-y-sm">
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
              onClick={handleSwitchAccount}
            >
              {email ? `Switch account (${email})` : 'Switch account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


