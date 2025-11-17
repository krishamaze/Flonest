import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { syncUserProfile } from '../lib/userSync'
import { useUserPasswordCheck } from '../hooks/useUserSecurity'
import type { AuthUser, Org, UserRole } from '../types'
import {
  getAgentRelationships,
  loadAgentContextMode,
  saveAgentContextMode,
  type AgentContextInfo,
} from '../lib/agentContext'

interface OrgMembershipSummary {
  membershipId: string
  orgId: string
  orgName: string
  slug: string
  stateName: Org['state']
  lifecycleState: Org['lifecycle_state']
  role: UserRole
  branchId: string | null
}

type OrgContextSummary = OrgMembershipSummary | null

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
  memberships: OrgMembershipSummary[]
  currentOrg: OrgContextSummary
  switchToOrg: (orgId: string, membershipOverride?: OrgMembershipSummary) => Promise<void>
  refreshMemberships: () => Promise<OrgMembershipSummary[]>
  agentRelationships: AgentContextInfo[]
  currentAgentContext: AgentContextInfo | null
  switchToAgentContext: (relationshipId: string) => Promise<void>
  hasPassword: boolean | null
  checkingPassword: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const CONNECTION_TIMEOUT = 5000 // 5 seconds
const CACHE_KEY = 'lastGoodSession'
const ORG_CONTEXT_STORAGE_KEY = 'currentOrgId'
const CLOCK_SKEW_THRESHOLD_MS = 5000
const SUPABASE_AUTH_HASH_KEYS = ['access_token', 'refresh_token', 'provider_token', 'expires_at', 'token_type', 'type']
const AUTH_HASH_EXCLUSION_PATHS = ['/reset-password']

function logSessionClockSkew(session: Session | null, source: string) {
  if (!session?.expires_at || typeof session.expires_in !== 'number') return
  const issuedAtMs = (session.expires_at - session.expires_in) * 1000
  const skewMs = issuedAtMs - Date.now()
  if (Math.abs(skewMs) >= CLOCK_SKEW_THRESHOLD_MS) {
    console.warn('[Auth Clock Skew]', {
      source,
      skewMs,
      issuedAt: new Date(issuedAtMs).toISOString(),
      now: new Date().toISOString(),
    })
  }
}

