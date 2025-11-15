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
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [emergencyMode, setEmergencyMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string>('Authenticator app verification required.')

  // Timeout wrapper for async operations
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          console.error(`[MFA] ${operation} timed out after ${timeoutMs}ms`)
          reject(new Error(`${operation} timed out after ${timeoutMs}ms. Please try again or sign out.`))
        }, timeoutMs)
      ),
    ])
  }

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
      // Use timestamp to make friendlyName unique - prevents 422 duplicate errors
      const timestamp = Date.now()
      const uniqueFriendlyName = `Platform Admin ${timestamp}`
      
      // Add timeout to enrollment request (10 seconds)
      const enrollPromise = supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: uniqueFriendlyName,
      })
      
      const { data, error } = await withTimeout(
        enrollPromise,
        10000,
        'TOTP enrollment'
      ).catch((timeoutErr) => {
        setEmergencyMode(true)
        setError('Enrollment request timed out. You can sign out or try again.')
        throw timeoutErr
      })

      // Handle 422 error (factor already exists) - this shouldn't happen with unique names
      // but handle it gracefully if it does
      if (error) {
        if (error.status === 422 || error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.warn('[MFA] Enrollment failed - factor may already exist:', error)
          setEmergencyMode(true)
          setError('An authenticator is already enrolled. Please sign out and sign back in, or contact support.')
          throw error
        }
        setEmergencyMode(true)
        throw error
      }

      // Supabase returns factor object directly in data
      // Structure: { id, type, friendly_name, secret, uri, qr_code } (flat) OR { id, totp: { secret, uri, qr_code } } (nested)
      if (!data || !data.id) {
        setEmergencyMode(true)
        throw new Error('Failed to generate TOTP enrollment data - invalid response')
      }

      // Store factor ID - this is critical for verification
      const factorId = data.id
      
      // Handle both response structures: flat or nested
      const qrCode = (data as any).qr_code || data.totp?.qr_code
      const secret = (data as any).secret || data.totp?.secret || ''
      const uri = (data as any).uri || data.totp?.uri || ''
      
      if (!qrCode) {
        setEmergencyMode(true)
        throw new Error('Failed to generate TOTP QR code - invalid response structure')
      }

      console.log('[MFA] Enrollment successful, factor ID:', factorId, 'has QR:', !!qrCode)
      
      setEnrollmentState({
        factorId: factorId,
        qrCode: qrCode,
        secret: secret,
        uri: uri,
      })
      setCode('')
      setInfo('Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to verify enrollment.')
      setEmergencyMode(false) // Clear emergency mode on success
    } catch (err: any) {
      console.error('Failed to start TOTP enrollment', err)
      setError(err?.message || 'Unable to start enrollment. You can sign out or try again.')
      setEmergencyMode(true)
    } finally {
      setEnrollmentLoading(false)
    }
  }, [])

  const checkFactorsAndPrepare = useCallback(async () => {
    setChallengeLoading(true)
    setError(null)
    setEmergencyMode(false)

    try {
      // Try listFactors with very short timeout (2 seconds) - if it hangs, skip it
      // This prevents infinite loading when listFactors() hangs
      let totpFactor: any = null
      let hasVerifiedFactor = false
      
      try {
        const listFactorsPromise = supabase.auth.mfa.listFactors()
        const { data, error } = await withTimeout(
          listFactorsPromise,
          2000, // Very short timeout - if it hangs, we skip it
          'List MFA factors'
        )
        
        if (!error && data?.totp?.[0]) {
          totpFactor = data.totp[0]
          const factorStatus = totpFactor.status as string
          hasVerifiedFactor = factorStatus === 'verified'
          
          if (factorStatus === 'unverified') {
            // Delete unverified factor before enrolling
            try {
              await supabase.auth.mfa.unenroll({ factorId: totpFactor.id })
              totpFactor = null // Clear it so we enroll fresh
            } catch (unenrollErr) {
              console.warn('[MFA] Failed to delete unverified factor:', unenrollErr)
              // Continue anyway - enrollment with unique name should work
            }
          }
        }
      } catch (listErr: any) {
        // listFactors timed out or failed - skip it and go straight to enrollment
        console.warn('[MFA] listFactors() timed out or failed, skipping factor check:', listErr)
        // Don't set error here - we'll try enrollment which may work
      }

      // If we have a verified factor, try verification flow
      if (hasVerifiedFactor && totpFactor) {
        setMode('verification')
        
        try {
          const challengePromise = supabase.auth.mfa.challenge({
            factorId: totpFactor.id,
          })
          
          const { data: challenge, error: challengeError } = await withTimeout(
            challengePromise,
            10000,
            'MFA challenge request'
          )

          if (challengeError) {
            throw challengeError
          }

          setTotpState({
            factorId: totpFactor.id,
            challengeId: challenge.id,
          })
          setCode('')
          setInfo('Enter the 6-digit code from your authenticator app. SMS is disabled for admins.')
          setEmergencyMode(false)
          return
        } catch (challengeErr: any) {
          console.error('[MFA] Challenge failed, falling back to enrollment:', challengeErr)
          // Fall through to enrollment
        }
      }

      // No verified factor or challenge failed - start enrollment with unique name
      setMode('enrollment')
      setChallengeLoading(false)
      await startEnrollment()
      
    } catch (err: any) {
      console.error('[MFA] Failed to prepare MFA flow', err)
      setEmergencyMode(true)
      setMode('enrollment')
      setError(err?.message || 'Unable to prepare authenticator. You can sign out or try again.')
      setChallengeLoading(false)
      
      // Try enrollment as fallback
      try {
        await startEnrollment()
        setEmergencyMode(false) // Clear if enrollment succeeds
      } catch (enrollErr: any) {
        console.error('[MFA] Enrollment fallback also failed:', enrollErr)
        setError(enrollErr?.message || 'Unable to start enrollment. You can sign out or contact support.')
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
        // For enrollment verification: create challenge then verify
        // This completes the enrollment and activates the factor
        console.log('[MFA] Verifying enrollment for factor:', enrollmentState.factorId)
        
        const challengePromise = supabase.auth.mfa.challenge({
          factorId: enrollmentState.factorId,
        })
        
        const { data: challenge, error: challengeError } = await withTimeout(
          challengePromise,
          10000,
          'Create enrollment challenge'
        ).catch(() => {
          setEmergencyMode(true)
          throw new Error('Challenge request timed out. Please try again.')
        })

        if (challengeError) {
          console.error('[MFA] Challenge creation failed:', challengeError)
          throw challengeError
        }

        if (!challenge?.id) {
          throw new Error('Invalid challenge response - missing challenge ID')
        }

        console.log('[MFA] Challenge created:', challenge.id, 'verifying code...')

        // Verify enrollment with challenge - this completes enrollment
        const verifyPromise = supabase.auth.mfa.verify({
          factorId: enrollmentState.factorId,
          challengeId: challenge.id,
          code: sanitizedCode,
        })

        const { error: verifyError } = await withTimeout(
          verifyPromise,
          10000,
          'Verify enrollment code'
        ).catch(() => {
          setEmergencyMode(true)
          throw new Error('Verification request timed out. Please try again.')
        })

        if (verifyError) {
          console.error('[MFA] Verification failed:', verifyError)
          throw verifyError
        }

        console.log('[MFA] Enrollment verification successful! Factor activated.')

        // Enrollment successful - refresh MFA requirement and redirect
        await refreshAdminMfaRequirement()
        setInfo('Enrollment successful! Redirecting to platform admin console...')
        setMode('verification')
        setEnrollmentState(null)
        
        // Small delay to show success message, then redirect
        setTimeout(() => {
          navigate('/platform-admin', { replace: true })
        }, 1000)
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

  const handleSignOut = async (e?: React.MouseEvent | React.FormEvent) => {
    console.log('[SignOut] Button clicked', { signOutLoading, e, type: e?.type })
    
    // Always prevent default and stop propagation
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (signOutLoading) {
      console.log('[SignOut] Already loading, ignoring click')
      return // Prevent double-clicks
    }
    
    console.log('[SignOut] Starting sign out process')
    setSignOutLoading(true)
    
    try {
      console.log('[SignOut] Calling signOut()')
      await signOut()
      console.log('[SignOut] signOut() completed successfully')
    } catch (err) {
      console.error('[SignOut] Sign out error:', err)
      // Even if signOut fails, still redirect
    } finally {
      setSignOutLoading(false)
      console.log('[SignOut] Loading state cleared')
    }
    
    // Always navigate to login page - use window.location for reliable redirect
    console.log('[SignOut] Redirecting to /login')
    window.location.href = '/login'
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
                  <p className="text-sm text-error font-semibold">{error}</p>
                  {emergencyMode && (
                    <p className="text-xs text-error mt-xs">
                      ⚠️ Emergency mode active: Sign out is always available.
                    </p>
                  )}
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
                  disabled={signOutLoading}
                  isLoading={signOutLoading}
                >
                  {signOutLoading ? 'Signing out...' : 'Sign out'}
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
                  <p className="text-sm text-error font-semibold">{error}</p>
                  {emergencyMode && (
                    <p className="text-xs text-error mt-xs">
                      ⚠️ Emergency mode active: Sign out is always available.
                    </p>
                  )}
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
                disabled={signOutLoading}
                isLoading={signOutLoading}
              >
                {signOutLoading ? 'Signing out...' : emergencyMode ? 'Sign out (Emergency)' : 'Sign out'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

