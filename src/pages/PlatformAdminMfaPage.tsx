import { FormEvent, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useMFAStatus, useEnrollMFA, useVerifyMFA } from '../hooks/useMFA'

interface EnrollmentState {
  factorId: string
  qrCode: string
  secret: string
}

type FlowMode = 'checking' | 'none' | 'enrollment' | 'verification'

export function PlatformAdminMfaPage() {
  const navigate = useNavigate()
  const { user, requiresAdminMfa, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [enrollmentState, setEnrollmentState] = useState<EnrollmentState | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // React Query hooks - handles caching, deduplication, and race conditions automatically
  const { data: statusData, isLoading: checkingStatus, error: statusError } = useMFAStatus(
    !!user && !!user.platformAdmin && requiresAdminMfa
  )
  const enrollMutation = useEnrollMFA()
  const verifyMutation = useVerifyMFA()

  // Guard clauses - redirect if not authorized
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (!user.platformAdmin) {
      navigate('/', { replace: true })
      return
    }

    if (!requiresAdminMfa) {
      navigate('/platform-admin', { replace: true })
      return
    }
  }, [user, requiresAdminMfa, navigate])

  // Determine flow mode based on React Query state
  const flowMode: FlowMode = useMemo(() => {
    if (checkingStatus) return 'checking'
    if (enrollmentState) return 'enrollment'
    if (statusData?.hasVerifiedFactor && statusData.factorId) return 'verification'
    return 'none'
  }, [checkingStatus, enrollmentState, statusData])

  // Derive info message from state
  const info = useMemo(() => {
    if (checkingStatus) return 'Loading MFA status...'
    if (enrollmentState) return 'Scan the QR code with your authenticator app, then enter the 6-digit code to verify.'
    if (flowMode === 'verification') return 'Enter the 6-digit code from your authenticator app.'
    return 'No authenticator enrolled. Click "Start Enrollment" to set up TOTP.'
  }, [checkingStatus, enrollmentState, flowMode])

  // Derive error message from React Query errors (non-session errors only)
  // Session errors (401) are handled globally and trigger redirect
  const error = useMemo(() => {
    if (localError) return localError

    const err = statusError || enrollMutation.error || verifyMutation.error
    if (!err) return null

    const code = (err as any)?.code as string | undefined
    const status = typeof (err as any)?.status === 'number' ? (err as any).status : undefined
    const message = err?.message || ''

    // Session errors are handled globally - shouldn't reach here, but sanitize just in case
    const isSessionError =
      status === 401 ||
      code === 'user_lookup_failed' ||
      code === 'missing_authorization' ||
      code === 'invalid_authorization' ||
      message.includes('Unable to load user from access token') ||
      message.includes('No active session') ||
      message.includes('access token')

    if (isSessionError) {
      // Global handler should have redirected, but return null to prevent UI error display
      return null
    }

    // Handle non-session errors
    const isNotAdmin =
      code === 'not_platform_admin' ||
      message.includes('not_platform_admin') ||
      message.includes('Platform admin access required')

    if (isNotAdmin) {
      return 'This account is not recognized as a platform admin. Please sign out and sign in with your admin account.'
    }

    if (code === 'enroll_failed') {
      return 'Could not start enrollment. Please try again.'
    }

    if (status && status >= 500) {
      return 'Admin MFA service is temporarily unavailable. Please try again.'
    }

    if (code === 'timeout') {
      return 'Admin MFA service took too long to respond. Please try again.'
    }

    if (code === 'verification_failed') {
      return 'Invalid code. Please try again.'
    }

    // Sanitize technical error messages
    return 'An error occurred. Please try again.'
  }, [localError, statusError, enrollMutation.error, verifyMutation.error])

  // Handle enrollment start
  const handleStartEnrollment = async () => {
    setLocalError(null)
    try {
      const response = await enrollMutation.mutateAsync()
      if (response.mode !== 'enrollment' || !response.factorId || !response.qrCode) {
        setLocalError('Failed to start enrollment. Please try again.')
        return
      }
      setEnrollmentState({
        factorId: response.factorId,
        qrCode: response.qrCode,
        secret: response.secret ?? '',
      })
    } catch (err) {
      // Errors are handled by error memo above
      // Global handler will redirect on 401 errors
    }
  }

  // Handle verification
  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const sanitizedCode = code.trim()
    if (sanitizedCode.length !== 6) {
      setLocalError('Enter the full 6-digit code.')
      return
    }

    const targetFactorId = enrollmentState?.factorId ?? statusData?.factorId
    if (!targetFactorId) {
      setLocalError('No authenticator factor found. Start enrollment first.')
      return
    }

    setLocalError(null)
    try {
      await verifyMutation.mutateAsync({ factorId: targetFactorId, code: sanitizedCode })
      // Success handler in hook will redirect
    } catch (err) {
      // Errors are handled by error memo above
      // Global handler will redirect on 401 errors
      // For verification failures, error memo will show "Invalid code"
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      window.location.href = '/login'
    }
  }

  // Guard: redirect if not authorized
  if (!user || !user.platformAdmin) {
    return null
  }

  return (
    <div className="viewport-height-safe bg-bg-page safe-top safe-bottom flex flex-col px-md py-lg">
      <div className="max-w-md w-full mx-auto page-enter">
        <div className="mb-xl text-center">
          <div className="mx-auto mb-lg flex h-20 w-20 items-center justify-center rounded-full bg-warning-light shadow-primary">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-primary-text mb-xs">Admin MFA Required</h1>
          <p className="text-base text-secondary-text">
            Platform admin access requires authenticator-app TOTP verification.
          </p>
        </div>

        <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color">
          {checkingStatus ? (
            <div className="text-center py-lg">
              <LoadingSpinner size="lg" />
              <p className="text-secondary-text mt-md">{info}</p>
            </div>
          ) : enrollmentState && flowMode === 'enrollment' ? (
            <div className="space-y-md">
              {error && (
                <div className="rounded-md p-md bg-error-light border border-error" role="alert">
                  <p className="text-sm text-error font-semibold">{error}</p>
                </div>
              )}

              <div className="rounded-md p-md bg-warning-light border border-dashed border-color">
                <p className="text-sm text-secondary-text">{info}</p>
              </div>

              <div className="flex flex-col items-center space-y-md">
                <div className="bg-white p-lg rounded-lg border border-color">
                  <img src={enrollmentState.qrCode} alt="TOTP QR Code" className="w-48 h-48" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-secondary-text mb-xs">Or enter this secret manually:</p>
                  <code className="text-xs bg-neutral-100 px-sm py-xs rounded break-all font-mono">
                    {enrollmentState.secret}
                  </code>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-md">
                <Input
                  label="Verification Code"
                  placeholder="123456"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={verifyMutation.isPending}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={verifyMutation.isPending}
                  isLoading={verifyMutation.isPending}
                >
                  Verify & Complete Enrollment
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  className="w-full text-error"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
              </form>
            </div>
          ) : flowMode === 'verification' ? (
            <form onSubmit={handleVerify} className="space-y-md">
              {error && (
                <div className="rounded-md p-md bg-error-light border border-error" role="alert">
                  <p className="text-sm text-error font-semibold">{error}</p>
                </div>
              )}

              <div className="rounded-md p-md bg-warning-light border border-dashed border-color">
                <p className="text-sm text-secondary-text">{info}</p>
              </div>

              <Input
                label="Authenticator Code"
                placeholder="123456"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                disabled={verifyMutation.isPending}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={verifyMutation.isPending}
                isLoading={verifyMutation.isPending}
              >
                Verify Code
              </Button>

              <div className="rounded-md p-md bg-warning-light border border-warning">
                <p className="text-sm text-secondary-text text-center">
                  <strong>Lost access to your authenticator app?</strong>
                  <br />
                  MFA reset requires email verification for security. Please contact platform support or use your backup recovery codes if you have them saved.
                </p>
              </div>

              <Button type="button" variant="ghost" size="md" className="w-full text-error" onClick={handleSignOut}>
                Sign out
              </Button>
            </form>
          ) : (
            <div className="space-y-md">
              {error && (
                <div className="rounded-md p-md bg-error-light border border-error" role="alert">
                  <p className="text-sm text-error font-semibold">{error}</p>
                </div>
              )}

              <div className="rounded-md p-md bg-warning-light border border-dashed border-color">
                <p className="text-sm text-secondary-text">{info}</p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleStartEnrollment}
                disabled={enrollMutation.isPending}
                isLoading={enrollMutation.isPending}
              >
                {enrollMutation.isPending ? 'Starting Enrollment...' : 'Start Enrollment'}
              </Button>

              <Button type="button" variant="ghost" size="md" className="w-full text-error" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
