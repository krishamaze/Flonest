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
    <div className="min-h-screen bg-bg-page safe-top safe-bottom flex flex-col">
      <div className="flex-1 flex items-center justify-center px-md py-md">
        <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <span className="text-3xl font-bold text-on-primary">I</span>
          </div>
          <h1 className="text-3xl font-bold text-primary-text">Inventory System</h1>
          <p className="mt-sm text-secondary-text">Manage your inventory</p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-lg bg-bg-card p-2xl shadow-sm border border-neutral-200 overflow-hidden w-full box-border">
          <form onSubmit={handleSubmit} className="space-y-4 w-full">
            {/* Error Message */}
            {error && (
              <div 
                className="rounded-lg bg-error-light border border-error p-md break-words"
                role="alert"
                id="login-error"
                aria-live="polite"
              >
                <p className="text-sm text-error-dark break-words">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div 
                className="rounded-md bg-success-light border border-success p-md break-words"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm text-success-dark break-words">{message}</p>
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
            <div className="space-y-3 text-center text-sm">
              {view === 'sign_in' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot_password')
                      setError(null)
                      setMessage(null)
                    }}
                    className="text-primary hover:text-primary-hover hover:underline text-sm"
                  >
                    Forgot your password?
                  </button>
                  <div className="pt-sm border-t border-neutral-200">
                    <span className="text-secondary-text block mb-sm">Don't have an account?</span>
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
                <div className="pt-sm border-t border-neutral-200">
                  <span className="text-secondary-text block mb-sm">Already have an account?</span>
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
                <div className="pt-sm border-t border-neutral-200">
                  <span className="text-secondary-text block mb-sm">Remember your password?</span>
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

        {/* Demo credentials hint */}
        {view === 'sign_in' && (
          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800 font-medium mb-1">Demo Account</p>
            <p className="text-xs text-secondary-text">
              Email: <span className="font-mono">demo@example.com</span>
            </p>
            <p className="text-xs text-secondary-text">
              Password: <span className="font-mono">password</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Or sign up to create your own account with automatic tenant setup
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
