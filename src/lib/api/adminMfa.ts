import { supabase } from '../supabase'

type StartMode = 'none' | 'enrollment' | 'challenge'

interface StartResponse {
  mode: StartMode
  factorId?: string
  qrCode?: string
  secret?: string
}

interface StatusResponse {
  hasVerifiedFactor: boolean
  factorId?: string
}

const parseFunctionResponse = <T>(data: any, error: any): T => {
  if (error) {
    throw new Error(error.message ?? 'Unexpected error calling MFA function')
  }

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'MFA function error')
  }

  return data as T
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

export async function adminMfaStatus(): Promise<StatusResponse> {
  const promise = supabase.functions.invoke('admin-mfa-enroll/status', {
    body: {},
  })

  const { data, error } = await withTimeout(promise, 10000) // 10 second timeout

  return parseFunctionResponse<StatusResponse>(data, error)
}

export async function adminMfaStart(action?: 'enroll'): Promise<StartResponse> {
  const { data, error } = await supabase.functions.invoke('admin-mfa-enroll/start', {
    body: action ? { action } : { action: 'enroll' },
  })

  return parseFunctionResponse<StartResponse>(data, error)
}

export async function adminMfaVerify(factorId: string, code: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-mfa-enroll/verify', {
    body: { factorId, code },
  })

  parseFunctionResponse<{ success: boolean }>(data, error)
}

