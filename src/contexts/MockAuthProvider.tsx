/**
 * MockAuthProvider - Standalone Auth Provider for Playwright Testing
 * 
 * When VITE_USE_MOCK=true, this replaces the real AuthProvider.
 * Uses deterministic mock users, no Supabase connection required.
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AuthUser } from '../types'
import type { OrgMembershipSummary } from '../hooks/useAuthQuery'
import type { AgentContextInfo } from '../lib/agentContext'
import {
  MOCK_ENABLED,
  getMockSession,
  getMockAuthUser,
  createMockSupabaseSession,
  mockSignIn,
  mockSignOut,
  getMockMembership,
} from '../lib/mockAuth'

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
  currentOrg: OrgMembershipSummary | null
  switchToOrg: (orgId: string, membershipOverride?: OrgMembershipSummary) => Promise<void>
  refreshMemberships: () => Promise<OrgMembershipSummary[]>
  agentRelationships: AgentContextInfo[]
  currentAgentContext: AgentContextInfo | null
  switchToAgentContext: (relationshipId: string) => Promise<void>
  hasPassword: boolean | null
  checkingPassword: boolean
}

const MockAuthContext = createContext<AuthContextType | undefined>(undefined)

export function useMockAuth() {
  const context = useContext(MockAuthContext)
  if (!context) {
    throw new Error('useMockAuth must be used within MockAuthProvider')
  }
  return context
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<OrgMembershipSummary[]>([])
  const [currentOrg, setCurrentOrg] = useState<OrgMembershipSummary | null>(null)

  // Check for existing mock session on mount
  useEffect(() => {
    const existing = getMockSession()
    if (existing) {
      const authUser = getMockAuthUser(existing.email)
      if (authUser) {
        setUser(authUser)
        setSession(createMockSupabaseSession(existing.email))
        // Set mock membership for non-platform-admin users
        const membership = getMockMembership(existing.email)
        if (membership) {
          setMemberships([membership])
          setCurrentOrg(membership)
        }
      }
    }
    setLoading(false)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await mockSignIn(email, password)
    if (error) throw error

    const authUser = getMockAuthUser(email)
    if (!authUser) throw new Error('Failed to create mock user')

    setUser(authUser)
    setSession(createMockSupabaseSession(email))

    // Set mock membership for non-platform-admin users
    const membership = getMockMembership(email)
    if (membership) {
      setMemberships([membership])
      setCurrentOrg(membership)
    }
  }, [])

  const signOut = useCallback(async () => {
    await mockSignOut()
    setUser(null)
    setSession(null)
    setMemberships([])
    setCurrentOrg(null)
  }, [])

  // No-op stubs for unused functionality in mock mode
  const noop = useCallback(async () => {}, [])
  const noopMemberships = useCallback(async () => [], [])

  const value: AuthContextType = {
    user,
    session,
    loading,
    connectionError: false,
    retrying: false,
    retryConnection: noop,
    signIn,
    signUp: noop,
    signOut,
    switchToBusinessMode: noop,
    switchToAgentMode: noop,
    requiresAdminMfa: false,
    refreshAdminMfaRequirement: noop,
    memberships,
    currentOrg,
    switchToOrg: noop,
    refreshMemberships: noopMemberships,
    agentRelationships: [],
    currentAgentContext: null,
    switchToAgentContext: noop,
    hasPassword: true,
    checkingPassword: false,
  }

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>
}

export { MOCK_ENABLED }

