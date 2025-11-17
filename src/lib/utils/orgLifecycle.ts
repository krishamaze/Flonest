import type { Org } from '../../types'

export type OrgLifecycleState = 'onboarding_pending' | 'active' | 'suspended' | 'archived'

export const ORG_LIFECYCLE_STATES: OrgLifecycleState[] = [
  'onboarding_pending',
  'active',
  'suspended',
  'archived',
]

/**
 * Returns true if the organization still needs to complete onboarding/setup.
 * This is the single source of truth for gating access to the main app.
 */
export function needsOrgSetup(org: Org | null | undefined): boolean {
  return !!org && org.lifecycle_state === 'onboarding_pending'
}

/**
 * Utility to check if an org is fully active (post-onboarding).
 */
export function isOrgActive(org: Org | null | undefined): boolean {
  return !!org && org.lifecycle_state === 'active'
}

