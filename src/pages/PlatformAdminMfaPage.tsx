import { FormEvent, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

interface EnrollmentState {
  factorId: string
  qrCode: string
  secret: string
}

export function PlatformAdminMfaPage() {
  const navigate = useNavigate()
  const { user, requiresAdminMfa, refreshAdminMfaRequirement, signOut } = useAuth()
  const [enrollmentState, setEnrollmentState] = useState<EnrollmentState | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string>('Checking authenticator status...')
  const hasCheckedRef = useRef(false)

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
      checkFactorsOnce()
    }
  }, [user, requiresAdminMfa, navigate])

  const checkFactorsOnce = async () => {
    setChecking(true)
    setError(null)

    try {
      // Try to list factors with timeout - if it fails, assume no factors exist
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )

      const { data, error } = await Promise.race([
        supabase.auth.mfa.listFactors(),
        timeoutPromise,
      ]).catch(() => ({ data: null, error: { message: 'timeout' } })) as {
        data: any
        error: any
      }

      if (error || !data?.totp?.length) {
        // No factors or timeout - show enrollment button
        setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
        setChecking(false)
        return
      }

      const verifiedFactor = data.totp.find((f: any) => f.status === 'verified')
      if (verifiedFactor) {
        // Has verified factor - start challenge flow
        await startChallenge(verifiedFactor.id)
      } else {
        // Has unverified factor - clean it up and show enrollment
        const unverifiedFactor = data.totp.find((f: any) => f.status === 'unverified')
        if (unverifiedFactor) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: unverifiedFactor.id })
          } catch (e) {
            console.warn('Failed to clean up unverified factor:', e)
          }
        }
        setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
        setChecking(false)
      }
    } catch (err: any) {
      console.warn('Failed to check factors:', err)
      setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
      setChecking(false)
    }
  }

  const startChallenge = async (fId: string) => {
    setFactorId(fId)
    setLoading(true)
    setError(null)

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: fId,
      })

      if (challengeError) throw challengeError
      if (!challenge?.id) throw new Error('Invalid challenge response')

      setChallengeId(challenge.id)
      setInfo('Enter the 6-digit code from your authenticator app.')
      setChecking(false)
    } catch (err: any) {
      console.error('Challenge failed:', err)
      setError(err?.message || 'Failed to start verification. Try enrollment instead.')
      setInfo('No authenticator enrolled. Click "Start Enrollment" to set up TOTP.')
      setFactorId(null)
      setChallengeId(null)
    } finally {
      setLoading(false)
    }
  }

  const startEnrollment = async () => {
    setEnrolling(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Platform Admin ${Date.now()}`,
      })

      if (error) throw error
      if (!data?.id) throw new Error('Invalid enrollment response')

      const qrCode = (data as any).qr_code || data.totp?.qr_code
      const secret = (data as any).secret || data.totp?.secret || ''

      if (!qrCode) throw new Error('Failed to generate QR code')

      setEnrollmentState({
        factorId: data.id,
        qrCode,
        secret,
      })
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

    setLoading(true)
    setError(null)

    try {
      if (enrollmentState) {
        // Enrollment verification: challenge → verify
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: enrollmentState.factorId,
        })

        if (challengeError) throw challengeError
        if (!challenge?.id) throw new Error('Invalid challenge response')

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: enrollmentState.factorId,
          challengeId: challenge.id,
          code: sanitizedCode,
        })

        if (verifyError) throw verifyError

        // Enrollment complete - refresh and redirect
        setInfo('Enrollment successful! Redirecting...')
        await refreshAdminMfaRequirement()
        navigate('/platform-admin', { replace: true })
      } else if (challengeId && factorId) {
        // Regular verification
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code: sanitizedCode,
        })

        if (verifyError) throw verifyError

        // Verification complete
        setInfo('Verification successful! Redirecting...')
        await refreshAdminMfaRequirement()
        navigate('/platform-admin', { replace: true })
      }
    } catch (err: any) {
      console.error('Verification failed:', err)
      setError(err?.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
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
          ) : enrollmentState ? (
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
                  disabled={loading}
                />

                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading} isLoading={loading}>
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
          ) : (
            <form onSubmit={handleVerify} className="space-y-md">
              {error && (
                <div className="rounded-md p-md bg-error-light border border-error" role="alert">
                  <p className="text-sm text-error font-semibold">{error}</p>
                </div>
              )}

              <div className="rounded-md p-md bg-warning-light border border-dashed border-color">
                <p className="text-sm text-secondary-text">{info}</p>
              </div>

              {challengeId && factorId ? (
                <>
                  <Input
                    label="Authenticator Code"
                    placeholder="123456"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={loading}
                  />

                  <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading} isLoading={loading}>
                    Verify Code
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={() => factorId && startChallenge(factorId)}
                    disabled={loading}
                  >
                    Request New Challenge
                  </Button>
                </>
              ) : (
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
              )}

              <Button type="button" variant="ghost" size="md" className="w-full text-error" onClick={handleSignOut}>
                Sign out
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
