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
  
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  
  if (!accessToken) {
    throw new Error('No active session - please sign in again')
  }
  
  const supabaseUrl = (supabase as any).supabaseUrl
  const anonKey = (supabase as any).supabaseKey
  
  console.log('[DEBUG] adminMfaStatus: Making direct fetch to Edge Function')
  console.log('[DEBUG] adminMfaStatus: URL:', `${supabaseUrl}/functions/v1/admin-mfa-enroll/status`)
  
  try {
    // Direct fetch is required because supabase.functions.invoke() doesn't support path segments
    // The invoke method only supports function names, not paths like 'admin-mfa-enroll/status'
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-mfa-enroll/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({}),
    })
    
    const elapsed = Date.now() - startTime
    console.log('[DEBUG] adminMfaStatus: Response received after', elapsed, 'ms', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] adminMfaStatus: Error response:', errorText)
      throw new Error(`Edge Function returned ${response.status}: ${errorText}`)
    }
    
    const data = await response.json()
    console.log('[DEBUG] adminMfaStatus: Success:', data)
    return data as StatusResponse
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error('[DEBUG] adminMfaStatus: Error after', elapsed, 'ms:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    })
    throw err
  }
}

export async function adminMfaStart(action?: 'enroll'): Promise<StartResponse> {
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  
  if (!accessToken) {
    throw new Error('No active session - please sign in again')
  }
  
  const supabaseUrl = (supabase as any).supabaseUrl
  const anonKey = (supabase as any).supabaseKey
  
  // Direct fetch is required because supabase.functions.invoke() doesn't support path segments
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-mfa-enroll/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify(action ? { action } : { action: 'enroll' }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Edge Function returned ${response.status}: ${errorText}`)
  }
  
  const data = await response.json()
  return data as StartResponse
}

export async function adminMfaVerify(factorId: string, code: string): Promise<void> {
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  
  if (!accessToken) {
    throw new Error('No active session - please sign in again')
  }
  
  const supabaseUrl = (supabase as any).supabaseUrl
  const anonKey = (supabase as any).supabaseKey
  
  // Direct fetch is required because supabase.functions.invoke() doesn't support path segments
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-mfa-enroll/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({ factorId, code }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Edge Function returned ${response.status}: ${errorText}`)
  }
  
  const data = await response.json()
  if (!data.success) {
    throw new Error('Verification failed')
  }
}

