import { supabase } from '../supabase'

type StartMode = 'none' | 'enrollment' | 'challenge'

interface StartResponse {
  mode: StartMode
  factorId?: string
  qrCode?: string
  secret?: string
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

export async function adminMfaStart(action?: 'status' | 'enroll'): Promise<StartResponse> {
  const { data, error } = await supabase.functions.invoke('admin-mfa-enroll/start', {
    body: action ? { action } : {},
  })

  return parseFunctionResponse<StartResponse>(data, error)
}

export async function adminMfaVerify(factorId: string, code: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-mfa-enroll/verify', {
    body: { factorId, code },
  })

  parseFunctionResponse<{ success: boolean }>(data, error)
}

