import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { syncUserProfile } from '../lib/userSync'
import type { AuthUser } from '../types'

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  connectionError: boolean
  retrying: boolean
  retryConnection: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const CONNECTION_TIMEOUT = 5000 // 5 seconds
const CACHE_KEY = 'lastGoodSession'

interface CachedSession {
  session: Session | null
  user: AuthUser | null
  timestamp: number
}

function saveCachedSession(session: Session | null, user: AuthUser | null) {
  try {
    const cached: CachedSession = {
      session,
      user,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch (error) {
    // Ignore localStorage errors (private browsing, quota exceeded, etc.)
    if (import.meta.env.DEV) {
      console.warn('[Auth Cache] Failed to save session:', error)
    }
  }
}

function loadCachedSession(): CachedSession | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const parsed: CachedSession = JSON.parse(cached)
    // Cache is valid for 24 hours
    const CACHE_TTL = 24 * 60 * 60 * 1000
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    return parsed
  } catch (error) {
    // Ignore localStorage errors
    if (import.meta.env.DEV) {
      console.warn('[Auth Cache] Failed to load session:', error)
    }
    return null
  }
}

function clearCachedSession() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    // Ignore localStorage errors
  }
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Connection timeout'))
    }, timeoutMs)
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadUserProfile(session.user, false)
      } else {
        setUser(null)
        setLoading(false)
        clearCachedSession()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const initializeAuth = async () => {
    try {
      // Try to get session with timeout
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)

      const result = await Promise.race([sessionPromise, timeoutPromise])
      const { data: { session } } = result as Awaited<typeof sessionPromise>

      setSession(session)
      if (session?.user) {
        try {
          await loadUserProfile(session.user, true)
        } catch (profileError) {
          // Profile load failed (timeout or error)
          if (import.meta.env.DEV) {
            console.warn('[Auth Timeout] Profile load failed:', profileError)
          }
          // Try to use cached session
          const cached = loadCachedSession()
          if (cached && cached.user) {
            if (import.meta.env.DEV) {
              console.warn('[Auth Timeout] Using cached session after profile load failure')
            }
            setUser(cached.user)
            setConnectionError(true)
            attemptBackgroundReconnect()
          } else {
            setConnectionError(true)
          }
          // loading is already false from loadUserProfile's finally block
        }
      } else {
        setLoading(false)
      }
    } catch (error) {
      // Timeout or connection error during session fetch
      if (import.meta.env.DEV) {
        console.warn('[Auth Timeout] Connection timeout during initialization')
      }

      // Try to load from cache
      const cached = loadCachedSession()
      if (cached && cached.user) {
        if (import.meta.env.DEV) {
          console.warn('[Auth Timeout] Using cached session')
        }
        setSession(cached.session)
        setUser(cached.user)
        setConnectionError(true)
        setLoading(false)
        // Attempt background reconnection
        attemptBackgroundReconnect()
      } else {
        setConnectionError(true)
        setLoading(false)
      }
    }
  }

  const attemptBackgroundReconnect = async () => {
    // Silently attempt to reconnect in the background
    try {
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
      const result = await Promise.race([sessionPromise, timeoutPromise])
      const { data: { session } } = result as Awaited<typeof sessionPromise>

      if (session?.user) {
        await loadUserProfile(session.user, false)
        setConnectionError(false)
        if (import.meta.env.DEV) {
          console.warn('[Auth Timeout] Background reconnection successful')
        }
      }
    } catch (error) {
      // Background reconnection failed, keep using cached data
      if (import.meta.env.DEV) {
        console.warn('[Auth Timeout] Background reconnection failed')
      }
    }
  }

  const retryConnection = async () => {
    if (retrying) return // Prevent spam

    setRetrying(true)
    setConnectionError(false)
    setLoading(true)

    try {
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
      const result = await Promise.race([sessionPromise, timeoutPromise])
      const { data: { session } } = result as Awaited<typeof sessionPromise>

      setSession(session)
      if (session?.user) {
        await loadUserProfile(session.user, true)
        setConnectionError(false)
      } else {
        setLoading(false)
        setConnectionError(false)
      }
    } catch (error) {
      // Retry failed
      if (import.meta.env.DEV) {
        console.warn('[Auth Timeout] Retry failed:', error)
      }

      // Try cache again
      const cached = loadCachedSession()
      if (cached && cached.user) {
        setSession(cached.session)
        setUser(cached.user)
        setConnectionError(true)
        setLoading(false)
      } else {
        setConnectionError(true)
        setLoading(false)
      }
    } finally {
      setRetrying(false)
    }
  }

  const loadUserProfile = async (authUser: User, useTimeout = true) => {
    try {
      // First, check if user is internal - short-circuit if so
      let profileQuery
      if (useTimeout) {
        const queryPromise = supabase
          .from('profiles')
          .select('id, email, is_internal')
          .eq('id', authUser.id)
          .maybeSingle()
        const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
        profileQuery = await Promise.race([queryPromise, timeoutPromise])
      } else {
        profileQuery = await supabase
          .from('profiles')
          .select('id, email, is_internal')
          .eq('id', authUser.id)
          .maybeSingle()
      }

      const { data: profile, error: profileError } = profileQuery as {
        data: any | null
        error: any
      }

      if (profileError) throw profileError

      // If profile doesn't exist, sync it first
      if (!profile) {
        console.log('User profile not found, syncing...')
        let syncedData
        if (useTimeout) {
          const syncPromise = syncUserProfile(authUser)
          const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
          syncedData = await Promise.race([syncPromise, timeoutPromise])
        } else {
          syncedData = await syncUserProfile(authUser)
        }

        if (syncedData && syncedData.profile) {
          // Use synced profile data
          const syncedProfile = syncedData.profile
          const isInternal = syncedProfile.is_internal || false

          // Short-circuit for internal users - skip membership entirely
          if (isInternal) {
            const userData = {
              id: syncedProfile.id,
              email: syncedProfile.email,
              orgId: null,
              role: null,
              branchId: null,
              isInternal: true,
            }
            setUser(userData)
            setConnectionError(false)
            const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
            saveCachedSession(currentSession, userData)
            return
          }

          // For non-internal users, check if they have org/membership
          if (syncedData.membership && syncedData.org) {
            const userData = {
              id: syncedProfile.id,
              email: syncedProfile.email,
              orgId: syncedData.org.id,
              role: (syncedData.membership.role || 'staff') as 'owner' | 'branch_head' | 'staff',
              branchId: syncedData.membership.branch_id || null,
              isInternal: false,
            }
            setUser(userData)
            setConnectionError(false)
            const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
            saveCachedSession(currentSession, userData)
            return
          }

          // Non-internal user with no org
          const userData = {
            id: syncedProfile.id,
            email: syncedProfile.email,
            orgId: null,
            role: null,
            branchId: null,
            isInternal: false,
          }
          setUser(userData)
          setConnectionError(false)
          const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
          saveCachedSession(currentSession, userData)
          return
        } else {
          console.error('Failed to sync user profile - no profile found')
          return
        }
      }

      // Profile exists - check if internal
      const isInternal = profile.is_internal || false

      // Short-circuit for internal users - skip membership query entirely
      if (isInternal) {
        const userData = {
          id: profile.id,
          email: profile.email,
          orgId: null,
          role: null,
          branchId: null,
          isInternal: true,
        }
        setUser(userData)
        setConnectionError(false)
        const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
        saveCachedSession(currentSession, userData)
        return
      }

      // For non-internal users, load membership (including branch_id)
      // Only load active memberships - pending memberships cannot access the app
      let membershipsResult
      if (useTimeout) {
        const queryPromise = supabase
          .from('memberships')
          .select('*, profiles(*), orgs(*)')
          .eq('profile_id', authUser.id)
          .eq('membership_status', 'active')
          .limit(1)
        const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
        membershipsResult = await Promise.race([queryPromise, timeoutPromise])
      } else {
        membershipsResult = await supabase
          .from('memberships')
          .select('*, profiles(*), orgs(*)')
          .eq('profile_id', authUser.id)
          .eq('membership_status', 'active')
          .limit(1)
      }

      const { data: memberships, error } = membershipsResult as {
        data: any[] | null
        error: any
      }

      if (error) throw error

      const membership = memberships && memberships.length > 0 ? memberships[0] : null

      if (membership && membership.profiles && membership.orgs) {
        // Membership exists, use it
        const membershipProfile = membership.profiles as any
        const org = membership.orgs as any
        const userData = {
          id: membershipProfile.id,
          email: membershipProfile.email,
          orgId: org.id,
          role: (membership.role || 'staff') as 'owner' | 'branch_head' | 'staff',
          branchId: membership.branch_id || null,
          isInternal: membershipProfile.is_internal || false,
        }
        setUser(userData)
        setConnectionError(false)
        const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
        saveCachedSession(currentSession, userData)
      } else {
        // Non-internal user with no membership
        const userData = {
          id: profile.id,
          email: profile.email,
          orgId: null,
          role: null,
          branchId: null,
          isInternal: false,
        }
        setUser(userData)
        setConnectionError(false)
        const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
        saveCachedSession(currentSession, userData)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Auth Timeout] Error loading user profile:', error)
      }

      // On timeout, try to use cached session
      if (useTimeout && (error as Error).message === 'Connection timeout') {
        const cached = loadCachedSession()
        if (cached && cached.user) {
          setUser(cached.user)
          setConnectionError(true)
        }
      }
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    // Note: User profile will be created on first login via syncUserProfile
    // User must be invited to an org or join via org code - no auto-org creation
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    clearCachedSession()
    setUser(null)
    setSession(null)
  }

  const value = {
    user,
    session,
    loading,
    connectionError,
    retrying,
    retryConnection,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

