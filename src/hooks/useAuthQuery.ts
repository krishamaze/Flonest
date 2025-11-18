/**
 * React Query hooks for authentication state
 * 
 * These hooks replace manual state management in AuthContext, delegating
 * caching, deduplication, and race-condition handling to React Query.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { syncUserProfile } from '../lib/userSync'
import { getAgentRelationships, loadAgentContextMode, type AgentContextInfo } from '../lib/agentContext'
import type { AuthUser, Org, UserRole } from '../types'

export interface OrgMembershipSummary {
  membershipId: string
  orgId: string
  orgName: string
  slug: string
  stateName: Org['state']
  lifecycleState: Org['lifecycle_state']
  role: UserRole
  branchId: string | null
}

interface AuthData {
  user: AuthUser | null
  session: Session | null
  memberships: OrgMembershipSummary[]
  currentOrg: OrgMembershipSummary | null
  agentRelationships: AgentContextInfo[]
  currentAgentContext: AgentContextInfo | null
}

const ORG_CONTEXT_STORAGE_KEY = 'currentOrgId'

function loadPersistedOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_CONTEXT_STORAGE_KEY)
  } catch {
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

/**
 * Query hook for Supabase session
 */
export const useSessionQuery = () => {
  return useQuery<Session | null>({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
    staleTime: 0, // Always fetch fresh session
    refetchOnWindowFocus: true,
    retry: false, // Don't retry session fetches
  })
}

/**
 * Query hook for user profile and related data
 * Handles profile loading, memberships, and agent relationships
 */
export const useAuthDataQuery = (session: Session | null) => {
  return useQuery<AuthData>({
    queryKey: ['auth', 'data', session?.user?.id],
    queryFn: async (): Promise<AuthData> => {
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

      const authUser = session.user

      // Load profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, platform_admin')
        .eq('id', authUser.id)
        .maybeSingle()

      if (profileError) {
        // Security-first handling: permission errors indicate misconfiguration
        if (profileError.code === '42501') {
          console.error('[Auth] Permission denied when reading profiles. This is a configuration/security error.', profileError)
          throw new Error('profile_access_denied')
        }
        throw profileError
      }

      // If profile doesn't exist, sync it first
      if (!profile) {
        const syncedData = await syncUserProfile(authUser)
        if (!syncedData || !syncedData.profile) {
          // User needs to register - redirect handled by caller
          throw new Error('profile_not_found')
        }
        // Use synced profile
        const syncedProfile = syncedData.profile
        const platformAdmin = syncedProfile.platform_admin || false

        // Short-circuit for platform admin users
        if (platformAdmin) {
          const userData: AuthUser = {
            id: syncedProfile.id,
            email: syncedProfile.email,
            orgId: null,
            role: null,
            branchId: null,
            platformAdmin: true,
            contextMode: 'business',
          }
          return {
            user: userData,
            session,
            memberships: [],
            currentOrg: null,
            agentRelationships: [],
            currentAgentContext: null,
          }
        }

        // For non-platform-admin users with membership from sync
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
          const userData: AuthUser = {
            id: syncedProfile.id,
            email: syncedProfile.email,
            orgId: membershipSummary.orgId,
            role: membershipSummary.role,
            branchId: membershipSummary.branchId,
            platformAdmin: false,
            contextMode: 'business',
          }
          await persistOrgId(membershipSummary.orgId)
          await persistServerOrgContext(membershipSummary.orgId)
          return {
            user: userData,
            session,
            memberships: [membershipSummary],
            currentOrg: membershipSummary,
            agentRelationships: [],
            currentAgentContext: null,
          }
        }

        // Non-platform-admin user with no org
        const userData: AuthUser = {
          id: syncedProfile.id,
          email: syncedProfile.email,
          orgId: null,
          role: null,
          branchId: null,
          platformAdmin: false,
          contextMode: 'business',
        }
        return {
          user: userData,
          session,
          memberships: [],
          currentOrg: null,
          agentRelationships: [],
          currentAgentContext: null,
        }
      }

      // Profile exists - check if platform admin
      const platformAdmin = profile.platform_admin || false

      // Short-circuit for platform admin users
      if (platformAdmin) {
        const userData: AuthUser = {
          id: profile.id,
          email: profile.email,
          orgId: null,
          role: null,
          branchId: null,
          platformAdmin: true,
          contextMode: 'business',
        }
        return {
          user: userData,
          session,
          memberships: [],
          currentOrg: null,
          agentRelationships: [],
          currentAgentContext: null,
        }
      }

      // For non-platform-admin users, load memberships
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('memberships')
        .select('id, role, branch_id, orgs!inner(id, name, slug, state, lifecycle_state)')
        .eq('profile_id', authUser.id)
        .eq('membership_status', 'active')
        .order('created_at', { ascending: true })

      if (membershipsError) throw membershipsError

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
      const selectedOrgSummary: OrgMembershipSummary | null =
        (persistedOrgId ? membershipSummaries.find(m => m.orgId === persistedOrgId) : null) ??
        membershipSummaries[0] ??
        null

      // Load agent relationships
      const agentRelationshipResults = await getAgentRelationships(authUser.id)
      const agentContextList: AgentContextInfo[] = agentRelationshipResults.map(rel => ({
        senderOrgId: rel.senderOrg.id,
        senderOrgName: rel.senderOrg.name,
        relationshipId: rel.relationship.id,
        canManage: rel.canManage,
      }))

      const agentMode = loadAgentContextMode()
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

      if (selectedOrgSummary) {
        await persistOrgId(selectedOrgSummary.orgId)
        await persistServerOrgContext(selectedOrgSummary.orgId)
      }

      return {
        user: userData,
        session,
        memberships: membershipSummaries,
        currentOrg: selectedOrgSummary,
        agentRelationships: agentContextList,
        currentAgentContext: selectedAgentCtx,
      }
    },
    enabled: !!session?.user,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on failure
  })
}

/**
 * Query hook for admin MFA requirement
 */
export const useAdminMfaRequirementQuery = (user: AuthUser | null) => {
  return useQuery<boolean>({
    queryKey: ['auth', 'admin-mfa-requirement', user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.platformAdmin) {
        return false
      }

      try {
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        
        if (!aalError && aalData?.currentLevel === 'aal2') {
          return false // MFA satisfied
        }

        // AAL is not aal2 (or check failed) - require MFA
        if (aalError) {
          console.warn('[Auth] Unable to load AAL status, requiring MFA:', aalError)
        }
        return true
      } catch (err) {
        console.warn('[Auth] Error evaluating admin MFA status, requiring MFA:', err)
        return true // Fail secure
      }
    },
    enabled: !!user?.platformAdmin,
    staleTime: 0, // Always check fresh
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/**
 * Helper to invalidate all auth queries
 */
export const useInvalidateAuth = () => {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['auth'] })
  }
}

