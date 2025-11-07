/**
 * Org GST Utilities
 * Determines GST mode based on org GSTIN presence and provides invoice title helpers
 */

import type { Org } from '../../types'

/**
 * Check if org has GST enabled (has GSTIN)
 * @param org - Organization object
 * @returns true if org has GSTIN, false otherwise
 */
export function isOrgGstEnabled(org: Org | null | undefined): boolean {
  if (!org) return false
  return !!(org.gst_number && org.gst_number.trim().length > 0)
}

/**
 * Get invoice title based on org GST mode
 * @param orgGstEnabled - Whether org has GST enabled
 * @returns "Tax Invoice" or "Bill of Supply"
 */
export function getInvoiceTitle(orgGstEnabled: boolean): string {
  return orgGstEnabled ? 'Tax Invoice' : 'Bill of Supply'
}

/**
 * Determine if GST calculation should be performed
 * @param org - Organization object
 * @returns true if GST should be calculated, false otherwise
 */
export function shouldCalculateGst(org: Org | null | undefined): boolean {
  return isOrgGstEnabled(org)
}