function stripSupabaseAuthHash() {
  if (typeof window === 'undefined') return
  if (AUTH_HASH_EXCLUSION_PATHS.some(path => window.location.pathname.startsWith(path))) {
    return
  }
  const hash = window.location.hash
  if (!hash || hash.length <= 1) return
  const params = new URLSearchParams(hash.slice(1))
  const hasAuthParams = SUPABASE_AUTH_HASH_KEYS.some(key => params.has(key))
  if (!hasAuthParams) return
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`
  window.history.replaceState(null, '', cleanUrl)
  console.info('[Auth] Cleared Supabase auth hash from URL to prevent reprocessing')
}

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

function loadPersistedOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_CONTEXT_STORAGE_KEY)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Auth] Failed to load persisted org context:', error)
    }
    return null
  }
}

function persistOrgId(orgId: string | null) {
  try {
    if (orgId) {
      localStorage.setItem(ORG_CONTEXT_STORAGE_KEY, orgId)
    } else {
      localStorage.removeItem(ORG_CONTEXT_STORAGE_KEY)
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Auth] Failed to persist org context:', error)
    }
  }
}

const persistServerOrgContext = async (orgId: string | null) => {
  try {
    const { error } = await supabase.rpc('set_current_org_context', {
      p_org_id: orgId,
    })
    if (error) {
      console.error('[Auth] Failed to persist org context server-side:', error)
    }
  } catch (error) {
    console.error('[Auth] Error persisting org context server-side:', error)
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
  const [memberships, setMemberships] = useState<OrgMembershipSummary[]>([])
  const [currentOrg, setCurrentOrg] = useState<OrgContextSummary>(null)
  const [agentRelationships, setAgentRelationships] = useState<AgentContextInfo[]>([])
  const [currentAgentContext, setCurrentAgentContext] = useState<AgentContextInfo | null>(null)
  
  // Request deduplication: prevent concurrent profile/membership loads
  const [profileLoading, setProfileLoading] = useState(false)
  const profileLoadPromiseRef = useRef<Promise<void> | null>(null)
  
  // Password check: using React Query for automatic caching and deduplication
  const passwordQuery = useUserPasswordCheck(
    user?.id,
    !user?.platformAdmin && !!user // Only check for non-platform-admin users
  )
  
  // Derive hasPassword and checkingPassword from React Query state
  const hasPassword = user?.platformAdmin ? true : passwordQuery.data ?? null
  const checkingPassword = passwordQuery.isLoading

  useEffect(() => {
    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logSessionClockSkew(session, `auth-event:${event}`)

      // Skip profile loading during password recovery flow
      // The recovery token creates a temporary session, but we don't want to redirect
      const isRecoveryFlow = window.location.pathname === '/reset-password' && 
        (window.location.search.includes('type=recovery') || window.location.hash.includes('type=recovery'))
      
      if (isRecoveryFlow && (event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED')) {
        // During recovery, just set the session but don't load profile
        // This prevents auto-redirect away from reset password page
        setSession(session)
        if (session?.user) {
          stripSupabaseAuthHash()
        }
        return
      }

      setSession(session)
      if (session?.user) {
        stripSupabaseAuthHash()
      }
      if (session?.user) {
        // Deduplicate: if already loading, wait for existing promise
        if (profileLoadPromiseRef.current) {
          // Profile already loading, wait for it
          profileLoadPromiseRef.current.catch(() => {
            // If previous load failed, try again
            loadUserProfile(session.user, false)
          })
        } else {
          loadUserProfile(session.user, false)
        }
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
      logSessionClockSkew(session, 'initializeAuth')
      if (session?.user) {
        stripSupabaseAuthHash()
      }
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
        logSessionClockSkew(cached.session, 'initializeAuth-cache')
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
        logSessionClockSkew(session, 'background-reconnect')
        stripSupabaseAuthHash()
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

  const finalizeUser = async (
    userData: AuthUser,
    options?: {
      orgMemberships?: OrgMembershipSummary[]
      selectedOrg?: OrgMembershipSummary | null
      agentCtxList?: AgentContextInfo[]
      selectedAgentCtx?: AgentContextInfo | null
    }
  ) => {
    setUser(userData)
    setConnectionError(false)

    if (options) {
      if (options.orgMemberships) {
        setMemberships(options.orgMemberships)
      } else {
        setMemberships([])
      }

      if (options.selectedOrg) {
        setCurrentOrg(options.selectedOrg)
        persistOrgId(options.selectedOrg.orgId)
      } else {
        setCurrentOrg(null)
        persistOrgId(null)
      }

      if (options.agentCtxList) {
        setAgentRelationships(options.agentCtxList)
      } else {
        setAgentRelationships([])
      }

      if (options.selectedAgentCtx) {
        setCurrentAgentContext(options.selectedAgentCtx)
        saveAgentContextMode('agent', options.selectedAgentCtx.senderOrgId)
      } else {
        setCurrentAgentContext(null)
        saveAgentContextMode('business')
      }
    } else {
      setMemberships([])
      setCurrentOrg(null)
      persistOrgId(null)
      setAgentRelationships([])
      setCurrentAgentContext(null)
      saveAgentContextMode('business')
    }

    await persistServerOrgContext(options?.selectedOrg?.orgId ?? null)

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
      logSessionClockSkew(session, 'retryConnection')
      if (session?.user) {
        stripSupabaseAuthHash()
      }
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
        logSessionClockSkew(cached.session, 'retryConnection-cache')
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
    // Deduplication: if already loading, return existing promise
    if (profileLoading && profileLoadPromiseRef.current) {
      return profileLoadPromiseRef.current
    }
    
    setProfileLoading(true)
    const loadPromise = (async () => {
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
            const membershipSummary: OrgMembershipSummary = {
              membershipId: syncedData.membership.id,
              orgId: syncedData.org.id,
              orgName: syncedData.org.name,
              slug: syncedData.org.slug,
              stateName: syncedData.org.state,
              lifecycleState: syncedData.org.lifecycle_state,
              role: (syncedData.membership.role || 'advisor') as UserRole,
              branchId: (syncedData.membership as any).branch_id || null,
            }
            const userData = {
              id: syncedProfile.id,
              email: syncedProfile.email,
              orgId: membershipSummary.orgId,
              role: membershipSummary.role,
              branchId: membershipSummary.branchId,
              platformAdmin: false,
              contextMode: 'business' as const,
            }
            await finalizeUser(userData, {
              orgMemberships: [membershipSummary],
              selectedOrg: membershipSummary,
              agentCtxList: [],
              selectedAgentCtx: null,
            })
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
          await finalizeUser(userData, {
            orgMemberships: [],
            selectedOrg: null,
            agentCtxList: [],
            selectedAgentCtx: null,
          })
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

      // For non-platform-admin users, load memberships (including branch_id)
      let membershipsResult
      if (useTimeout) {
        const queryPromise = supabase
          .from('memberships')
          .select('id, role, branch_id, orgs!inner(id, name, slug, state, lifecycle_state)')
          .eq('profile_id', authUser.id)
          .eq('membership_status', 'active')
          .order('created_at', { ascending: true })
        const timeoutPromise = createTimeoutPromise(CONNECTION_TIMEOUT)
        membershipsResult = await Promise.race([queryPromise, timeoutPromise])
      } else {
        membershipsResult = await supabase
          .from('memberships')
          .select('id, role, branch_id, orgs!inner(id, name, slug, state, lifecycle_state)')
          .eq('profile_id', authUser.id)
          .eq('membership_status', 'active')
          .order('created_at', { ascending: true })
      }

      const { data: membershipsData, error } = membershipsResult as {
        data: any[] | null
        error: any
      }

      if (error) throw error

      const membershipSummaries: OrgMembershipSummary[] =
        membershipsData?.map(member => {
          const orgRecord = member.orgs as Org
          return {
            membershipId: member.id,
            orgId: orgRecord.id,
            orgName: orgRecord.name,
            slug: orgRecord.slug,
            stateName: orgRecord.state,
            lifecycleState: orgRecord.lifecycle_state,
            role: (member.role || 'advisor') as UserRole,
            branchId: member.branch_id,
          }
        }) ?? []

      const persistedOrgId = loadPersistedOrgId()
      let selectedOrgSummary: OrgMembershipSummary | null =
        (persistedOrgId ? membershipSummaries.find(m => m.orgId === persistedOrgId) : null) ??
        membershipSummaries[0] ??
        null

      const agentMode = loadAgentContextMode()
      const agentRelationshipResults = await getAgentRelationships(authUser.id)
      const agentContextList: AgentContextInfo[] = agentRelationshipResults.map(rel => ({
        senderOrgId: rel.senderOrg.id,
        senderOrgName: rel.senderOrg.name,
        relationshipId: rel.relationship.id,
        canManage: rel.canManage,
      }))
      let selectedAgentCtx: AgentContextInfo | null = null
      if (agentMode.mode === 'agent' && agentMode.senderOrgId) {
        selectedAgentCtx =
          agentContextList.find(ctx => ctx.senderOrgId === agentMode.senderOrgId) ?? null
      }

      const userData: AuthUser = {
        id: profile.id,
        email: profile.email,
        orgId: selectedOrgSummary?.orgId ?? null,
        role: selectedOrgSummary?.role ?? null,
        branchId: selectedOrgSummary?.branchId ?? null,
        platformAdmin: false,
        contextMode: selectedAgentCtx ? 'agent' : 'business',
        agentContext: selectedAgentCtx ?? undefined,
      }

      await finalizeUser(userData, {
        orgMemberships: membershipSummaries,
        selectedOrg: selectedOrgSummary,
        agentCtxList: agentContextList,
        selectedAgentCtx,
      })
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
      setProfileLoading(false)
      profileLoadPromiseRef.current = null
    }
    })()
    
    profileLoadPromiseRef.current = loadPromise
    return loadPromise
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
        setMemberships([])
        setCurrentOrg(null)
        persistOrgId(null)
        setAgentRelationships([])
        setCurrentAgentContext(null)
        saveAgentContextMode('business')
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

  const switchToOrg = async (orgId: string, membershipOverride?: OrgMembershipSummary) => {
    const membership = membershipOverride ?? memberships.find(m => m.orgId === orgId)
    if (!membership) {
      console.warn('[Auth] Attempted to switch to unknown org:', orgId)
      return
    }

    persistOrgId(membership.orgId)
    setCurrentOrg(membership)
    saveAgentContextMode('business')
    setCurrentAgentContext(null)
    await persistServerOrgContext(membership.orgId)

    setUser(prev =>
      prev
        ? {
            ...prev,
            orgId: membership.orgId,
            role: membership.role,
            contextMode: 'business',
            agentContext: undefined,
          }
        : prev
    )
  }

  const switchToAgentContext = async (relationshipId: string) => {
    const relationship = agentRelationships.find(r => r.relationshipId === relationshipId)
    if (!relationship) {
      console.warn('[Auth] Attempted to switch to unknown agent relationship:', relationshipId)
      return
    }

    saveAgentContextMode('agent', relationship.senderOrgId)
    setCurrentAgentContext(relationship)

    setUser(prev =>
      prev
        ? {
            ...prev,
            contextMode: 'agent',
            agentContext: relationship,
          }
        : prev
    )
  }

  const switchToBusinessMode = async () => {
    if (!user) return
    const targetOrg = currentOrg ?? memberships[0] ?? null
    if (targetOrg) {
      await switchToOrg(targetOrg.orgId)
    } else {
      saveAgentContextMode('business')
      setCurrentAgentContext(null)
      setUser({
        ...user,
        contextMode: 'business',
        agentContext: undefined,
      })
    }
  }

  const switchToAgentMode = async (senderOrgId: string) => {
    if (!user) return
    const relationship = agentRelationships.find(r => r.senderOrgId === senderOrgId)
    if (!relationship) {
      console.error('User does not have access to this sender org')
      return
    }
    await switchToAgentContext(relationship.relationshipId)
  }

  const refreshMemberships = async () => {
    if (!user) return []
    const { data, error } = await supabase
      .from('memberships')
      .select('id, role, branch_id, orgs!inner(id, name, slug, state, lifecycle_state)')
      .eq('profile_id', user.id)
      .eq('membership_status', 'active')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Auth] Failed to refresh memberships:', error)
      return []
    }

    const summaries =
      data?.map(member => ({
        membershipId: member.id,
        orgId: (member.orgs as Org).id,
        orgName: (member.orgs as Org).name,
        slug: (member.orgs as Org).slug,
        stateName: (member.orgs as Org).state,
        lifecycleState: (member.orgs as Org).lifecycle_state,
        role: (member.role || 'advisor') as UserRole,
        branchId: member.branch_id,
      })) ?? []

    setMemberships(summaries)

    if (summaries.length === 0) {
      setCurrentOrg(null)
      persistOrgId(null)
      await persistServerOrgContext(null)
      setUser(prev =>
        prev
          ? {
              ...prev,
              orgId: null,
              role: null,
            }
          : prev
      )
      return summaries
    }

    const existingOrgId = currentOrg?.orgId ?? loadPersistedOrgId()
    const nextOrg =
      (existingOrgId ? summaries.find(m => m.orgId === existingOrgId) : null) ?? summaries[0]

    persistOrgId(nextOrg.orgId)
    setCurrentOrg(nextOrg)
    await persistServerOrgContext(nextOrg.orgId)
    setUser(prev =>
      prev
        ? {
            ...prev,
            orgId: nextOrg.orgId,
            role: nextOrg.role,
          }
        : prev
    )
    return summaries
  }

  const refreshAdminMfaRequirement = async () => {
    if (!user) {
      setRequiresAdminMfa(false)
      return
    }
    await evaluatePlatformAdminMfa(user.platformAdmin)
  }

  const value: AuthContextType = {
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
    memberships,
    currentOrg,
    switchToOrg,
    refreshMemberships,
    agentRelationships,
    currentAgentContext,
    switchToAgentContext,
    hasPassword,
    checkingPassword,
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

