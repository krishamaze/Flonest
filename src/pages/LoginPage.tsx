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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
            <span className="text-3xl font-bold text-white">I</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory System</h1>
          <p className="mt-2 text-gray-600">Manage your inventory</p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-lg bg-white p-8 shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm text-green-800">{message}</p>
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
            <div className="space-y-2 text-center text-sm">
              {view === 'sign_in' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot_password')
                      setError(null)
                      setMessage(null)
                    }}
                    className="text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    Forgot your password?
                  </button>
                  <div>
                    <span className="text-gray-600">Don't have an account? </span>
                    <button
                      type="button"
                      onClick={() => {
                        setView('sign_up')
                        setError(null)
                        setMessage(null)
                      }}
                      className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
                    >
                      Sign up
                    </button>
                  </div>
                </>
              )}

              {view === 'sign_up' && (
                <div>
                  <span className="text-gray-600">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setView('sign_in')
                      setError(null)
                      setMessage(null)
                    }}
                    className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </div>
              )}

              {view === 'forgot_password' && (
                <div>
                  <span className="text-gray-600">Remember your password? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setView('sign_in')
                      setError(null)
                      setMessage(null)
                    }}
                    className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Demo credentials hint */}
        {view === 'sign_in' && (
          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800 font-medium mb-1">Demo Account</p>
            <p className="text-xs text-blue-600">
              Email: <span className="font-mono">demo@example.com</span>
            </p>
            <p className="text-xs text-blue-600">
              Password: <span className="font-mono">password</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Or sign up to create your own account with automatic tenant setup
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Powered by Supabase Auth • Secure & Reliable
        </p>
      </div>
    </div>
  )
}
