import { FormEvent, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { adminMfaStatus, adminMfaStart, adminMfaVerify, adminMfaReset } from '../lib/api/adminMfa'

// Force rebuild v2: MFA status endpoint with timeout handling
// Updated: 2025-11-15 - Force new chunk hash for Service Worker cache busting

interface EnrollmentState {
  factorId: string
  qrCode: string
  secret: string
}

type FlowMode = 'checking' | 'none' | 'enrollment' | 'verification'

export function PlatformAdminMfaPage() {
  const navigate = useNavigate()
  const { user, requiresAdminMfa, refreshAdminMfaRequirement, signOut } = useAuth()
  const [enrollmentState, setEnrollmentState] = useState<EnrollmentState | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string>('Loading MFA status...')
  const [flowMode, setFlowMode] = useState<FlowMode>('checking')
  const [resetting, setResetting] = useState(false)
  const hasCheckedRef = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isCheckingRef = useRef(false)

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

    // Check factors ONCE on mount - no polling, no loops
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true
      initializeFlow()
    }

    // Cleanup timeout on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [user, requiresAdminMfa, navigate])

  const initializeFlow = async () => {
    setChecking(true)
    isCheckingRef.current = true
    setError(null)
    setInfo('Loading MFA status...')

    // Set loading state timeout (15 seconds)
    loadingTimeoutRef.current = setTimeout(() => {
      if (isCheckingRef.current) {
        setError('Unable to check MFA status. Please refresh or sign out and sign in again.')
        setFlowMode('none')
        setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
        setChecking(false)
        isCheckingRef.current = false
      }
    }, 15000)

    try {
      const response = await adminMfaStatus()

      // Clear timeout on success
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      isCheckingRef.current = false

      console.log('MFA Status Response:', response)

      if (response.hasVerifiedFactor && response.factorId) {
        console.log('Setting verification mode with factorId:', response.factorId)
        setFactorId(response.factorId)
        setEnrollmentState(null)
        setFlowMode('verification')
        setInfo('Enter the 6-digit code from your authenticator app.')
      } else {
        console.log('No verified factor found, setting none mode')
        setFactorId(null)
        setEnrollmentState(null)
        setFlowMode('none')
        setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
      }
    } catch (err: any) {
      console.error('Failed to load MFA status:', err)
      console.error('Error type:', err?.constructor?.name)
      console.error('Error message:', err?.message)
      console.error('Error stack:', err?.stack)

      // Clear timeout on error
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      isCheckingRef.current = false

      const errorMessage = err?.message || 'Unable to check MFA status. Please refresh or sign out and sign in again.'
      setError(errorMessage)
      setFlowMode('none')
      setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
    } finally {
      setChecking(false)
    }
  }

  const startEnrollment = async () => {
    setEnrolling(true)
    setError(null)

    try {
      const response = await adminMfaStart()

      if (response.mode !== 'enrollment' || !response.factorId || !response.qrCode) {
        throw new Error('Failed to start enrollment. Please try again.')
      }

      setEnrollmentState({
        factorId: response.factorId,
        qrCode: response.qrCode,
        secret: response.secret ?? '',
      })
      setFactorId(response.factorId)
      setFlowMode('enrollment')
      setInfo('Scan the QR code with your authenticator app, then enter the 6-digit code to verify.')
    } catch (err: any) {
      console.error('Enrollment failed:', err)
      setError(err?.message || 'Failed to start enrollment. Please try again.')
    } finally {
      setEnrolling(false)
    }
  }

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const sanitizedCode = code.trim()
    if (sanitizedCode.length !== 6) {
      setError('Enter the full 6-digit code.')
      return
    }

    const targetFactorId = enrollmentState?.factorId ?? factorId
    if (!targetFactorId) {
      setError('No authenticator factor found. Start enrollment first.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await adminMfaVerify(targetFactorId, sanitizedCode)
      await supabase.auth.refreshSession()
      await refreshAdminMfaRequirement()
      setInfo('Verification successful! Redirecting...')
      navigate('/platform-admin', { replace: true })
    } catch (err: any) {
      console.error('Verification failed:', err)
      setError(err?.message || 'Invalid code. Please try again.')
      if (!enrollmentState) {
        initializeFlow()
      }
    } finally {
      setIsSubmitting(false)
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

  const handleResetAuthenticator = async () => {
    if (resetting) return
    setResetting(true)
    setError(null)

    try {
      await adminMfaReset()
      await signOut().catch((err) => console.error('Sign out error during reset:', err))
      window.location.href = '/login'
    } catch (err: any) {
      console.error('Reset authenticator failed:', err)
      setError(err?.message || 'Failed to reset authenticator. Please try again.')
    } finally {
      setResetting(false)
    }
  }

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
          {checking ? (
            <div className="text-center py-lg">
              <p className="text-secondary-text">{info}</p>
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
                  disabled={isSubmitting}
                />

                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting} isLoading={isSubmitting}>
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
                disabled={isSubmitting}
              />

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting} isLoading={isSubmitting}>
                Verify Code
              </Button>

              <p className="text-center text-sm text-secondary-text">
                Lost access to your authenticator app?{' '}
                <button
                  type="button"
                  className="text-primary font-semibold underline underline-offset-2 disabled:opacity-50"
                  onClick={handleResetAuthenticator}
                  disabled={resetting}
                >
                  {resetting ? 'Resetting...' : 'Reset authenticator.'}
                </button>
              </p>

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
                onClick={startEnrollment}
                disabled={enrolling}
                isLoading={enrolling}
              >
                {enrolling ? 'Starting Enrollment...' : 'Start Enrollment'}
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
