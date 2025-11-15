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
  const startTime = Date.now()
  console.log('[DEBUG] adminMfaStatus: Starting request at', new Date().toISOString())
  
  try {
    console.log('[DEBUG] adminMfaStatus: Invoking Edge Function admin-mfa-enroll/status')
    const promise = supabase.functions.invoke('admin-mfa-enroll/status', {
      body: {},
    })

    console.log('[DEBUG] adminMfaStatus: Waiting for response (20s timeout)')
    const { data, error } = await withTimeout(promise, 20000) // 20 second timeout (Edge Function has retries)
    
    const elapsed = Date.now() - startTime
    console.log('[DEBUG] adminMfaStatus: Response received after', elapsed, 'ms', {
      hasData: !!data,
      hasError: !!error,
      data: data,
      error: error,
    })

    return parseFunctionResponse<StatusResponse>(data, error)
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error('[DEBUG] adminMfaStatus: Error after', elapsed, 'ms:', err)
    throw err
  }
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

