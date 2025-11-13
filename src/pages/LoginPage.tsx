import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import { checkVersionSync } from '../lib/api/version'
import type { RefreshStatus } from '../contexts/RefreshContext'

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'

export function LoginPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleRefresh = async (onStatusChange?: (status: RefreshStatus) => void) => {
    // Login page only checks for app updates (no user data to refresh)
    onStatusChange?.({ 
      phase: 'checking-version', 
      message: 'Checking for updates...', 
      hasUpdate: false 
    })

    try {
      const versionCheck = await checkVersionSync()
      
      if (!versionCheck.inSync) {
        console.warn('Version mismatch detected on login page:', versionCheck.message)
        onStatusChange?.({ 
          phase: 'version-mismatch', 
          message: 'New version available!', 
          hasUpdate: true 
        })
        
        // Dispatch event to show UpdateNotification button
        window.dispatchEvent(new CustomEvent('version-mismatch-detected'))
      }
    } catch (error) {
      console.error('Version check failed:', error)
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
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
          // Email confirmation required but not sent (SMTP not configured)
          setMessage('Account created! However, email confirmation is not configured. Please contact support or disable email confirmation in Supabase settings.')
        } else if (data.session) {
          // User is immediately confirmed (email confirmation disabled)
          setMessage('Account created successfully! Redirecting...')
          // Auto-navigate after a brief delay
          setTimeout(() => {
            navigate('/')
          }, 1000)
        } else {
          // Email confirmation required and email should be sent
          setMessage('Account created! Check your email for the confirmation link.')
        }
        
        // Clear form
        setEmail('')
        setPassword('')
      } else if (view === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setMessage('Check your email for the password reset link.')
        setEmail('')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex flex-col overflow-hidden">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex-1 flex items-center justify-center px-md py-lg min-h-screen">
        <div className="w-full max-w-md page-enter">
          {/* Header */}
          <div className="mb-xl text-center">
            <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-lg bg-primary shadow-primary">
              <span className="text-3xl font-bold text-on-primary">I</span>
            </div>
            <h1 className="text-3xl font-bold text-primary-text mb-xs">Inventory System</h1>
            <p className="text-base text-secondary-text">Manage your inventory</p>
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
                <Input
                  type="password"
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
