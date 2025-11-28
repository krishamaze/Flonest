/**
 * AuthProviderSwitch - Unified auth provider export
 *
 * Automatically switches between real AuthProvider and MockAuthProvider
 * based on VITE_USE_MOCK environment variable.
 *
 * IMPORTANT: MOCK_ENABLED is a compile-time constant from import.meta.env.
 * Since it never changes at runtime, the hook calls are deterministic.
 */

import { ReactNode } from 'react'
import { MOCK_ENABLED } from '../lib/mockAuth'
import { MockAuthProvider, useMockAuth } from './MockAuthProvider'
import { AuthProvider as RealAuthProvider, useAuth as useRealAuth } from './AuthContext'

/**
 * Unified AuthProvider - uses mock in test mode, real otherwise
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (MOCK_ENABLED) {
    console.log('[Auth] Mock mode enabled')
    return <MockAuthProvider>{children}</MockAuthProvider>
  }
  return <RealAuthProvider>{children}</RealAuthProvider>
}

/**
 * Unified useAuth hook
 *
 * Since MOCK_ENABLED is a compile-time constant (import.meta.env), the conditional
 * is resolved during build. At runtime, only one branch ever executes, satisfying
 * React's rules of hooks (hooks called in same order every render).
 */
export function useAuth() {
  // This conditional is safe: MOCK_ENABLED is a build-time constant
  // One branch is tree-shaken away by Vite during production build
  if (MOCK_ENABLED) {
    return useMockAuth()
  }
  return useRealAuth()
}

