/**
 * Org GST Utilities
 * Determines GST mode based on org GSTIN presence and provides invoice title helpers
 * 
 * IMPORTANT: This is the single source of truth for "is org GST-enabled?"
 * Always use isOrgGstEnabled() instead of checking org.gst_number or org.gst_enabled directly.
 * 
 * GST-enabled means: org has GSTIN AND it's verified by platform admin.
 * Unverified GSTINs are not considered "enabled" for tax calculation purposes.
 */

import type { Org } from '../../types'
import type { GstVerificationStatus } from '../../types/gst'

/**
 * Check if org has GST enabled (has GSTIN AND verified)
 * 
 * This is the SINGLE SOURCE OF TRUTH for GST-enabled checks.
 * Always use this function instead of checking org.gst_number or org.gst_enabled directly.
 * 
 * @param org - Organization object
 * @returns true if org has GSTIN AND verification_status is 'verified', false otherwise
 */
export function isOrgGstEnabled(org: Org | null | undefined): boolean {
  if (!org) return false

  const hasGstin = !!(org.gst_number && org.gst_number.trim().length > 0)
  const isVerified = (org as any).gst_verification_status === 'verified'

  return hasGstin && isVerified
}

/**
 * Get GST verification status as typed value
 * @param org - Organization object
 * @returns Verification status or 'unverified' if not set
 */
export function getGstVerificationStatus(org: Org | null | undefined): GstVerificationStatus {
  if (!(org as any)?.gst_verification_status) return 'unverified'
  return (org as any).gst_verification_status as GstVerificationStatus
}

/**
 * Get invoice title based on org GST mode
 * 
 * GST-registered orgs: "Tax Invoice" (shows GST breakdown)
 * Unregistered orgs: "Bill of Supply" (no GST)
 * 
 * @param orgGstEnabled - Whether org has GST enabled (use isOrgGstEnabled())
 * @returns "Tax Invoice" or "Bill of Supply"
 */
export function getInvoiceTitle(orgGstEnabled: boolean): string {
  return orgGstEnabled ? 'Tax Invoice' : 'Bill of Supply'
}

/**
 * Determine if GST calculation should be performed
 * 
 * Uses centralized isOrgGstEnabled() check.
 * 
 * @param org - Organization object
 * @returns true if GST should be calculated, false otherwise
 */
export function shouldCalculateGst(org: Org | null | undefined): boolean {
  return isOrgGstEnabled(org)
}

