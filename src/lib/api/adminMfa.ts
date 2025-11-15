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

export async function adminMfaStatus(): Promise<StatusResponse> {
  const startTime = Date.now()
  console.log('[DEBUG] adminMfaStatus: Starting request at', new Date().toISOString())

  // Get current session token
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('[DEBUG] adminMfaStatus: Session check:', {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    sessionError: sessionError?.message,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
  })

  const accessToken = session?.access_token

  if (!accessToken) {
    console.error('[DEBUG] adminMfaStatus: No access token available')
    throw new Error('No active session - please sign in again')
  }

  const supabaseUrl = (supabase as any).supabaseUrl
  const anonKey = (supabase as any).supabaseKey

  console.log('[DEBUG] adminMfaStatus: Making direct fetch to Edge Function')
  console.log('[DEBUG] adminMfaStatus: URL:', `${supabaseUrl}/functions/v1/admin-mfa-enroll/status`)
  console.log('[DEBUG] adminMfaStatus: Headers:', {
    hasAuth: !!accessToken,
    hasApiKey: !!anonKey,
    tokenPrefix: accessToken.substring(0, 20) + '...',
  })

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
      headers: Object.fromEntries(response.headers.entries()),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] adminMfaStatus: Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      throw new Error(`Edge Function returned ${response.status}: ${errorText}`)
    }

    const responseText = await response.text()
    console.log('[DEBUG] adminMfaStatus: Raw response:', responseText)

    const data = JSON.parse(responseText)
    console.log('[DEBUG] adminMfaStatus: Parsed data:', data)
    return data as StatusResponse
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error('[DEBUG] adminMfaStatus: Error after', elapsed, 'ms:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      type: err?.constructor?.name,
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

