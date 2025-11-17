import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY')
  throw new Error(
    `Missing Supabase environment variables: ${missing.join(', ')}\n` +
    `Please check your .env file and ensure these variables are set.\n` +
    `Get these from: Supabase Dashboard → Project Settings → API\n` +
    `See .env.example for the required format.`
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    // Don't use PKCE - it requires additional Supabase configuration
    // Default flow handles OAuth callbacks automatically
  },
  global: {
    headers: {
      'X-Client-Info': 'perbook-web',
    },
    // Intercept fetch to log actual request headers (non-blocking)
    fetch: (url, options = {}) => {
      // Don't await - just log synchronously to avoid blocking
      const urlStr = typeof url === 'string' ? url : url.toString()
      const isPostgREST = urlStr.includes('/rest/v1/')
      
      if (isPostgREST) {
        // Log headers synchronously (don't await getSession to avoid blocking)
        const headers = options.headers as HeadersInit
        let headerMap: Record<string, string> = {}
        
        if (headers instanceof Headers) {
          headerMap = Object.fromEntries(headers.entries())
        } else if (Array.isArray(headers)) {
          headerMap = Object.fromEntries(headers as [string, string][])
        } else if (headers) {
          headerMap = headers as Record<string, string>
        }
        
        // Log request details (non-blocking)
        console.log('[Supabase PostgREST Request]', {
          url: urlStr,
          method: options.method || 'GET',
          hasAuthorization: !!headerMap['Authorization'] || !!headerMap['authorization'],
          authorizationPrefix: headerMap['Authorization'] || headerMap['authorization'] 
            ? (headerMap['Authorization'] || headerMap['authorization'])?.substring(0, 30) + '...'
            : 'MISSING',
          allHeaders: Object.keys(headerMap),
        })
      }
      
      // Call original fetch immediately (don't block)
      return fetch(url, options)
    },
  },
})

// Temporary: expose for testing
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase
  
  // Add diagnostic function to test auth.uid() resolution
  ;(window as any).testAuthUid = async () => {
    const { data, error } = await supabase.rpc('test_auth_uid_resolution' as any)
    if (error) {
      console.error('[Auth UID Test] Error:', error)
      return null
    }
    console.log('[Auth UID Test] Result:', data)
    
    // Also check session
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[Auth UID Test] Session user ID:', session?.user?.id)
    console.log('[Auth UID Test] Session access token (first 50 chars):', session?.access_token?.substring(0, 50))
    
    return data
  }
}

