import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import type { RefreshStatus } from '../contexts/RefreshContext'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export function OwnerSignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | undefined>()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

  // Prefill email from query param (read-only UX hint, but editable if needed)
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  // Register Service Worker for update checks (same pattern as LoginPage)
  useRegisterSW({
    onRegistered(registration) {
      setSwRegistration(registration)
    },
  })

  const handleRefresh = async (onStatusChange?: (status: RefreshStatus) => void) => {
    onStatusChange?.({
      phase: 'checking-version',
      message: 'Checking for updates...',
      hasUpdate: false,
    })

    if (swRegistration) {
      try {
        await swRegistration.update()
      } catch (err) {
        console.error('Service Worker update check failed:', err)
      }
    }

    onStatusChange?.({
      phase: 'complete',
      message: 'Complete',
      hasUpdate: false,
    })
  }

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
    setMessage(null)

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

    setLoading(true)

    try {
      // Check if there is an active session (e.g., Google OAuth) we can convert into an owner account.
      const { data: userResult, error: userError } = await supabase.auth.getUser()

      if (userError) {
        console.error('Owner sign-up getUser error:', userError)
      }

      const currentUser = userResult?.user ?? null

      if (currentUser) {
        // Authenticated flow (e.g., Google OAuth user becoming an owner).
        // 1) Auto-confirm the email via Edge Function using the current access token.
        const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          throw sessionError
        }

        const accessToken = sessionResult.session?.access_token

        if (!accessToken) {
          throw new Error('Missing access token for authenticated owner signup. Please sign in again.')
        }

        // Show loading message for Edge Function call
        setMessage('Confirming your email...')

        const edgeResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin-auto-confirm-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        })

        if (!edgeResponse.ok) {
          setMessage(null) // Clear loading message on error
          let errorMessage = 'Failed to confirm email for owner account.'
          try {
            const payload = await edgeResponse.json()
            if (payload?.error) {
              errorMessage = payload.error
            }
          } catch {
            // ignore JSON parse issues and keep generic message
          }
          throw new Error(errorMessage)
        }

        // 2) Now that the email is confirmed server-side, set a local password.
        const { error: updateError } = await supabase.auth.updateUser({
          password: trimmedPassword,
        })

        if (updateError) {
          throw updateError
        }

        setMessage('Account created successfully! Preparing your business...')
        navigate('/setup', { replace: true })
        return
      }

      // Anonymous flow (no active session): fall back to email+password sign-up.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: trimmedPassword,
      })

      if (signUpError) {
        throw signUpError
      }

      // If a session is created immediately (email confirmation disabled),
      // the AuthContext loadUserProfile will run and auto-create a default org + membership.
      if (data.session) {
        setMessage('Account created successfully! Preparing your business...')
        // Navigate into setup; ProtectedRoute/AuthContext will ensure org+membership exist.
        navigate('/setup', { replace: true })
      } else {
        // Generic message (do not reveal confirmation status or SMTP config)
        setMessage(
          'Account created successfully. If email confirmation is required, please check your email to continue onboarding.',
        )
      }
    } catch (err: any) {
      console.error('Owner sign-up error:', err)
      setError(err?.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '')
    setPassword(value)
  }

  const handlePasswordBlur = () => {
    setPassword((prev) => prev.trim())
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '')
    setConfirmPassword(value)
  }

  const handleConfirmPasswordBlur = () => {
    setConfirmPassword((prev) => prev.trim())
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
              <h1 className="text-3xl font-bold text-primary-text mb-xs">Onboard your business</h1>
              <p className="text-base text-secondary-text">
                Create a secure owner account to manage your Flonest business.
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

                {/* Info */}
                {message && (
                  <div
                    className="rounded-md p-md break-words bg-success-light border border-solid"
                    style={{ borderColor: 'var(--color-success)' }}
                    role="status"
                    aria-live="polite"
                  >
                    <p className="text-sm break-words text-success">{message}</p>
                  </div>
                )}

                <Input
                  type="email"
                  label="Owner email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />

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
                  {loading ? 'Creating owner account...' : 'Create owner account'}
                </Button>

                <div className="text-center pt-md border-t border-color">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={() => navigate('/login', { replace: true })}
                    disabled={loading}
                  >
                    Back to login
                  </Button>
                </div>
              </form>
            </div>

            <p className="mt-lg text-center text-xs text-muted-text">
              This owner account will be used to create and manage your Flonest business.
            </p>
          </div>
        </div>
      </PullToRefresh>
    </div>
  )
}


