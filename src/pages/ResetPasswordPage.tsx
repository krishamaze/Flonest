import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { toast } from 'react-toastify'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)

  const type = searchParams.get('type')
  const accessToken = searchParams.get('access_token')

  useEffect(() => {
    // Check if we have the required recovery parameters
    if (type !== 'recovery' || !accessToken) {
      setIsValidToken(false)
      setError('Invalid or missing reset link. Please request a new password reset.')
    } else {
      setIsValidToken(true)
    }
  }, [type, accessToken])

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Block spaces in password field
    const value = e.target.value.replace(/\s/g, '')
    setPassword(value)
    setError(null)
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Block spaces in password field
    const value = e.target.value.replace(/\s/g, '')
    setConfirmPassword(value)
    setError(null)
  }

  const handlePasswordBlur = () => {
    // Trim leading/trailing spaces on blur
    setPassword((prev) => prev.trim())
    setConfirmPassword((prev) => prev.trim())
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Trim passwords before validation
    const trimmedPassword = password.trim()
    const trimmedConfirmPassword = confirmPassword.trim()

    // Validation
    if (!trimmedPassword) {
      setError('Password is required')
      setLoading(false)
      return
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      // Update password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword,
      })

      if (updateError) throw updateError

      // Success - show toast and redirect to login
      toast.success('Password reset successfully! Please sign in with your new password.', {
        position: 'top-center',
        autoClose: 3000,
      })

      // Clear URL params and redirect to login
      navigate('/login', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again or request a new reset link.')
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while checking token validity
  if (isValidToken === null) {
    return (
      <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-md" />
          <p className="text-secondary-text">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  // Show error if invalid token
  if (isValidToken === false) {
    return (
      <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex items-center justify-center px-md">
        <div className="w-full max-w-md">
          <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color">
            <div className="text-center mb-lg">
              <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-lg bg-error-light">
                <span className="text-3xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold text-primary-text mb-xs">Invalid Reset Link</h1>
              <p className="text-base text-secondary-text">{error}</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center px-md py-lg min-h-0">
        <div className="w-full max-w-md page-enter">
          {/* Header */}
          <div className="mb-xl text-center">
            <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-lg bg-primary shadow-primary">
              <span className="text-3xl font-bold text-on-primary">🔒</span>
            </div>
            <h1 className="text-3xl font-bold text-primary-text mb-xs">Reset Password</h1>
            <p className="text-base text-secondary-text">Enter your new password</p>
          </div>

          {/* Reset Form Card */}
          <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color">
            <form onSubmit={handleSubmit} className="space-y-md">
              {/* Error Message */}
              {error && (
                <div 
                  className="rounded-md p-md break-words bg-error-light border border-solid"
                  style={{ borderColor: 'var(--color-error)' }}
                  role="alert"
                  id="reset-error"
                  aria-live="polite"
                >
                  <p className="text-sm break-words text-error">
                    {error}
                  </p>
                </div>
              )}

              {/* New Password Input */}
              <Input
                type="password"
                label="New Password"
                placeholder="••••••••"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                required
                disabled={loading}
                minLength={6}
                autoComplete="new-password"
                aria-describedby={error ? 'reset-error' : undefined}
              />

              {/* Confirm Password Input */}
              <Input
                type="password"
                label="Confirm Password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onBlur={handlePasswordBlur}
                required
                disabled={loading}
                minLength={6}
                autoComplete="new-password"
                aria-describedby={error ? 'reset-error' : undefined}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
                disabled={loading}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </Button>

              {/* Back to Login Link */}
              <div className="pt-md border-t border-color text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium transition-base hover:opacity-80"
                  style={{
                    color: 'var(--color-primary)'
                  }}
                >
                  Back to Login
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-lg text-center text-xs text-muted-text">
            Password must be at least 6 characters
          </p>
        </div>
      </div>
    </div>
  )
}

