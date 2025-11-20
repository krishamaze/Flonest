/**
 * AuthContext - React Query Implementation
 * 
 * This context maintains backward compatibility with the existing interface
 * while delegating all state management to React Query hooks.
 * 
 * ~70% code reduction achieved by removing manual caching, deduplication,
 * and race-condition handling (now handled by React Query).
 */

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserPasswordCheck } from '../hooks/useUserSecurity'
import { useSessionQuery, useAuthDataQuery, useAdminMfaRequirementQuery, useInvalidateAuth, type OrgMembershipSummary } from '../hooks/useAuthQuery'
import type { AuthUser } from '../types'
import {
  saveAgentContextMode,
  type AgentContextInfo,
} from '../lib/agentContext'

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

const ORG_CONTEXT_STORAGE_KEY = 'currentOrgId'
const SUPABASE_AUTH_HASH_KEYS = ['access_token', 'refresh_token', 'provider_token', 'expires_at', 'token_type', 'type']
const AUTH_HASH_EXCLUSION_PATHS = ['/reset-password']

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
}


function persistOrgId(orgId: string | null) {
  try {
    if (orgId) {
      localStorage.setItem(ORG_CONTEXT_STORAGE_KEY, orgId)
    } else {
      localStorage.removeItem(ORG_CONTEXT_STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage errors
  }
}

const persistServerOrgContext = async (orgId: string | null) => {
  try {
    await supabase.rpc('set_current_org_context', {
      p_org_id: orgId ?? undefined,
    })
  } catch (error) {
    console.error('[Auth] Error persisting org context server-side:', error)
  }
}

async function redirectUnregisteredUser(authUser: { email?: string | null }) {
  const email = authUser.email || ''
  const params = new URLSearchParams()
  if (email) {
    params.set('email', email)
  }
  const target = `/unregistered${params.toString() ? `?${params.toString()}` : ''}`

  if (window.location.pathname.startsWith('/unregistered')) {
    window.history.replaceState(null, '', target)
    return
  }

  window.location.href = target
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const invalidateAuth = useInvalidateAuth()
  const [isInitialized, setIsInitialized] = useState(false)

  // React Query hooks - all state management delegated here
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSessionQuery()
  const { data: authData, isLoading: authDataLoading, error: authDataError } = useAuthDataQuery(session || null)
  const { data: requiresAdminMfa = false } = useAdminMfaRequirementQuery(authData?.user ?? null)

  // When session is null, authData query is disabled, so provide default empty state
  const effectiveAuthData = useMemo(() => {
    if (!session?.user) {
      return {
        user: null,
        session: null,
        memberships: [],
        currentOrg: null,
        agentRelationships: [],
        currentAgentContext: null,
      }
    }
    return authData ?? {
      user: null,
      session: null,
      memberships: [],
      currentOrg: null,
      agentRelationships: [],
      currentAgentContext: null,
    }
  }, [session, authData])

  // Password check: using React Query for automatic caching and deduplication
  const passwordQuery = useUserPasswordCheck(
    effectiveAuthData.user?.id,
    !effectiveAuthData.user?.platformAdmin && !!effectiveAuthData.user
  )

  // Derive loading state
  const loading = !isInitialized || sessionLoading || authDataLoading

  // Derive connection error state
  const connectionError = useMemo(() => {
    if (sessionError || authDataError) {
      // Check for specific error types
      const error = authDataError || sessionError
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Don't treat "profile_not_found" as connection error (handled separately)
      if (errorMessage === 'profile_not_found' || errorMessage === 'profile_access_denied') {
        return false
      }
      return true
    }
    return false
  }, [sessionError, authDataError])

  // Handle profile_not_found error (unregistered user)
  useEffect(() => {
    if (authDataError) {
      const errorMessage = authDataError instanceof Error ? authDataError.message : String(authDataError)
      if (errorMessage === 'profile_not_found' && session?.user) {
        redirectUnregisteredUser(session.user)
      }
      if (errorMessage === 'profile_access_denied') {
        const target = '/login?error=profile_access_denied'
        if (window.location.pathname === '/login') {
          window.history.replaceState(null, '', target)
        } else {
          window.location.href = target
        }
      }
    }
  }, [authDataError, session])

  // Bridge onAuthStateChange to React Query
  // SECURITY: This bridge is critical - it synchronizes Supabase auth events with React Query cache
  // All auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, etc.) flow through here
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // DEBUG: Log auth events for debugging (console-only)
      if (import.meta.env.DEV) {
        console.log('[Auth Bridge] Event:', event, { hasSession: !!newSession, userId: newSession?.user?.id })
      }

      // Skip profile loading during password recovery flow
      const isRecoveryFlow = window.location.pathname === '/reset-password' &&
        (window.location.search.includes('type=recovery') || window.location.hash.includes('type=recovery'))

      if (isRecoveryFlow && (event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED')) {
        // During recovery, just update session query but don't load profile
        queryClient.setQueryData(['auth', 'session'], newSession)
        if (newSession?.user) {
          stripSupabaseAuthHash()
        }
        return
      }

      // Update session in React Query cache immediately
      // This ensures session state is always synchronized with Supabase auth
      queryClient.setQueryData(['auth', 'session'], newSession)
      
      if (!isInitialized) {
        setIsInitialized(true)
      }
      
      if (newSession?.user) {
        stripSupabaseAuthHash()
        
        // Invalidate auth data query to refetch profile/memberships
        // This handles: SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
        queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
        
        // Also invalidate admin MFA requirement query
        queryClient.invalidateQueries({ queryKey: ['auth', 'admin-mfa-requirement'] })
      } else {
        // Clear auth data when session is null
        // This handles: SIGNED_OUT, USER_DELETED
        // Remove all auth queries to ensure clean state
        queryClient.removeQueries({ queryKey: ['auth'] })
      }
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  // Retry connection handler (for backward compatibility)
  const retryConnection = async () => {
    await invalidateAuth()
  }

  // Sign in handler
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    // onAuthStateChange will handle invalidation
  }

  // Sign up handler
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    // Note: User profile will be created on first login via syncUserProfile
  }

  // Sign out handler
  const signOut = async () => {
    // Step 1: Clear local session immediately
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (localError) {
      console.warn('[Auth] Local sign out failed (continuing):', localError)
    } finally {
      // Clear React Query cache
      queryClient.setQueryData(['auth', 'session'], null)
      queryClient.setQueryData(['auth', 'data'], {
        user: null,
        session: null,
        memberships: [],
        currentOrg: null,
        agentRelationships: [],
        currentAgentContext: null,
      })
      persistOrgId(null)
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

  // Switch to org handler
  const switchToOrg = async (orgId: string, membershipOverride?: OrgMembershipSummary) => {
    const membership = membershipOverride ?? effectiveAuthData.memberships.find(m => m.orgId === orgId)
    if (!membership) {
      console.warn('[Auth] Attempted to switch to unknown org:', orgId)
      return
    }

    persistOrgId(membership.orgId)
    await persistServerOrgContext(membership.orgId)

    // Update React Query cache optimistically
    if (session?.user?.id) {
      queryClient.setQueryData(['auth', 'data', session.user.id], {
        ...effectiveAuthData,
        currentOrg: membership,
        user: effectiveAuthData.user
          ? {
              ...effectiveAuthData.user,
              orgId: membership.orgId,
              role: membership.role,
              contextMode: 'business',
              agentContext: undefined,
            }
          : null,
        currentAgentContext: null,
      })
    }

    saveAgentContextMode('business')
  }

  // Switch to agent context handler
  const switchToAgentContext = async (relationshipId: string) => {
    const relationship = effectiveAuthData.agentRelationships.find(r => r.relationshipId === relationshipId)
    if (!relationship) {
      console.warn('[Auth] Attempted to switch to unknown agent relationship:', relationshipId)
      return
    }

    saveAgentContextMode('agent', relationship.senderOrgId)

    // Update React Query cache optimistically
    if (session?.user?.id) {
      queryClient.setQueryData(['auth', 'data', session.user.id], {
        ...effectiveAuthData,
        currentAgentContext: relationship,
        user: effectiveAuthData.user
          ? {
              ...effectiveAuthData.user,
              contextMode: 'agent',
              agentContext: relationship,
            }
          : null,
      })
    }
  }

  // Switch to business mode handler
  const switchToBusinessMode = async () => {
    if (!effectiveAuthData.user) return
    const targetOrg = effectiveAuthData.currentOrg ?? effectiveAuthData.memberships[0] ?? null
    if (targetOrg) {
      await switchToOrg(targetOrg.orgId)
    } else {
      saveAgentContextMode('business')
      if (session?.user?.id) {
        queryClient.setQueryData(['auth', 'data', session.user.id], {
          ...effectiveAuthData,
          currentAgentContext: null,
          user: effectiveAuthData.user
            ? {
                ...effectiveAuthData.user,
                contextMode: 'business',
                agentContext: undefined,
              }
            : null,
        })
      }
    }
  }

  // Switch to agent mode handler
  const switchToAgentMode = async (senderOrgId: string) => {
    if (!effectiveAuthData.user) return
    const relationship = effectiveAuthData.agentRelationships.find(r => r.senderOrgId === senderOrgId)
    if (!relationship) {
      console.error('User does not have access to this sender org')
      return
    }
    await switchToAgentContext(relationship.relationshipId)
  }

  // Refresh memberships handler
  const refreshMemberships = async (): Promise<OrgMembershipSummary[]> => {
    if (!effectiveAuthData.user) return []

    // Invalidate and refetch auth data
    await queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
    
    // Wait for refetch to complete
    if (session?.user?.id) {
      await queryClient.refetchQueries({ queryKey: ['auth', 'data', session.user.id] })

      // Get updated data from cache
      const updatedData = queryClient.getQueryData(['auth', 'data', session.user.id]) as any
      return updatedData?.memberships ?? []
    }
    return []
  }

  // Refresh admin MFA requirement handler
  const refreshAdminMfaRequirement = async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'admin-mfa-requirement'] })
  }

  // Derive hasPassword and checkingPassword
  const hasPassword = useMemo(() => {
    if (!effectiveAuthData.user) return null
    return effectiveAuthData.user.platformAdmin ? true : passwordQuery.data ?? null
  }, [effectiveAuthData.user, passwordQuery.data])

  const checkingPassword = passwordQuery.isLoading

  // Build context value
  const value: AuthContextType = {
    user: effectiveAuthData.user,
    session: session ?? null,
    loading,
    connectionError,
    retrying: false, // React Query handles retries internally
    retryConnection,
    signIn,
    signUp,
    signOut,
    switchToBusinessMode,
    switchToAgentMode,
    requiresAdminMfa,
    refreshAdminMfaRequirement,
    memberships: effectiveAuthData.memberships,
    currentOrg: effectiveAuthData.currentOrg,
    switchToOrg,
    refreshMemberships,
    agentRelationships: effectiveAuthData.agentRelationships,
    currentAgentContext: effectiveAuthData.currentAgentContext,
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
