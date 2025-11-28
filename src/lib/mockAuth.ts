/**
 * Mock Auth Layer for Playwright Testing
 *
 * When VITE_USE_MOCK=true, this module intercepts auth calls
 * and returns deterministic test users based on email.
 */

import type { AuthUser, UserRole } from '../types'
import type { Session, User } from '@supabase/supabase-js'
import type { OrgMembershipSummary } from '../hooks/useAuthQuery'

export const MOCK_ENABLED = import.meta.env.VITE_USE_MOCK === 'true'

// Debug logging
console.log('[mockAuth] VITE_USE_MOCK raw value:', import.meta.env.VITE_USE_MOCK)
console.log('[mockAuth] MOCK_ENABLED:', MOCK_ENABLED)

// Mock user definitions by email
const MOCK_USERS: Record<string, { role: UserRole | null; platformAdmin: boolean; orgId: string | null; branchId: string | null }> = {
  'owner@test.com': { role: 'org_owner', platformAdmin: false, orgId: 'mock-org-1', branchId: null },
  'branch@test.com': { role: 'branch_head', platformAdmin: false, orgId: 'mock-org-1', branchId: 'mock-branch-1' },
  'advisor@test.com': { role: 'advisor', platformAdmin: false, orgId: 'mock-org-1', branchId: 'mock-branch-1' },
  'agent@test.com': { role: 'agent', platformAdmin: false, orgId: 'mock-org-1', branchId: 'mock-branch-1' },
  'internal@test.com': { role: null, platformAdmin: true, orgId: null, branchId: null },
}

// Storage key for mock session
const MOCK_SESSION_KEY = 'mock_auth_session'

export interface MockSession {
  email: string
  userId: string
}

function generateMockUserId(email: string): string {
  // Deterministic ID based on email
  return `mock-${email.replace(/[^a-z0-9]/gi, '-')}`
}

export function getMockSession(): MockSession | null {
  if (!MOCK_ENABLED) return null
  const stored = localStorage.getItem(MOCK_SESSION_KEY)
  return stored ? JSON.parse(stored) : null
}

export function setMockSession(email: string): void {
  const session: MockSession = {
    email,
    userId: generateMockUserId(email),
  }
  localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session))
}

export function clearMockSession(): void {
  localStorage.removeItem(MOCK_SESSION_KEY)
}

export function getMockAuthUser(email: string): AuthUser | null {
  const config = MOCK_USERS[email.toLowerCase()]
  if (!config) {
    console.warn(`[MockAuth] Unknown test user: ${email}`)
    return null
  }

  return {
    id: generateMockUserId(email),
    email,
    orgId: config.orgId,
    role: config.role,
    branchId: config.branchId,
    platformAdmin: config.platformAdmin,
    contextMode: 'business',
  }
}

export function createMockSupabaseSession(email: string): Session {
  const userId = generateMockUserId(email)
  const mockUser: User = {
    id: userId,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  }

  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: mockUser,
  }
}

/**
 * Mock sign-in: validates email is in test user list, stores session
 */
export async function mockSignIn(email: string, _password: string): Promise<{ error: Error | null }> {
  const lowerEmail = email.toLowerCase()
  if (!MOCK_USERS[lowerEmail]) {
    return { error: new Error(`Unknown test user: ${email}. Use one of: ${Object.keys(MOCK_USERS).join(', ')}`) }
  }
  setMockSession(lowerEmail)
  return { error: null }
}

/**
 * Mock sign-out: clears session
 */
export async function mockSignOut(): Promise<void> {
  clearMockSession()
}

/**
 * Check if mock mode is active
 */
export function isMockMode(): boolean {
  return MOCK_ENABLED
}

/**
 * Get mock membership for a user (for ProtectedRoute checks)
 */
export function getMockMembership(email: string): OrgMembershipSummary | null {
  const config = MOCK_USERS[email.toLowerCase()]
  if (!config || !config.orgId || !config.role) {
    return null // Platform admins don't have org memberships
  }

  return {
    membershipId: `mock-membership-${email.replace(/[^a-z0-9]/gi, '-')}`,
    orgId: config.orgId,
    orgName: 'Mock Test Organization',
    slug: 'mock-test-org',
    stateName: 'active',
    lifecycleState: 'active',
    role: config.role,
    branchId: config.branchId,
  }
}

