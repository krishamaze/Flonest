import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { setUserPassword } from '../lib/api/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

export function SetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Get redirect path from query params (default to /unregistered)
  const redirectTo = searchParams.get('redirect') || '/unregistered'

  const validatePassword = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed.length < 8) {
      return 'Password must be at least 8 characters long.'
    }
    if (!/[A-Za-z]/.test(trimmed) || !/[0-9]/.test(trimmed)) {
      return 'Password must include both letters and numbers.'
    }
    return null
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const trimmedPassword = password.trim()
    const trimmedConfirm = confirmPassword.trim()

    const pwError = validatePassword(trimmedPassword)
    if (pwError) {
      setError(pwError)
      return
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError('Passwords do not match.')
      return
    }

    if (!user) {
      setError('You must be signed in to set a password.')
      return
    }

    setLoading(true)

    try {
      await setUserPassword(trimmedPassword)
      toast.success('Password set successfully!', { autoClose: 2000 })
      
      // Redirect to the intended destination
      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      console.error('Set password error:', err)
      setError(err?.message || 'Failed to set password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '')
    setPassword(value)
    setError(null)
  }

  const handlePasswordBlur = () => {
    setPassword((prev) => prev.trim())
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '')
    setConfirmPassword(value)
    setError(null)
  }

  const handleConfirmPasswordBlur = () => {
    setConfirmPassword((prev) => prev.trim())
  }

  if (!user) {
    return (
      <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-secondary-text mt-md">Loading...</p>
        </div>
      </div>
    )
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
            <h1 className="text-3xl font-bold text-primary-text mb-xs">Set Your Password</h1>
            <p className="text-base text-secondary-text">
              Create a secure password to continue with onboarding.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color space-y-md">
            <form onSubmit={handleSubmit} className="space-y-md">
              {/* Error */}
              {error && (
                <div
                  className="rounded-md p-md break-words bg-error-light border border-solid"
                  style={{ borderColor: 'var(--color-error)' }}
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-sm break-words text-error">{error}</p>
                </div>
              )}

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label="Password"
                  placeholder="At least 8 characters, letters & numbers"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  required
                  disabled={loading}
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-md top-[38px] p-xs rounded-md text-muted-text hover:text-primary-text transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  label="Confirm password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  onBlur={handleConfirmPasswordBlur}
                  required
                  disabled={loading}
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-md top-[38px] p-xs rounded-md text-muted-text hover:text-primary-text transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
                disabled={loading}
              >
                {loading ? 'Setting password...' : 'Set Password'}
              </Button>
            </form>
          </div>

          <p className="mt-lg text-center text-xs text-muted-text">
            Your password is required to secure your account and continue with onboarding.
          </p>
        </div>
      </div>
    </div>
  )
}

