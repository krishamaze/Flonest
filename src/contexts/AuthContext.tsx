import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { syncUserProfile } from '../lib/userSync'
import type { AuthUser, UserRole } from '../types'

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
  switchToBusinessMode: () => Promise<void>
  switchToAgentMode: (senderOrgId: string) => Promise<void>
  requiresAdminMfa: boolean
  refreshAdminMfaRequirement: () => Promise<void>
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

async function redirectUnregisteredUser(authUser: User) {
  const email = authUser.email || ''
  const params = new URLSearchParams()
  if (email) {
    params.set('email', email)
  }
  const target = `/unregistered${params.toString() ? `?${params.toString()}` : ''}`

  // Avoid full reload loops: if we're already on /unregistered, just update the URL
  // without reloading so the component can pick up the latest email.
  if (window.location.pathname.startsWith('/unregistered')) {
    window.history.replaceState(null, '', target)
    return
  }

  window.location.href = target
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [requiresAdminMfa, setRequiresAdminMfa] = useState(false)

  useEffect(() => {
    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip profile loading during password recovery flow
      // The recovery token creates a temporary session, but we don't want to redirect
      const isRecoveryFlow = window.location.pathname === '/reset-password' && 
        (window.location.search.includes('type=recovery') || window.location.hash.includes('type=recovery'))
      
      if (isRecoveryFlow && (event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED')) {
        // During recovery, just set the session but don't load profile
        // This prevents auto-redirect away from reset password page
        setSession(session)
        return
      }

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
      // CRITICAL: getSession() automatically processes OAuth callbacks from URL hash
      // when detectSessionInUrl: true is set. This must be called to trigger processing.
      // The client processes the URL hash and stores the session automatically.
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
            if (cached.user.platformAdmin) {
              setRequiresAdminMfa(true)
            }
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
        if (cached.user.platformAdmin) {
          setRequiresAdminMfa(true)
        }
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

  const evaluatePlatformAdminMfa = async (platformAdmin: boolean) => {
    if (!platformAdmin) {
      setRequiresAdminMfa(false)
      return
    }

    try {
      // AAL is the source of truth: ONLY aal2 allows access
      // If AAL check fails or returns aal1, require MFA
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      
      if (!aalError && aalData?.currentLevel === 'aal2') {
        // Session has aal2 - MFA is satisfied
        setRequiresAdminMfa(false)
        return
      }

      // AAL is not aal2 (or check failed) - ALWAYS require MFA
      // This is the security gate: no aal2 = no access
      if (aalError) {
        console.warn('[Auth] Unable to load AAL status, requiring MFA:', aalError)
      } else {
        console.log('[Auth] AAL level:', aalData?.currentLevel, '- requiring MFA for aal2')
      }

      setRequiresAdminMfa(true)
    } catch (err) {
      console.warn('[Auth] Error evaluating admin MFA status, requiring MFA:', err)
      // On any error, require MFA (fail secure)
      setRequiresAdminMfa(true)
    }
  }

  const finalizeUser = async (userData: AuthUser) => {
    setUser(userData)
    setConnectionError(false)
    const currentSession = await supabase.auth.getSession().then(({ data }) => data.session)
    saveCachedSession(currentSession, userData)
    await evaluatePlatformAdminMfa(userData.platformAdmin)
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
        if (cached.user.platformAdmin) {
          setRequiresAdminMfa(true)
        }
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
          .select('id, email, platform_admin')
          .eq('id', authUser.id)
          .maybeSingle()
        const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
        profileQuery = await Promise.race([queryPromise, timeoutPromise])
      } else {
        profileQuery = await supabase
          .from('profiles')
          .select('id, email, platform_admin')
          .eq('id', authUser.id)
          .maybeSingle()
      }

      const { data: profile, error: profileError } = profileQuery as {
        data: any | null
        error: any
      }

      if (profileError) {
        // Security-first handling: permission errors indicate misconfiguration, not unregistered status.
        if (profileError.code === '42501') {
          console.error('[Auth] Permission denied when reading profiles. This is a configuration/security error.', profileError)
          // Fail closed: clear any cached session and force re-auth on login page
          clearCachedSession()
          const target = '/login?error=profile_access_denied'

          // If we're already on /login, just replace the URL so the login page
          // can pick up the error param without triggering another full reload.
          if (window.location.pathname === '/login') {
            window.history.replaceState(null, '', target)
          } else {
            window.location.href = target
          }
          return
        }

        throw profileError
      }

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
          const platformAdmin = syncedProfile.platform_admin || false

          // Short-circuit for platform admin users - skip membership entirely
          if (platformAdmin) {
            const userData = {
              id: syncedProfile.id,
              email: syncedProfile.email,
              orgId: null,
              role: null,
              branchId: null,
              platformAdmin: true,
              contextMode: 'business' as const,
            }
            await finalizeUser(userData)
            return
          }

          // For non-platform-admin users, check if they have org/membership
          if (syncedData.membership && syncedData.org) {
            const userData = {
              id: syncedProfile.id,
              email: syncedProfile.email,
              orgId: syncedData.org.id,
              role: (syncedData.membership.role || 'advisor') as UserRole,
              branchId: (syncedData.membership as any).branch_id || null,
              platformAdmin: false,
              contextMode: 'business' as const,
            }
            await finalizeUser(userData)
            return
          }

          // Non-platform-admin user with no org
          const userData = {
            id: syncedProfile.id,
            email: syncedProfile.email,
            orgId: null,
            role: null,
            branchId: null,
            platformAdmin: false,
            contextMode: 'business' as const,
          }
          await finalizeUser(userData)
          return
        } else {
          console.error('Failed to sync user profile - no profile found')
          await redirectUnregisteredUser(authUser)
          return
        }
      }

      // Profile exists - check if platform admin
      const platformAdmin = profile.platform_admin || false

      // Short-circuit for platform admin users - skip membership query entirely
      if (platformAdmin) {
        const userData = {
          id: profile.id,
          email: profile.email,
          orgId: null,
          role: null,
          branchId: null,
          platformAdmin: true,
          contextMode: 'business' as const,
        }
        await finalizeUser(userData)
        return
      }

      // For non-platform-admin users, load membership (including branch_id)
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
          role: (membership.role || 'advisor') as UserRole,
          branchId: (membership as any).branch_id || null,
          platformAdmin: membershipProfile.platform_admin || false,
          contextMode: 'business' as const,
        }
        await finalizeUser(userData)
      } else {
        // Non-platform-admin user with no membership - try auto-creating org
        let finalUserData: AuthUser = {
          id: profile.id,
          email: profile.email,
          orgId: null,
          role: null,
          branchId: null,
          platformAdmin: false,
          contextMode: 'business' as const,
        }

        // Auto-create org for new users (non-platform-admin only)
        if (!profile.platform_admin) {
          try {
            if (import.meta.env.DEV) {
              console.log('[Auth] No membership found, attempting auto-org creation...')
            }

            const { data: orgResult, error: orgError } = await supabase.rpc('create_default_org_for_user' as any)

            if (orgError) {
              if (import.meta.env.DEV) {
                console.warn('[Auth] Auto-org creation failed:', orgError)
              }
              // Continue with null orgId - user can create manually later
            } else if (orgResult) {
              if (import.meta.env.DEV) {
                console.log('[Auth] Auto-org created successfully:', orgResult)
              }

              // Reload membership to get fresh data with org and role
              const { data: newMembershipResult, error: membershipReloadError } = await supabase
                .from('memberships')
                .select('*, profiles(*), orgs(*)')
                .eq('profile_id', authUser.id)
                .eq('membership_status', 'active')
                .maybeSingle()

              if (!membershipReloadError && newMembershipResult) {
                const newMembership = newMembershipResult as any
                const newMembershipProfile = newMembership.profiles as any
                const newOrg = newMembership.orgs as any

                finalUserData = {
                  id: newMembershipProfile.id,
                  email: newMembershipProfile.email,
                  orgId: newOrg.id,
                  role: (newMembership.role || 'org_owner') as UserRole,
                  branchId: newMembership.branch_id || null,
                  platformAdmin: newMembershipProfile.platform_admin || false,
                  contextMode: 'business' as const,
                }

                if (import.meta.env.DEV) {
                  console.log('[Auth] User profile updated with new org:', finalUserData)
                }
              }
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('[Auth] Auto-org creation error:', error)
            }
            // Continue with null orgId - user can create manually later
          }
        }

        await finalizeUser(finalUserData)
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
          if (cached.user.platformAdmin) {
            setRequiresAdminMfa(true)
          }
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
    // Step 1: Clear local session immediately (fast, no network)
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (localError) {
      console.warn('[Auth] Local sign out failed (continuing):', localError)
    } finally {
      clearCachedSession()
      setUser(null)
      setSession(null)
      setRequiresAdminMfa(false)
    }

    // Step 2: Attempt global sign out with timeout (best-effort)
    const GLOBAL_SIGN_OUT_TIMEOUT_MS = 5000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Global sign out timeout')), GLOBAL_SIGN_OUT_TIMEOUT_MS)
    })

    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }),
        timeoutPromise,
      ])
    } catch (globalError) {
      console.warn('[Auth] Global sign out failed or timed out (continuing):', globalError)
    }
  }

  const switchToBusinessMode = async () => {
    if (!user) return

    const { saveAgentContextMode } = await import('../lib/agentContext')
    saveAgentContextMode('business')

    setUser({
      ...user,
      contextMode: 'business',
      agentContext: undefined,
    })
  }

  const switchToAgentMode = async (senderOrgId: string) => {
    if (!user) return

    const { getAgentContextForOrg, saveAgentContextMode } = await import('../lib/agentContext')
    const agentContext = await getAgentContextForOrg(user.id, senderOrgId)

    if (!agentContext) {
      console.error('User does not have access to this sender org')
      return
    }

    saveAgentContextMode('agent', senderOrgId)

    setUser({
      ...user,
      contextMode: 'agent',
      agentContext,
    })
  }

  const refreshAdminMfaRequirement = async () => {
    if (!user) {
      setRequiresAdminMfa(false)
      return
    }
    await evaluatePlatformAdminMfa(user.platformAdmin)
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
    switchToBusinessMode,
    switchToAgentMode,
    requiresAdminMfa,
    refreshAdminMfaRequirement,
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

