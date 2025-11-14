import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import type { RefreshStatus } from '../contexts/RefreshContext'
import { ADMIN_SSO_PROVIDER, ADMIN_SSO_REDIRECT_PATH, isPrivilegedAdminEmail } from '../config/security'

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'

export function LoginPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | undefined>()
  const [showPassword, setShowPassword] = useState(false)

  // Register Service Worker for update checks
  useRegisterSW({
    onRegistered(registration) {
      console.log('SW registered on login page:', registration)
      setSwRegistration(registration)
    },
  })

  const handleRefresh = async (onStatusChange?: (status: RefreshStatus) => void) => {
    // Use Service Worker to check for updates (no version table needed!)
    onStatusChange?.({ 
      phase: 'checking-version', 
      message: 'Checking for updates...', 
      hasUpdate: false 
    })

    if (swRegistration) {
      try {
        // Trigger SW to check for new bundle
        console.log('Pull-to-refresh triggering Service Worker update check...')
        await swRegistration.update()
        console.log('Service Worker update check complete')
        
        // If new bundle found, SW will set needRefresh=true
        // UpdateNotification will automatically show yellow button
      } catch (error) {
        console.error('Service Worker update check failed:', error)
      }
    }

    // Complete
    onStatusChange?.({ 
      phase: 'complete', 
      message: 'Complete', 
      hasUpdate: false 
    })
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Block spaces in password field
    const value = e.target.value.replace(/\s/g, '')
    setPassword(value)
  }

  const handlePasswordBlur = () => {
    // Trim leading/trailing spaces on blur
    setPassword((prev) => prev.trim())
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    // Trim password before submission
    const trimmedPassword = password.trim()

    try {
      if (view === 'sign_in') {
        if (isPrivilegedAdminEmail(email)) {
          setError('Platform admin authentication is SSO-only. Use the "Admin SSO" button below.')
          setLoading(false)
          return
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: trimmedPassword,
        })
        if (error) throw error
        // Navigation will happen automatically via AuthContext
        navigate('/')
      } else if (view === 'sign_up') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: trimmedPassword,
        })
        if (error) throw error
        
        // Check if user is immediately signed in (email confirmation disabled)
        if (data.session) {
          // User is immediately confirmed - redirect to app
          setMessage('Account created successfully! Redirecting...')
          // Auto-navigate after a brief delay
          setTimeout(() => {
            navigate('/')
          }, 1000)
        } else {
          // Generic message - don't reveal email confirmation status or SMTP configuration
          // Security: Use generic message to avoid leaking system configuration details
          setMessage('Account created successfully! If email confirmation is required, please check your email for further instructions.')
        }
        
        // Clear form
        setEmail('')
        setPassword('')
      } else if (view === 'forgot_password') {
        if (isPrivilegedAdminEmail(email)) {
          setError('Platform admin password resets require dual approval. Contact security to initiate a manual reset.')
          setLoading(false)
          return
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setMessage('If an account exists with this email, you will receive password reset instructions.')
        setEmail('')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSso = async () => {
    setError(null)
    setMessage('Redirecting to corporate SSO...')
    try {
      await supabase.auth.signInWithOAuth({
        provider: ADMIN_SSO_PROVIDER as any,
        options: {
          scopes: 'openid profile email offline_access',
          redirectTo: `${window.location.origin}${ADMIN_SSO_REDIRECT_PATH}`,
        },
      })
    } catch (err: any) {
      setMessage(null)
      setError(err?.message || 'Unable to start SSO flow. Contact security.')
    }
  }

  return (
    <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex flex-col overflow-hidden">
      <PullToRefresh onRefresh={handleRefresh}>
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
              {view === 'sign_up' ? 'Create Account' : view === 'forgot_password' ? 'Reset Password' : 'Welcome Back'}
            </h1>
            <p className="text-base text-secondary-text">
              {view === 'sign_up' 
                ? 'Sign up to start managing your inventory' 
                : view === 'forgot_password' 
                ? 'Enter your email to reset your password'
                : 'Sign in to your account'}
            </p>
          </div>

          {/* Auth Form Card */}
          <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color">
            <form onSubmit={handleSubmit} className="space-y-md">
              {/* Error Message */}
              {error && (
                <div 
                  className="rounded-md p-md break-words bg-error-light border border-solid"
                  style={{ borderColor: 'var(--color-error)' }}
                  role="alert"
                  id="login-error"
                  aria-live="polite"
                >
                  <p className="text-sm break-words text-error">
                    {error}
                  </p>
                </div>
              )}

              {/* Success Message */}
              {message && (
                <div 
                  className="rounded-md p-md break-words bg-success-light border border-solid"
                  style={{ borderColor: 'var(--color-success)' }}
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm break-words text-success">
                    {message}
                  </p>
                </div>
              )}

              {/* Email Input */}
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                aria-describedby={error && view !== 'forgot_password' ? 'login-error' : undefined}
              />

              {/* Password Input - only show for sign_in and sign_up */}
              {(view === 'sign_in' || view === 'sign_up') && (
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    placeholder="••••••••"
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={handlePasswordBlur}
                    required
                    disabled={loading}
                    minLength={6}
                    autoComplete={view === 'sign_in' ? 'current-password' : 'new-password'}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-md top-[38px] p-xs rounded-md text-muted-text hover:text-primary-text transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
                disabled={loading}
              >
                {loading
                  ? view === 'sign_in'
                    ? 'Signing in...'
                    : view === 'sign_up'
                    ? 'Signing up...'
                    : 'Sending...'
                  : view === 'sign_in'
                  ? 'Sign In'
                  : view === 'sign_up'
                  ? 'Sign Up'
                  : 'Send reset instructions'}
              </Button>

              {/* View Switch Links */}
              <div className="space-y-md text-center">
                {view === 'sign_in' && (
                  <>
                    <div className="rounded-lg border border-color p-md text-left bg-bg-hover">
                      <p className="text-sm text-secondary-text mb-sm font-medium">
                        Platform admin access requires corporate SSO + MFA.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        className="w-full"
                        onClick={handleAdminSso}
                        disabled={loading}
                      >
                        Continue with Admin SSO
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot_password')
                        setError(null)
                        setMessage(null)
                      }}
                      className="text-sm font-medium transition-base hover:opacity-80"
                      style={{
                        color: 'var(--color-primary)'
                      }}
                    >
                      Forgot your password?
                    </button>
                    <div className="pt-md border-t border-color">
                      <span className="block mb-sm text-sm text-secondary-text">
                        Don't have an account?
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        className="w-full"
                        onClick={() => {
                          setView('sign_up')
                          setError(null)
                          setMessage(null)
                        }}
                      >
                        Sign up
                      </Button>
                    </div>
                  </>
                )}

                {view === 'sign_up' && (
                  <div className="pt-md border-t border-color">
                    <span className="block mb-sm text-sm text-secondary-text">
                      Already have an account?
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setView('sign_in')
                        setError(null)
                        setMessage(null)
                      }}
                    >
                      Sign in
                    </Button>
                  </div>
                )}

                {view === 'forgot_password' && (
                  <div className="pt-md border-t border-color">
                    <span className="block mb-sm text-sm text-secondary-text">
                      Remember your password?
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setView('sign_in')
                        setError(null)
                        setMessage(null)
                      }}
                    >
                      Sign in
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </div>


          {/* Footer */}
          <p className="mt-lg text-center text-xs text-muted-text">
            Powered by Supabase Auth • Secure & Reliable
          </p>
        </div>
        </div>
      </PullToRefresh>
    </div>
  )
}
