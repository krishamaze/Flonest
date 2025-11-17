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
    flowType: 'pkce', // Use PKCE flow for better security and OAuth handling
  },
  global: {
    headers: {
      'X-Client-Info': 'perbook-web',
    },
    // Intercept fetch to log actual request headers
    fetch: async (url, options = {}) => {
      const headers = options.headers as HeadersInit
      const headerMap = headers instanceof Headers 
        ? Object.fromEntries(headers.entries())
        : Array.isArray(headers)
        ? Object.fromEntries(headers as [string, string][])
        : headers || {}
      
      // Check current session state
      const { data: { session } } = await supabase.auth.getSession()
      
      // Log request details for debugging
      const urlStr = typeof url === 'string' ? url : url.toString()
      const isPostgREST = urlStr.includes('/rest/v1/')
      
      if (isPostgREST) {
        // Only log PostgREST requests (database queries)
        console.log('[Supabase PostgREST Request]', {
          url: urlStr,
          method: options.method || 'GET',
          hasAuthorization: !!headerMap['Authorization'] || !!headerMap['authorization'],
          authorizationPrefix: headerMap['Authorization'] || headerMap['authorization'] 
            ? (headerMap['Authorization'] || headerMap['authorization'])?.toString().substring(0, 30) + '...'
            : 'MISSING',
          sessionExists: !!session,
          sessionUserId: session?.user?.id,
          sessionTokenPrefix: session?.access_token?.substring(0, 20) + '...' || 'NO_TOKEN',
          allHeaders: Object.keys(headerMap),
        })
      }
      
      // Call original fetch
      return fetch(url, options)
    },
  },
})

// Temporary: expose for testing
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase
}

