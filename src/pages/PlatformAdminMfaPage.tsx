import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

interface TotpState {
  factorId: string
  challengeId: string
}

interface EnrollmentState {
  factorId: string
  qrCode: string
  secret: string
  uri: string
}

type MfaMode = 'enrollment' | 'verification'

export function PlatformAdminMfaPage() {
  const navigate = useNavigate()
  const { user, requiresAdminMfa, refreshAdminMfaRequirement, signOut } = useAuth()
  const [mode, setMode] = useState<MfaMode>('verification')
  const [totpState, setTotpState] = useState<TotpState | null>(null)
  const [enrollmentState, setEnrollmentState] = useState<EnrollmentState | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [challengeLoading, setChallengeLoading] = useState(false)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string>('Authenticator app verification required.')

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (!user.platformAdmin) {
      navigate('/', { replace: true })
      return
    }

    // Temporarily bypass MFA requirement check to allow enrollment
    // After enrollment, requiresAdminMfa will be false and user will be redirected
    if (!requiresAdminMfa && mode === 'verification') {
      navigate('/platform-admin', { replace: true })
    }
  }, [user, requiresAdminMfa, navigate, mode])

  const startEnrollment = useCallback(async () => {
    setEnrollmentLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Platform Admin Authenticator',
      })

      if (error) throw error

      if (!data?.totp) {
        throw new Error('Failed to generate TOTP enrollment data')
      }

      setEnrollmentState({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      })
      setCode('')
      setInfo('Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to verify enrollment.')
    } catch (err: any) {
      console.error('Failed to start TOTP enrollment', err)
      setError(err?.message || 'Unable to start enrollment. Please try again.')
    } finally {
      setEnrollmentLoading(false)
    }
  }, [])

  const checkFactorsAndPrepare = useCallback(async () => {
    setChallengeLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        // If we can't list factors, assume we need enrollment
        console.error('Failed to list MFA factors:', error)
        setMode('enrollment')
        setChallengeLoading(false)
        setError('Unable to check authenticator status. Starting enrollment...')
        await startEnrollment()
        return
      }

      const totpFactor = data?.totp?.[0]

      // Handle three states: none, unverified, verified
      if (!totpFactor) {
        // State 1: No factor exists - start enrollment
        setMode('enrollment')
        setChallengeLoading(false)
        await startEnrollment()
        return
      }

      const factorStatus = totpFactor.status as string
      
      if (factorStatus === 'unverified') {
        // State 2: Factor exists but not verified - must delete before re-enrolling
        // Supabase doesn't provide QR code for unverified factors, so we delete and re-enroll
        setMode('enrollment')
        setChallengeLoading(false)
        setError(null) // Clear any previous errors
        
        // Delete unverified factor first - this MUST succeed before we can enroll
        try {
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id })
          if (unenrollError) {
            throw unenrollError
          }
          // Successfully deleted - now start fresh enrollment
          await startEnrollment()
        } catch (unenrollError: any) {
          console.error('Failed to delete unverified factor:', unenrollError)
          setError(unenrollError?.message || 'Unable to clean up unverified authenticator. Please contact support or try signing out and back in.')
          // Stay in enrollment mode but show error - user can retry
          // Don't proceed with enrollment if cleanup failed
        }
        return
      }

      if (factorStatus === 'verified') {
        // State 3: Factor is verified - proceed with normal verification flow
        setMode('verification')
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totpFactor.id,
        })

        if (challengeError) {
          // If challenge fails, might be an issue - fall back to enrollment check
          console.error('Failed to create MFA challenge:', challengeError)
          throw challengeError
        }

        setTotpState({
          factorId: totpFactor.id,
          challengeId: challenge.id,
        })
        setCode('')
        setInfo('Enter the 6-digit code from your authenticator app. SMS is disabled for admins.')
        return
      }

      // Unknown status - treat as unverified and require enrollment
      console.warn('Unknown factor status:', factorStatus)
      setMode('enrollment')
      setChallengeLoading(false)
      await startEnrollment()
    } catch (err: any) {
      console.error('Failed to start admin MFA challenge', err)
      // On any error, default to enrollment mode to allow user to set up fresh
      setMode('enrollment')
      setError(err?.message || 'Unable to create MFA challenge. Starting enrollment...')
      setChallengeLoading(false)
      // Try to start enrollment even on error
      try {
        await startEnrollment()
      } catch (enrollErr: any) {
        console.error('Failed to start enrollment after error:', enrollErr)
        setError(enrollErr?.message || 'Unable to start enrollment. Please try again or contact support.')
      }
    } finally {
      setChallengeLoading(false)
    }
  }, [startEnrollment])

  useEffect(() => {
    if (requiresAdminMfa && user?.platformAdmin) {
      checkFactorsAndPrepare()
    }
  }, [checkFactorsAndPrepare, requiresAdminMfa, user?.platformAdmin])

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const sanitizedCode = code.trim()
    if (sanitizedCode.length < 6) {
      setError('Enter the full 6-digit code from your authenticator app.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mode === 'enrollment' && enrollmentState) {
        // For enrollment verification, we need to create a challenge first
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: enrollmentState.factorId,
        })

        if (challengeError) throw challengeError

        // Verify enrollment with challenge
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: enrollmentState.factorId,
          challengeId: challenge.id,
          code: sanitizedCode,
        })

        if (verifyError) throw verifyError

        // Enrollment successful - switch to verification mode and create challenge
        setInfo('Enrollment successful! Please verify with a new code.')
        setMode('verification')
        setEnrollmentState(null)
        await checkFactorsAndPrepare()
      } else if (mode === 'verification' && totpState) {
        // Verify challenge
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: totpState.factorId,
          challengeId: totpState.challengeId,
          code: sanitizedCode,
        })

        if (verifyError) throw verifyError

        await refreshAdminMfaRequirement()
        setInfo('MFA completed successfully. Redirecting you to the platform admin console...')
        navigate('/platform-admin', { replace: true })
      }
    } catch (err: any) {
      console.error('Admin MFA verification failed', err)
      setError(err?.message || 'Invalid code. Please try again.')
      if (mode === 'verification') {
        await checkFactorsAndPrepare()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (mode === 'enrollment') {
      await startEnrollment()
    } else {
      await checkFactorsAndPrepare()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
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
            Platform admin access is locked behind authenticator-app TOTP. SMS and email fallbacks are disabled.
          </p>
        </div>

        <div className="rounded-lg bg-bg-card p-xl shadow-md border border-color">
          {mode === 'enrollment' && enrollmentState ? (
            <div className="space-y-md">
              {error && (
                <div
                  className="rounded-md p-md bg-error-light border border-solid"
                  style={{ borderColor: 'var(--color-error)' }}
                  role="alert"
                >
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="rounded-md p-md bg-warning-light border border-dashed border-color">
                <p className="text-sm text-secondary-text">{info}</p>
              </div>

              {/* QR Code Display */}
              <div className="flex flex-col items-center space-y-md">
                <div className="bg-white p-lg rounded-lg border border-color">
                  <img 
                    src={enrollmentState.qrCode} 
                    alt="TOTP QR Code" 
                    className="w-48 h-48"
                  />
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
                  disabled={loading || enrollmentLoading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={loading || enrollmentLoading}
                  isLoading={loading}
                >
                  Verify & Complete Enrollment
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="w-full"
                  disabled={enrollmentLoading}
                  onClick={handleResend}
                >
                  {enrollmentLoading ? 'Generating QR Code...' : 'Generate New QR Code'}
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
          ) : (
            <form onSubmit={handleVerify} className="space-y-md">
              {error && (
                <div
                  className="rounded-md p-md bg-error-light border border-solid"
                  style={{ borderColor: 'var(--color-error)' }}
                  role="alert"
                >
                  <p className="text-sm text-error">{error}</p>
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
                disabled={loading || challengeLoading || !totpState}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading || challengeLoading || !totpState}
                isLoading={loading}
              >
                Verify Code
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full"
                disabled={challengeLoading}
                onClick={handleResend}
              >
                {challengeLoading ? 'Requesting Challenge...' : 'Send New Challenge'}
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
          )}
        </div>
      </div>
    </div>
  )
}

