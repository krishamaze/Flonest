import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'

export function LoginPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (view === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        // Navigation will happen automatically via AuthContext
        navigate('/')
      } else if (view === 'sign_up') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage('Account created! Check your email for the confirmation link.')
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
      <div className="flex-1 flex items-center justify-center px-md py-lg min-h-0">
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
                  onChange={(e) => setPassword(e.target.value)}
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

          {/* Test Accounts */}
          {view === 'sign_in' && (
            <div className="mt-lg rounded-lg p-md bg-primary-light border border-solid" style={{ borderColor: 'var(--color-primary)' }}>
              <p className="text-sm font-semibold mb-sm text-primary-text">
                Test Accounts
              </p>
              <div className="space-y-xs text-xs">
                <div>
                  <span className="font-medium text-secondary-text">
                    Reviewer:
                  </span>
                  <span className="font-mono ml-xs text-primary-text">
                    internal@test.com
                  </span>
                </div>
                <div>
                  <span className="font-medium text-secondary-text">
                    Owner:
                  </span>
                  <span className="font-mono ml-xs text-primary-text">
                    owner@test.com
                  </span>
                </div>
                <div 
                  className="pt-xs mt-xs border-t"
                  style={{
                    borderColor: 'var(--color-primary)',
                    opacity: 0.3
                  }}
                >
                  <span className="font-medium text-secondary-text">
                    Password:
                  </span>
                  <span className="font-mono ml-xs text-primary-text">
                    password
                  </span>
                </div>
              </div>
              <p className="text-xs mt-sm text-secondary-text">
                Or sign up to create your own account
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="mt-lg text-center text-xs text-muted-text">
            Powered by Supabase Auth • Secure & Reliable
          </p>
        </div>
      </div>
    </div>
  )
}
