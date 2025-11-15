import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { ADMIN_SSO_PROVIDER, ADMIN_SSO_REDIRECT_PATH } from '../config/security'

export function PlatformAdminLoginPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already authenticated as platform admin
  useEffect(() => {
    if (user?.platformAdmin) {
      navigate('/platform-admin', { replace: true })
    }
  }, [user, navigate])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)

    try {
      const scopes = ADMIN_SSO_PROVIDER === 'google' 
        ? 'openid profile email'
        : 'openid profile email offline_access'
      
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: ADMIN_SSO_PROVIDER as any,
        options: {
          scopes,
          redirectTo: `${window.location.origin}${ADMIN_SSO_REDIRECT_PATH}`,
        },
      })

      if (oauthError) {
        throw oauthError
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      setError(err?.message || 'Failed to initiate Google sign-in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center px-md py-lg min-h-screen">
        <div className="w-full max-w-md page-enter">
          {/* Header */}
          <div className="mb-xl text-center">
            <div className="mx-auto mb-lg flex h-24 w-24 items-center justify-center rounded-lg bg-white shadow-primary p-md">
              <img 
                src="/pwa-192x192.png" 
                alt="finetune logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-primary-text mb-xs">
              Platform Admin Sign In
            </h1>
            <p className="text-base text-secondary-text">
              Sign in with your Google account to access the platform admin dashboard
            </p>
          </div>

          {/* Auth Card */}
          <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color">
            {/* Error Message */}
            {error && (
              <div 
                className="rounded-md p-md break-words bg-error-light border border-solid mb-md"
                style={{ borderColor: 'var(--color-error)' }}
                role="alert"
                aria-live="polite"
              >
                <p className="text-sm break-words text-error">
                  {error}
                </p>
              </div>
            )}

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleGoogleSignIn}
              isLoading={loading}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>

            {/* Info Text */}
            <p className="mt-md text-center text-xs text-muted-text">
              Platform admin access requires Google SSO authentication
            </p>
          </div>

          {/* Footer */}
          <p className="mt-lg text-center text-xs text-muted-text">
            Powered by Supabase Auth • Secure & Reliable
          </p>
        </div>
      </div>
    </div>
  )
}

