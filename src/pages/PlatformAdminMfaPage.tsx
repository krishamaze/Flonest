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

export function PlatformAdminMfaPage() {
  const navigate = useNavigate()
  const { user, requiresAdminMfa, refreshAdminMfaRequirement, signOut } = useAuth()
  const [totpState, setTotpState] = useState<TotpState | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [challengeLoading, setChallengeLoading] = useState(false)
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

    if (!requiresAdminMfa) {
      navigate('/platform-admin', { replace: true })
    }
  }, [user, requiresAdminMfa, navigate])

  const prepareChallenge = useCallback(async () => {
    setChallengeLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error

      const totpFactor = data?.totp?.[0]
      if (!totpFactor) {
        setError('No verified authenticator factor found. Contact the security team to re-enroll.')
        setTotpState(null)
        return
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })

      if (challengeError) throw challengeError

      setTotpState({
        factorId: totpFactor.id,
        challengeId: challenge.id,
      })
      setCode('')
      setInfo('Enter the 6-digit code from your authenticator app. SMS is disabled for admins.')
    } catch (err: any) {
      console.error('Failed to start admin MFA challenge', err)
      setError(err?.message || 'Unable to create MFA challenge. Please try again.')
    } finally {
      setChallengeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (requiresAdminMfa && user?.platformAdmin) {
      prepareChallenge()
    }
  }, [prepareChallenge, requiresAdminMfa, user?.platformAdmin])

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!totpState) return

    const sanitizedCode = code.trim()
    if (sanitizedCode.length < 6) {
      setError('Enter the full 6-digit code from your authenticator app.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpState.factorId,
        challengeId: totpState.challengeId,
        code: sanitizedCode,
      })

      if (verifyError) throw verifyError

      await refreshAdminMfaRequirement()
      setInfo('MFA completed successfully. Redirecting you to the reviewer console...')
      navigate('/platform-admin', { replace: true })
    } catch (err: any) {
      console.error('Admin MFA verification failed', err)
      setError(err?.message || 'Invalid code. Please try again.')
      await prepareChallenge()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    await prepareChallenge()
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
              onChange={(e) => setCode(e.target.value.replace(/\\D/g, ''))}
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
        </div>
      </div>
    </div>
  )
}

